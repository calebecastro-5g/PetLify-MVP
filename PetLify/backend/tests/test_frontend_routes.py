"""Regression coverage for direct links/reloads when Flask serves the SPA."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import app as app_module
from config import Config
from extensions import db


class FrontendRoutingTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        root = Path(self.directory.name)
        dist = root / 'dist'
        (dist / 'assets').mkdir(parents=True)
        (dist / 'index.html').write_text('<html><body>PetLify SPA</body></html>', encoding='utf-8')
        (dist / 'assets' / 'app.js').write_text('console.log("PetLify");', encoding='utf-8')
        self.dist_patch = patch.object(app_module, 'FRONTEND_DIST', dist)
        self.uri_patch = patch.object(Config, 'SQLALCHEMY_DATABASE_URI', 'sqlite:///' + (root / 'test.db').as_posix())
        self.dist_patch.start()
        self.uri_patch.start()
        self.app = app_module.create_app()
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.engine.dispose()
        self.uri_patch.stop()
        self.dist_patch.stop()
        self.directory.cleanup()

    def test_direct_links_and_reloads_serve_the_react_entrypoint(self):
        for path in ['/', '/cliente', '/funcionario', '/dono', '/checkout?item_id=plan-basic&pet_id=1']:
            with self.subTest(path=path):
                with self.client.get(path) as response:
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.mimetype, 'text/html')
                    self.assertIn(b'PetLify SPA', response.data)

    def test_assets_and_api_errors_are_not_replaced_with_spa_html(self):
        with self.client.get('/assets/app.js') as asset:
            self.assertEqual(asset.status_code, 200)
            self.assertIn(b'console.log', asset.data)
        for path in ['/api', '/api/missing', '/assets/missing.js']:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.json, {'error': 'Endpoint não encontrado'})
        self.assertEqual(self.client.get('/api/health').json['status'], 'ok')


if __name__ == '__main__':
    unittest.main()
