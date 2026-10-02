"""Deployment checks must be read-only and must not leak connection secrets."""
import unittest
from unittest.mock import patch

from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from extensions import db
import test_subscriptions as fixtures


class DatabaseCommandTests(unittest.TestCase):
    setUp = fixtures.SubscriptionFlowTests.setUp
    tearDown = fixtures.SubscriptionFlowTests.tearDown
    headers_for = fixtures.SubscriptionFlowTests.headers_for

    def test_database_check_keeps_rows_and_revision_unchanged(self):
        before = {name: db.session.execute(text(f'SELECT count(*) FROM {name}')).scalar()
                  for name in [*db.metadata.tables, 'alembic_version']}
        revision = db.session.execute(text('SELECT version_num FROM alembic_version')).scalar()
        result = self.app.test_cli_runner().invoke(args=['database-check'])
        self.assertEqual(result.exit_code, 0, result.output)
        self.assertEqual(before, {name: db.session.execute(text(f'SELECT count(*) FROM {name}')).scalar() for name in before})
        self.assertEqual(revision, db.session.execute(text('SELECT version_num FROM alembic_version')).scalar())

    def test_outdated_revision_fails_but_connection_only_succeeds(self):
        db.session.execute(text("UPDATE alembic_version SET version_num='9184049026b0'"))
        db.session.commit()
        runner = self.app.test_cli_runner()
        self.assertEqual(runner.invoke(args=['database-check', '--connection-only']).exit_code, 0)
        result = runner.invoke(args=['database-check'])
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn('flask db upgrade', result.output)

    def test_database_error_does_not_print_driver_credentials(self):
        with patch.object(db.engine, 'connect', side_effect=OperationalError(
                None, None, Exception('postgresql://private-user:private-password@private-host/db'))):
            result = self.app.test_cli_runner().invoke(args=['database-check'])
        self.assertNotEqual(result.exit_code, 0)
        self.assertNotIn('private-', result.output)
        self.assertIn('Falha ao acessar', result.output)


if __name__ == '__main__':
    unittest.main()
