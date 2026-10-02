#!/usr/bin/env bash
set -o errexit

export FLASK_ENV="${FLASK_ENV:-production}"
: "${DATABASE_URL:?Configure DATABASE_URL com um banco externo persistente.}"
export DATABASE_URL

echo "PetLify start"

cd backend
python -m flask --app app database-check --connection-only
python -m flask --app app db upgrade
python -m flask --app app database-check
if [ "${SEED_DEMO:-false}" = "true" ]; then
  python seed_dev.py
fi
gunicorn app:app --bind 0.0.0.0:${PORT:-10000}
