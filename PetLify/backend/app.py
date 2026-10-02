import os
from pathlib import Path
from flask import Flask, jsonify, send_from_directory
from config import DevelopmentConfig, ProductionConfig
from extensions import init_extensions, db
from auth import auth_bp
from api import api_bp
from audit import register_audit_hooks
from database_commands import register_database_commands

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIST = (BASE_DIR / '..' / 'frontend' / 'dist').resolve()


def create_app():
    # serve_frontend handles both Vite assets and React routes. An automatic
    # static route at /<path:path> would shadow it and break direct links.
    app = Flask(__name__, static_folder=None)
    app.config.from_object(ProductionConfig if os.environ.get('FLASK_ENV') == 'production' else DevelopmentConfig)
    init_extensions(app)

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(api_bp, url_prefix='/api')
    register_audit_hooks(app)
    register_database_commands(app)

    @app.route('/api/health')
    def health():
        return jsonify({'status': 'ok', 'app': 'Petlify'})

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        if path == 'api' or path.startswith('api/'):
            return jsonify({'error': 'Endpoint não encontrado'}), 404
        if FRONTEND_DIST.exists():
            if path.startswith('assets/'):
                # Missing build assets must stay 404 instead of receiving HTML.
                return send_from_directory(FRONTEND_DIST, path)
            target = FRONTEND_DIST / path
            if path and target.exists() and target.is_file():
                return send_from_directory(FRONTEND_DIST, path)
            return send_from_directory(FRONTEND_DIST, 'index.html')
        return jsonify({
            'app': 'Petlify API',
            'status': 'backend online',
            'message': 'Em desenvolvimento local, abra também o frontend em http://localhost:3000.'
        })

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Endpoint não encontrado'}), 404

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify({'error': 'Erro de servidor'}), 500

    return app


app = create_app()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=True)
