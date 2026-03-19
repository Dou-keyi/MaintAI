#!/usr/bin/env bash
set -euo pipefail

# Start FastAPI + serve static frontend
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"

uvicorn Backend.main:app --host 0.0.0.0 --port 8000 --reload
