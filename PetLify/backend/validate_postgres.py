"""Reproducible PostgreSQL checks in a disposable local cluster.

Accepts only a directory of PostgreSQL binaries, never a remote connection URL.
Does not connect to the development database or register a Windows service.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile
from threading import Barrier
from unittest.mock import patch

import psycopg
from psycopg import sql

from database_backup import backup, restore


def check(label, condition):
    if not condition:
        raise AssertionError(label)
    print('OK: ' + label, flush=True)


def snapshot(url):
    with psycopg.connect(url) as connection:
        tables = connection.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").fetchall()
        return {name: sorted(connection.execute(sql.SQL('SELECT row_to_json(t)::text FROM {} t').format(sql.Identifier(name))).fetchall())
                for (name,) in tables}


def exercise(url):
    # Configure before importing Flask: app.py creates a module-level app too.
    os.environ.update(DATABASE_URL=url, FLASK_ENV='development', BCRYPT_LOG_ROUNDS='4')
    from datetime import timedelta
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from flask_jwt_extended import create_access_token
    from flask_migrate import upgrade
    from sqlalchemy import text
    from sqlalchemy.exc import IntegrityError
    from app import app
    from extensions import db
    from models import Store, User, Role, Pet, Appointment
    from quotas import lock_subscription
    from time_utils import utc_now, utc_iso

    migrations = str(Path(__file__).resolve().parent / 'migrations')
    with app.app_context():
        upgrade(directory=migrations)
        upgrade(directory=migrations)  # Redeploy must be safe and idempotent.
        with db.engine.connect() as connection:
            differences = compare_metadata(MigrationContext.configure(connection, opts={'compare_type': True}), db.metadata)
            check('six migrations match the PostgreSQL models', differences == [])
        result = app.test_cli_runner().invoke(args=['database-check'])
        check('read-only deployment check', result.exit_code == 0)
        a = Store(name='QA A', tenant_key='qa-a')
        b = Store(name='QA B', tenant_key='qa-b')
        db.session.add_all([a, b])
        db.session.flush()
        client_a = User(store_id=a.id, role=Role.CLIENT, name='Tutor QA A', email='qa-a@test.dev', password='Test123!')
        client_b = User(store_id=b.id, role=Role.CLIENT, name='Tutor QA B', email='qa-b@test.dev', password='Test123!')
        db.session.add_all([client_a, client_b])
        db.session.flush()
        pet = Pet(store_id=a.id, owner_id=client_a.id, name='QA', breed='SRD', size='Pequeno')
        db.session.add(pet)
        db.session.commit()
        headers = {'Authorization': 'Bearer ' + create_access_token(identity={
            'user_id': client_a.id, 'store_id': a.id, 'role': client_a.role.value})}
        other_headers = {'Authorization': 'Bearer ' + create_access_token(identity={
            'user_id': client_b.id, 'store_id': b.id, 'role': client_b.role.value})}
        pet_id, user_b_id = pet.id, client_b.id
        client = app.test_client()
        purchase = client.post('/api/payments', json={'item_id': 'plan-basic', 'pet_id': pet_id, 'method': 'PIX'}, headers=headers)
        check('purchase creates payment and subscription', purchase.status_code == 201 and purchase.json['subscription_id'] is not None)
        subscription_id = purchase.json['subscription_id']
        scheduled = utc_iso(utc_now() + timedelta(days=2))
        body = {'pet_id': pet_id, 'service': 'Banho', 'billing_type': 'Plano mensal', 'scheduled_at': scheduled}
        reservation = client.post('/api/appointments', json=body, headers=headers)
        check('reservation stores explicit shop time', reservation.status_code == 201 and reservation.json['scheduled_at'].endswith('-03:00'))
        appointment_id = reservation.json['id']
        blocked = client.post('/api/appointments', json={**body, 'scheduled_at': utc_iso(utc_now() + timedelta(days=3))}, headers=headers)
        check('quota blocks second bath', blocked.status_code == 409 and blocked.json.get('code') == 'subscription_quota_exceeded')
        denied = False
        try:
            with db.session.begin_nested():
                db.session.execute(text('UPDATE appointments SET client_id=:user WHERE id=:id'),
                                   {'user': user_b_id, 'id': appointment_id})
        except IntegrityError:
            denied = True
        check('database foreign key rejects another store client', denied)
        check('API keeps appointments isolated by store', client.get('/api/appointments', headers=other_headers).json == [])
        canceled = client.put(f'/api/appointments/{appointment_id}', json={'status': 'Cancelado'}, headers=headers)
        usage = client.get(f'/api/subscriptions/{subscription_id}/usage', query_string={'at': scheduled}, headers=headers).json
        check('cancel releases the bath quota', canceled.status_code == 200 and next(x for x in usage['services'] if x['service'] == 'Banho')['remaining'] == 1)

        barrier = Barrier(2)
        def synchronized_lock(subscription):
            barrier.wait(timeout=15)
            lock_subscription(subscription)
        def reserve(day):
            with app.test_client() as parallel_client:
                return parallel_client.post('/api/appointments', json={**body,
                    'scheduled_at': utc_iso(utc_now() + timedelta(days=day))}, headers=headers).status_code
        db.session.remove()
        with patch('api.lock_subscription', side_effect=synchronized_lock):
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(reserve, [3, 4]))
        check('two requests competing for last use produce one reservation', sorted(results) == [201, 409]
              and Appointment.query.filter(Appointment.status != 'CANCELED').count() == 1)
        db.session.remove()
        db.engine.dispose()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pg-bin', required=True, type=Path)
    args = parser.parse_args()
    suffix = '.exe' if os.name == 'nt' else ''
    def tool(name):
        path = args.pg_bin / (name + suffix)
        if not path.is_file():
            parser.error(f'{name} não encontrado em --pg-bin.')
        return str(path)
    # Validate all tools before starting a process.
    for name in ('initdb', 'pg_ctl', 'pg_dump', 'pg_restore'):
        tool(name)
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    with tempfile.TemporaryDirectory(prefix='petlify-postgres-') as directory:
        root = Path(directory)
        def run(name, *arguments):
            # On Windows a detached postgres can inherit pipe handles. File-backed
            # output prevents subprocess.communicate() waiting for the server exit.
            with (root / (name + '.log')).open('a', encoding='utf-8') as log:
                return subprocess.run([tool(name), *map(str, arguments)], check=True,
                                      stdout=log, stderr=log, creationflags=flags, timeout=90)
        data = root / 'data'
        password = secrets.token_urlsafe(24)
        password_file = root / 'password'
        password_file.write_text(password, encoding='utf-8')
        run('initdb', '-D', data, '--auth=scram-sha-256', '--username=postgres',
            '--encoding=UTF8', '--locale=C', '--pwfile', password_file)
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
        server_options = f'-h 127.0.0.1 -p {port}'
        started = False
        def start():
            run('pg_ctl', '-D', data, '-l', root / 'postgres.log', '-o', server_options, '-w', 'start')
        def stop():
            run('pg_ctl', '-D', data, '-m', 'fast', '-w', 'stop')
        try:
            start()
            started = True
            base = f'postgresql://postgres:{password}@127.0.0.1:{port}/'
            with psycopg.connect(base + 'postgres', autocommit=True) as connection:
                connection.execute('CREATE DATABASE petlify_test')
                connection.execute('CREATE DATABASE petlify_restore')
            url = base + 'petlify_test'
            destination = base + 'petlify_restore'
            exercise(url)
            before = snapshot(url)
            stop()
            started = False
            start()
            started = True
            check('data survives PostgreSQL restart', snapshot(url) == before)
            archive = root / 'petlify.dump'
            backup(url, archive, args.pg_bin)
            restore(destination, archive, args.pg_bin)
            check('native backup restores every row of all 13 tables', snapshot(destination) == before and len(before) == 13)
            refused = False
            try:
                restore(destination, archive, args.pg_bin)
            except ValueError:
                refused = True
            check('restore refuses a populated destination', refused and snapshot(destination) == before)
            # New writes also validate sequences restored by pg_restore.
            with psycopg.connect(destination) as connection:
                inserted = connection.execute("INSERT INTO stores (name, tenant_key) VALUES ('Restore QA', 'restore-qa') RETURNING id").fetchone()[0]
                check('restored primary-key sequences accept new records', inserted > 2)
            print('PostgreSQL validation completed. Cloud deployment remains a separate check.', flush=True)
        finally:
            if started or (data / 'postmaster.pid').exists():
                stop()


if __name__ == '__main__':
    main()
