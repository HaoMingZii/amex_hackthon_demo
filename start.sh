#!/bin/zsh
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PATH="/opt/homebrew/bin:$PATH"

echo "Starting API on :8000"
cd "$ROOT/backend"
python3 -m uvicorn app:app --port 8000 &
API_PID=$!

echo "Starting UI on :5173"
cd "$ROOT/frontend"
npm run dev &
UI_PID=$!

echo "API pid $API_PID  UI pid $UI_PID"
echo "Open http://127.0.0.1:5173"
wait
