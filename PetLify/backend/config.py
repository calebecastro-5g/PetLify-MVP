import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

basedir = Path(__file__).resolve().parent
load_dotenv(basedir / '.env')


def _normalize_database_url(url: str) -> str:
    """Render/Postgres compatibility: SQLAlchemy expects postgresql://, not postgres://."""
    if url and url.startswith('postgres://'):
        return url.replace('postgres://', 'postgresql://', 1)
    return url


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'petlify-dev-secret')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'petlify-dev-jwt-secret')
    DEFAULT_DATABASE_URL = 'sqlite:////tmp/petlify.db' if os.environ.get('FLASK_ENV') == 'production' else 'sqlite:///instance/petlify.db'
    DATABASE_URL = os.environ.get('DATABASE_URL', DEFAULT_DATABASE_URL)
    SQLALCHEMY_DATABASE_URI = _normalize_database_url(DATABASE_URL)
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
