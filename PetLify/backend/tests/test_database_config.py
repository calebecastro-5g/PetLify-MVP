"""Ensure deployment cannot silently revert to an ephemeral SQLite database."""
import unittest
from unittest.mock import patch

from config import _database_uri, _normalize_database_url, _engine_options
from database_backup import connection_environment, native_url
from sqlalchemy.engine import make_url


class DatabaseConfigTests(unittest.TestCase):
    def test_postgres_provider_urls_preserve_encoded_credentials_and_ssl(self):
        for prefix in ('postgres://', 'postgresql://', 'postgresql+psycopg://'):
            uri = _normalize_database_url(prefix + 'user:p%40ss%2Fword@host/db?sslmode=require&channel_binding=require')
            url = make_url(uri)
            self.assertEqual(url.drivername, 'postgresql+psycopg')
            self.assertEqual(url.password, 'p@ss/word')
            self.assertEqual(url.query['sslmode'], 'require')
            self.assertEqual(url.query['channel_binding'], 'require')
        self.assertEqual(_normalize_database_url('sqlite:///local.db'), 'sqlite:///local.db')

    def test_production_requires_explicit_persistent_database(self):
        for uri in (None, '', 'sqlite:////tmp/petlify.db', 'sqlite:///local.db'):
            with self.subTest(uri=uri), self.assertRaisesRegex(RuntimeError, 'banco externo persistente'):
                _database_uri('production', uri)
        self.assertEqual(_database_uri('development', None), 'sqlite:///petlify.db')
        self.assertTrue(_database_uri('production', 'postgresql://u:p@h/db?sslmode=require').startswith('postgresql+psycopg://'))

    def test_postgres_pool_does_not_apply_to_local_sqlite(self):
        options = _engine_options('postgresql+psycopg://u:p@h/db')
        self.assertTrue(options['pool_pre_ping'])
        self.assertEqual(options['max_overflow'], 0)
        self.assertEqual(_engine_options('sqlite:///local.db'), {})

    def test_backup_passes_secrets_only_in_environment_and_preserves_ssl(self):
        with patch.dict('os.environ', {'PGHOST': 'stale-host', 'PGPASSWORD': 'stale-password'}):
            env = connection_environment('postgresql+psycopg://user:p%40ss@host/db?sslmode=require&channel_binding=require')
        self.assertEqual(env['PGPASSWORD'], 'p@ss')
        self.assertEqual(env['PGHOST'], 'host')
        self.assertEqual(env['PGSSLMODE'], 'require')
        self.assertEqual(env['PGCHANNELBINDING'], 'require')
        with self.assertRaises(ValueError) as invalid:
            native_url('invalid-url-with-private-password')
        self.assertNotIn('private-password', str(invalid.exception))


if __name__ == '__main__':
    unittest.main()
