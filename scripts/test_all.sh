#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "========================================="
echo "  WiFiSense 3D: Complete Test Suite      "
echo "========================================="

echo "--- 1. Python Backend Pytest Suite ---"
cd "$PROJECT_ROOT"
source backend/.venv/bin/activate
PYTHONPATH=backend python -m pytest backend/tests/ -v

echo ""
echo "--- 2. React Frontend TypeScript & Build Check ---"
cd "$PROJECT_ROOT/frontend"
npm run build

echo ""
echo "========================================="
echo "  All tests and builds passed!           "
echo "========================================="
