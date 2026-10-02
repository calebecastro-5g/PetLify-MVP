"""Read-only checks for deployment; never print a connection string."""
from pathlib import Path

import click
from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError

from extensions import db


def register_database_commands(app):
    @app.cli.command('database-check')
    @click.option('--connection-only', is_flag=True, help='Check connection before migrations.')
    def database_check(connection_only):
        """Verify connection, migration revision and domain tables without changing data."""
        try:
            with db.engine.connect() as connection:
                connection.execute(text('SELECT 1'))
                if not connection_only:
                    migrations = Path(__file__).resolve().parent / 'migrations'
                    config = AlembicConfig()
                    config.set_main_option('script_location', str(migrations))
                    expected = set(ScriptDirectory.from_config(config).get_heads())
                    actual = set(connection.execute(text('SELECT version_num FROM alembic_version')).scalars())
                    if actual != expected:
                        raise click.ClickException('Banco precisa de atualização: execute flask db upgrade.')
                    missing = set(db.metadata.tables) - set(inspect(connection).get_table_names())
                    if missing:
                        raise click.ClickException('Banco não contém todas as tabelas do projeto.')
        except SQLAlchemyError:
            # Driver error messages can contain host/user/password. Keep secrets out of logs.
            raise click.ClickException('Falha ao acessar o banco. Confira conexão e migrações no ambiente.') from None
        click.echo('Conexão OK.' if connection_only else 'Conexão, revisão e 12 tabelas de domínio OK.')
