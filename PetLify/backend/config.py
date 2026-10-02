import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

basedir = Path(__file__).resolve().parent
load_dotenv(basedir / '.env')


def _normalize_database_url(url: str) -> str:
    """Use the installed Psycopg 3 driver, preserving credentials and SSL options."""
    for prefix in ('postgres://', 'postgresql://'):
        if url and url.startswith(prefix):
            return 'postgresql+psycopg://' + url[len(prefix):]
    return url


def _database_uri(environment, url):
    if environment == 'production':
        if not url or url.startswith('sqlite:'):
            raise RuntimeError('Produção exige DATABASE_URL de um banco externo persistente.')
    return _normalize_database_url(url or 'sqlite:///petlify.db')


def _engine_options(uri):
    if uri.startswith('postgresql'):
        # Each Gunicorn worker owns its pool. Keep the free database within limits.
        return {'pool_pre_ping': True, 'pool_size': 2, 'max_overflow': 0,
                'pool_timeout': 30, 'connect_args': {'connect_timeout': 15}}
    return {}


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'petlify-dev-secret')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'petlify-dev-jwt-secret')
    DATABASE_URL = os.environ.get('DATABASE_URL')
    SQLALCHEMY_DATABASE_URI = _database_uri(os.environ.get('FLASK_ENV'), DATABASE_URL)
    SQLALCHEMY_ENGINE_OPTIONS = _engine_options(SQLALCHEMY_DATABASE_URI)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    BCRYPT_LOG_ROUNDS = int(os.environ.get('BCRYPT_LOG_ROUNDS', 12))
    PREFERRED_URL_SCHEME = 'https'
    CORS_ORIGINS = [origin.strip() for origin in os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',') if origin.strip()]
    MAIL_FROM = os.environ.get('MAIL_FROM', 'no-reply@petlify.app')


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False
