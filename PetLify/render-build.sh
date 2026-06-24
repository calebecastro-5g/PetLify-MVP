#!/usr/bin/env bash
set -o errexit

python -m pip install --upgrade pip
pip install -r backend/requirements.txt
cd frontend
npm install
npm run build
