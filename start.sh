#!/usr/bin/env bash
# One command for local development on macOS / Linux / Git Bash:
#   ./start.sh
# Builds and starts the backend (http://localhost:8081), waits until it answers, then starts the
# frontend (http://localhost:5173). Ctrl+C stops both. Needs Java 17+, Maven and Node 22+.
set -euo pipefail
cd "$(dirname "$0")"

for tool in java mvn npm curl; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Missing '$tool'. Install it and try again."; exit 1; }
done

[ -f frontend/.env ] || cp frontend/.env.example frontend/.env
[ -d frontend/node_modules ] || (cd frontend && npm install)

echo "Building the backend..."
(cd backend && mvn -B -q -DskipTests package)
JAR=$(ls backend/target/dsa-platform-*.jar | head -n 1)

# Started from backend/ so the default H2 database lives in backend/data.
(cd backend && exec java -jar "../$JAR") &
BACKEND_PID=$!
cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Waiting for the backend on http://localhost:8081 ..."
until curl -sf http://localhost:8081/api/users >/dev/null; do
  kill -0 "$BACKEND_PID" 2>/dev/null || { echo "The backend stopped during startup."; exit 1; }
  sleep 2
done

echo "Backend is up. Starting the frontend: open http://localhost:5173"
cd frontend
npm run dev
