#!/usr/bin/env bash
set -o errexit

export FLASK_ENV="${FLASK_ENV:-production}"
export DATABASE_URL="${DATABASE_URL:-sqlite:////tmp/petlify.db}"

mkdir -p /tmp

echo "PetLify start"
echo "DATABASE_URL=$DATABASE_URL"

cd backend
python seed_dev.py
gunicorn app:app --bind 0.0.0.0:${PORT:-10000}
