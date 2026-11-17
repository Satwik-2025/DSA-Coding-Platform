#!/usr/bin/env bash
# Starts the whole site on macOS / Linux (or Git Bash):   bash start.sh
# Builds and starts the backend (http://localhost:8081), waits until it answers, then starts the
# frontend (http://localhost:5173). Ctrl+C stops both. Needs a JDK 17+, Maven and Node 20+.
set -euo pipefail
cd "$(dirname "$0")"

fail() { echo; echo "PROBLEM: $1"; exit 1; }

command -v java  >/dev/null 2>&1 || fail "Java is not installed. Install a JDK 17 or newer (e.g. https://adoptium.net)."
command -v javac >/dev/null 2>&1 || fail "Java is installed but not a full JDK ('javac' is missing). Install a JDK 17+ from https://adoptium.net."
command -v mvn   >/dev/null 2>&1 || fail "Maven is not installed (macOS: brew install maven; Linux: your package manager)."
command -v node  >/dev/null 2>&1 || fail "Node.js is not installed. Install Node 20 or newer from https://nodejs.org."
command -v curl  >/dev/null 2>&1 || fail "curl is not installed."
node_major=$(node -v | sed 's/^v\([0-9]*\).*/\1/')
[ "$node_major" -ge 20 ] || fail "Node $node_major found, but Node 20 or newer is needed (https://nodejs.org)."
command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1 || \
  echo "Note: Python is not installed, so Python solutions will not be offered (Java still works)."

backend_answers() { curl -sf http://localhost:8081/api/users >/dev/null 2>&1; }
port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

REUSE=0
if port_busy 8081; then
  if backend_answers; then echo "The backend is already running on port 8081; using it."; REUSE=1
  else fail "Port 8081 is used by another program. Close it and try again."; fi
fi
port_busy 5173 && fail "Port 5173 is already in use - probably the site is already running in another window."

[ -f frontend/.env ] || cp frontend/.env.example frontend/.env
if [ ! -d frontend/node_modules ]; then
  echo "Installing frontend packages (first run only)..."
  (cd frontend && npm install) || fail "npm install failed. Check your internet connection and try again."
fi

BACKEND_PID=""
cleanup() {
  if [ -n "$BACKEND_PID" ]; then kill "$BACKEND_PID" 2>/dev/null || true; wait "$BACKEND_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

if [ "$REUSE" -eq 0 ]; then
  echo "Building the backend (the first build downloads libraries and takes a few minutes)..."
  (cd backend && mvn -B -q -DskipTests package) || fail "The backend build failed. The Maven output above says why."
  JAR=$(ls backend/target/dsa-platform-*.jar | head -n 1)
  # Started from backend/ so the default database lives in backend/data.
  (cd backend && exec java -jar "../$JAR") &
  BACKEND_PID=$!
  echo "Starting the backend on http://localhost:8081 ..."
  waited=0
  until backend_answers; do
    kill -0 "$BACKEND_PID" 2>/dev/null || fail "The backend stopped while starting. Its messages are just above."
    [ "$waited" -lt 180 ] || fail "The backend did not answer within 3 minutes."
    sleep 2; waited=$((waited + 2))
  done
fi

echo
echo "Site starting at http://localhost:5173  (keep this window open; press Ctrl+C to stop)"
cd frontend
npm run dev
