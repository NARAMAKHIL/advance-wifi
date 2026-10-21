#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "========================================="
echo " Starting WiFiSense 3D FastAPI Backend   "
echo "========================================="

cd "$PROJECT_ROOT"
source backend/.venv/bin/activate
export PYTHONPATH=backend

echo "Backend starting on http://localhost:8000"
echo "API Docs available at http://localhost:8000/docs"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
