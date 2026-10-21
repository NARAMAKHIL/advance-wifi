#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "========================================="
echo " Starting WiFiSense 3D React Dev Server  "
echo "========================================="

cd "$PROJECT_ROOT/frontend"
echo "Frontend dev server starting on http://localhost:5173"
npm run dev
