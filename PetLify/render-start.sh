#!/usr/bin/env bash
set -o errexit

cd backend
python seed_dev.py
gunicorn app:app --bind 0.0.0.0:${PORT:-10000}
