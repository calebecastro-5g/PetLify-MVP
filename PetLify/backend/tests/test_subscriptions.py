import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path

from flask_jwt_extended import create_access_token
from flask_migrate import upgrade, downgrade
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext

from app import create_app
from config import Config
from extensions import db
from models import Store, User, Role, Pet, Payment, Subscription
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError


class SubscriptionFlowTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.original_uri = Config.SQLALCHEMY_DATABASE_URI
        Config.SQLALCHEMY_DATABASE_URI = 'sqlite:///' + (Path(self.directory.name) / 'test.db').as_posix()
        self.app = create_app()
        self.app.config.update(TESTING=True, BCRYPT_LOG_ROUNDS=4)
        self.context = self.app.app_context()
        self.context.push()
        upgrade(directory=str(Path(__file__).resolve().parents[1] / 'migrations'))
        store = Store(name='Loja A', tenant_key='a')
        other = Store(name='Loja B', tenant_key='b')
        db.session.add_all([store, other])
        db.session.flush()
        self.user = User(store_id=store.id, role=Role.CLIENT, name='Tutor A', email='a@test.dev', password='Password123!')
        self.other_user = User(store_id=other.id, role=Role.CLIENT, name='Tutor B', email='b@test.dev', password='Password123!')
        db.session.add_all([self.user, self.other_user])
        db.session.flush()
        self.pet = Pet(store_id=store.id, owner_id=self.user.id, name='Thor', breed='SRD', size='Pequeno')
        self.other_pet = Pet(store_id=other.id, owner_id=self.other_user.id, name='Mel', breed='SRD', size='Pequeno')
        db.session.add_all([self.pet, self.other_pet])
        db.session.commit()
        self.headers = self.headers_for(self.user)
        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        db.engine.dispose()
        self.context.pop()
        Config.SQLALCHEMY_DATABASE_URI = self.original_uri
        self.directory.cleanup()

    def headers_for(self, user):
        token = create_access_token(identity={'user_id': user.id, 'store_id': user.store_id, 'role': user.role.value})
        return {'Authorization': 'Bearer ' + token}

    def buy(self, **kwargs):
        data = {'item_id': 'plan-basic', 'pet_id': self.pet.id, 'method': 'PIX'}
        data.update(kwargs)
        return self.client.post('/api/payments', json=data, headers=self.headers)

    def schedule(self, **kwargs):
        data = {'pet_id': self.pet.id, 'service': 'Banho', 'scheduled_at': (datetime.utcnow() + timedelta(days=1)).isoformat(), 'billing_type': 'Plano mensal'}
        data.update(kwargs)
        return self.client.post('/api/appointments', json=data, headers=self.headers)

    def same_store_neighbors(self):
        neighbor = User(store_id=self.user.store_id, role=Role.CLIENT,
                        name='Outro tutor', email='neighbor@test.dev', password='Password123!')
        db.session.add(neighbor)
        db.session.flush()
        sibling = Pet(store_id=self.user.store_id, owner_id=self.user.id,
                      name='Segundo pet', breed='SRD', size='Pequeno')
        db.session.add(sibling)
        db.session.flush()
        subscription = Subscription(store_id=self.user.store_id, pet_id=sibling.id,
                                    plan_id='plan-basic', starts_at=datetime.utcnow(),
                                    ends_at=datetime.utcnow() + timedelta(days=30))
        db.session.add(subscription)
        db.session.commit()
        return neighbor, sibling, subscription

    def test_same_store_wrong_tutor_and_wrong_pet_subscription_are_rejected(self):
        self.assertEqual(self.buy().status_code, 201)
        response = self.schedule()
        self.assertEqual(response.status_code, 201, response.json)
        appointment_id = response.json['id']
        neighbor, sibling, subscription = self.same_store_neighbors()
        cases = [
            ('appointments', 'client_id', appointment_id, neighbor.id),
            ('appointments', 'subscription_id', appointment_id, subscription.id),
            ('appointments', 'pet_id', appointment_id, sibling.id),
            ('pets', 'owner_id', self.pet.id, neighbor.id),
            ('subscriptions', 'pet_id', self.pet.subscription_at().id, sibling.id),
        ]
        for table, column, row_id, value in cases:
            with self.subTest(table=table, column=column):
                with self.assertRaises(IntegrityError):
                    with db.session.begin_nested():
                        db.session.execute(text(f'UPDATE {table} SET {column}=:v WHERE id=:id'), {'v': value, 'id': row_id})
        for client_id, subscription_id in [(neighbor.id, None), (self.user.id, subscription.id)]:
            with self.subTest(client=client_id, subscription=subscription_id):
                with self.assertRaises(IntegrityError):
                    with db.session.begin_nested():
                        db.session.execute(text(
                            'INSERT INTO appointments (store_id,client_id,pet_id,subscription_id,service,scheduled_at) '
                            "VALUES (:store,:client,:pet,:subscription,'Banho',:at)"
                        ), {'store': self.user.store_id, 'client': client_id, 'pet': self.pet.id,
                            'subscription': subscription_id, 'at': datetime.utcnow()})
        # A different pet can still have a valid independent appointment.
        valid = self.schedule(pet_id=sibling.id, scheduled_at=(datetime.utcnow()+timedelta(days=2)).isoformat())
        self.assertEqual(valid.status_code, 201, valid.json)
        self.assertFalse(valid.json['payment_required'])

    def test_ownership_migration_refuses_invalid_legacy_tutor_and_subscription(self):
        from alembic import command
        from sqlalchemy import inspect
        self.buy()
        appointment_id = self.schedule().json['id']
        neighbor, sibling, subscription = self.same_store_neighbors()
        original_subscription = self.pet.subscription_at().id
        values = [("client_id", neighbor.id, self.user.id, 'tutor'),
                  ('subscription_id', subscription.id, original_subscription, 'assinatura')]
        migrations = str(Path(__file__).resolve().parents[1] / 'migrations')
        downgrade(revision='73032ec89a26', directory=migrations)
        for column, bad, good, label in values:
            with self.subTest(field=column):
                db.session.execute(text(f'UPDATE appointments SET {column}=:v WHERE id=:id'), {'v': bad, 'id': appointment_id})
                db.session.commit()
                with self.assertRaisesRegex(RuntimeError, label):
                    command.upgrade(self.app.extensions['migrate'].migrate.get_config(migrations), 'head')
                self.assertEqual(db.session.execute(text('SELECT version_num FROM alembic_version')).scalar(), '73032ec89a26')
                names = [c['name'] for c in inspect(db.engine).get_unique_constraints('pets')]
                self.assertNotIn('uq_pets_id_owner_store', names)
                self.assertEqual(db.session.execute(text('PRAGMA foreign_keys')).scalar(), 1)
                db.session.execute(text(f'UPDATE appointments SET {column}=:v WHERE id=:id'), {'v': good, 'id': appointment_id})
                db.session.commit()
        upgrade(directory=migrations)
        self.assertEqual(db.session.execute(text('PRAGMA foreign_key_check')).all(), [])

    def test_payment_owner_is_enforced_by_database(self):
        self.assertEqual(self.buy().status_code, 201)
        plan_payment = Payment.query.one()
        self.assertEqual(plan_payment.pet_id, self.pet.id)
        neighbor, sibling, other_subscription = self.same_store_neighbors()
        appointment = self.schedule(billing_type='Serviço avulso').json
        response = self.client.post('/api/payments', json={
            'appointment_id': appointment['id'], 'item_id': 'service-bath', 'method': 'PIX',
        }, headers=self.headers)
        self.assertEqual(response.status_code, 201, response.json)
        service_payment_id = response.json['id']
        cases = [
            (plan_payment.id, 'client_id', neighbor.id),
            (plan_payment.id, 'pet_id', sibling.id),
            (plan_payment.id, 'pet_id', None),
            (plan_payment.id, 'subscription_id', other_subscription.id),
            (service_payment_id, 'client_id', neighbor.id),
        ]
        for row_id, column, value in cases:
            with self.subTest(payment=row_id, column=column, value=value):
                with self.assertRaises(IntegrityError):
                    with db.session.begin_nested():
                        db.session.execute(text(f'UPDATE payments SET {column}=:v WHERE id=:id'), {'v': value, 'id': row_id})
        with self.assertRaises(IntegrityError):
            with db.session.begin_nested():
                db.session.execute(text(
                    'INSERT INTO payments (store_id,client_id,subscription_id,method,amount) '
                    "VALUES (:store,:client,:subscription,'PIX',99)"
                ), {'store': self.user.store_id, 'client': self.user.id, 'subscription': plan_payment.subscription_id})
        delete = self.client.delete(f"/api/appointments/{appointment['id']}", headers=self.headers)
        self.assertEqual(delete.status_code, 200, delete.json)
        self.assertIsNone(db.session.get(Payment, service_payment_id).appointment_id)

    def test_payment_migration_backfills_pet_and_refuses_wrong_client(self):
        from alembic import command
        from sqlalchemy import inspect
        self.buy()
        payment_id = Payment.query.one().id
        neighbor, _, _ = self.same_store_neighbors()
        migrations = str(Path(__file__).resolve().parents[1] / 'migrations')
        downgrade(revision='a4b62c819f03', directory=migrations)
        db.session.execute(text('UPDATE payments SET client_id=:client WHERE id=:id'), {'client': neighbor.id, 'id': payment_id})
        db.session.commit()
        with self.assertRaisesRegex(RuntimeError, 'Pagamento.*assinatura'):
            command.upgrade(self.app.extensions['migrate'].migrate.get_config(migrations), 'head')
        self.assertNotIn('pet_id', [c['name'] for c in inspect(db.engine).get_columns('payments')])
        self.assertEqual(db.session.execute(text('SELECT version_num FROM alembic_version')).scalar(), 'a4b62c819f03')
        db.session.execute(text('UPDATE payments SET client_id=:client WHERE id=:id'), {'client': self.user.id, 'id': payment_id})
        db.session.commit()
        upgrade(directory=migrations)
        db.session.expire_all()
        self.assertEqual(db.session.get(Payment, payment_id).pet_id, self.pet.id)
        self.assertEqual(db.session.execute(text('PRAGMA foreign_key_check')).all(), [])

    def test_migrations_match_models(self):
        with db.engine.connect() as connection:
            self.assertEqual(compare_metadata(MigrationContext.configure(connection, opts={'compare_type': True}), db.metadata), [])

    def test_migration_preserves_legacy_pet_and_marks_source(self):
        migrations = str(Path(__file__).resolve().parents[1] / 'migrations')
        pet_id = self.pet.id
        downgrade(revision='9184049026b0', directory=migrations)
        from sqlalchemy import text
        db.session.execute(text('UPDATE pets SET plan = :plan WHERE id = :id'), {'plan': 'Premium', 'id': pet_id})
        db.session.commit()
        upgrade(directory=migrations)
        subscription = Subscription.query.one()
        self.assertEqual(subscription.source, 'legacy')
        self.assertEqual(subscription.pet_id, pet_id)
        self.assertEqual(subscription.plan_id, 'plan-premium')
        self.assertEqual(Payment.query.count(), 0)

    def test_purchase_links_payment_and_replaces_previous(self):
        first = self.buy(amount=1)
        self.assertEqual(first.status_code, 201, first.json)
        self.assertEqual(first.json['amount'], 99)
        self.assertIsNotNone(first.json['subscription_id'])
        second = self.buy(item_id='plan-premium')
        self.assertEqual(second.status_code, 201, second.json)
        subscriptions = Subscription.query.order_by(Subscription.id).all()
        self.assertEqual([item.status for item in subscriptions], ['replaced', 'active'])
        self.assertEqual(subscriptions[1].ends_at - subscriptions[1].starts_at, timedelta(days=30))
        self.assertEqual(Payment.query.count(), 2)

    def test_wrong_cash_password_does_not_activate_plan(self):
        response = self.buy(method='Dinheiro', employee_password='wrong')
        self.assertEqual(response.status_code, 401)
        self.assertEqual(Payment.query.count(), 0)
        self.assertEqual(Subscription.query.count(), 0)

    def test_plan_coverage_and_avulso_are_distinct(self):
        self.assertEqual(self.buy().status_code, 201)
        self.assertEqual(self.schedule(service='Hidratação').status_code, 400)
        covered = self.schedule()
        self.assertEqual(covered.status_code, 201, covered.json)
        self.assertFalse(covered.json['payment_required'])
        avulso = self.schedule(billing_type='Serviço avulso', scheduled_at=(datetime.utcnow() + timedelta(days=2)).isoformat())
        self.assertEqual(avulso.status_code, 201, avulso.json)
        self.assertTrue(avulso.json['payment_required'])

    def test_expiration_rejects_future_coverage_and_clears_pet_plan(self):
        self.buy()
        response = self.schedule(scheduled_at=(datetime.utcnow() + timedelta(days=31)).isoformat())
        self.assertEqual(response.status_code, 400)
        subscription = Subscription.query.one()
        subscription.starts_at = datetime.utcnow() - timedelta(days=31)
        subscription.ends_at = datetime.utcnow() - timedelta(days=1)
        db.session.commit()
        self.assertIsNone(self.pet.to_dict()['plan'])
        self.assertEqual(subscription.to_dict()['status'], 'expired')

    def test_other_tenant_cannot_purchase_or_see_subscription(self):
        self.assertEqual(self.buy(pet_id=self.other_pet.id).status_code, 404)
        self.buy()
        response = self.client.get('/api/subscriptions', headers=self.headers_for(self.other_user))
        self.assertEqual(response.json, [])

    def test_database_rejects_cross_store_links_without_api(self):
        self.assertEqual(self.buy().status_code, 201)
        self.assertEqual(self.schedule().status_code, 201)
        subscription = Subscription.query.one()
        payment = Payment.query.one()
        from models import Appointment
        appointment = Appointment.query.one()
        # Direct SQL bypasses API validation: the database must reject it.
        cases = [
            ('pets', 'owner_id', self.pet.id, self.other_user.id),
            ('subscriptions', 'pet_id', subscription.id, self.other_pet.id),
            ('appointments', 'client_id', appointment.id, self.other_user.id),
            ('appointments', 'pet_id', appointment.id, self.other_pet.id),
            ('payments', 'client_id', payment.id, self.other_user.id),
            ('payments', 'confirmed_by_employee_id', payment.id, self.other_user.id),
        ]
        foreign_subscription = Subscription(
            store_id=self.other_user.store_id, pet_id=self.other_pet.id, plan_id='plan-basic',
            starts_at=datetime.utcnow(), ends_at=datetime.utcnow() + timedelta(days=30),
        )
        foreign_appointment = Appointment(
            store_id=self.other_user.store_id, pet_id=self.other_pet.id,
            client_id=self.other_user.id, service='Banho', scheduled_at=datetime.utcnow(),
        )
        db.session.add_all([foreign_subscription, foreign_appointment])
        db.session.commit()
        cases += [
            ('appointments', 'subscription_id', appointment.id, foreign_subscription.id),
            ('payments', 'subscription_id', payment.id, foreign_subscription.id),
            ('payments', 'appointment_id', payment.id, foreign_appointment.id),
            ('users', 'store_id', self.user.id, self.other_user.store_id),
            ('pets', 'store_id', self.pet.id, self.other_user.store_id),
        ]
        self.assertEqual(db.session.execute(text('PRAGMA foreign_keys')).scalar(), 1)
        for table, column, row_id, value in cases:
            with self.subTest(table=table, column=column):
                with self.assertRaises(IntegrityError):
                    with db.session.begin_nested():
                        db.session.execute(text(f'UPDATE {table} SET {column} = :value WHERE id = :id'), {'value': value, 'id': row_id})
        with self.assertRaises(IntegrityError):
            with db.session.begin_nested():
                db.session.execute(text(
                    "INSERT INTO pets (store_id, owner_id, name, species, breed, size, age, photo_icon) "
                    "VALUES (:store, :owner, 'Inválido', 'Cão', 'SRD', 'Pequeno', 1, 'X')"
                ), {'store': self.user.store_id, 'owner': self.other_user.id})

    def test_pet_deletion_preserves_unlinked_payment_with_foreign_keys(self):
        self.buy()
        self.schedule()
        response = self.client.delete(f'/api/pets/{self.pet.id}', headers=self.headers)
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(Subscription.query.count(), 0)
        self.assertIsNone(Payment.query.one().subscription_id)
        self.assertEqual(db.session.execute(text('PRAGMA foreign_key_check')).all(), [])

    def test_migration_rejects_inconsistent_legacy_data_before_schema_change(self):
        migrations = str(Path(__file__).resolve().parents[1] / 'migrations')
        downgrade(revision='1d532c0cfeb8', directory=migrations)
        db.session.execute(text('UPDATE pets SET owner_id = :owner WHERE id = :id'),
                           {'owner': self.other_user.id, 'id': self.pet.id})
        db.session.commit()
        with self.assertRaisesRegex(RuntimeError, 'pets.owner_id'):
            from alembic import command
            command.upgrade(self.app.extensions['migrate'].migrate.get_config(migrations), 'head')
        self.assertEqual(db.session.execute(text('SELECT version_num FROM alembic_version')).scalar(), '1d532c0cfeb8')
        self.assertEqual(db.session.execute(text('PRAGMA foreign_keys')).scalar(), 1)


if __name__ == '__main__':
    unittest.main()
