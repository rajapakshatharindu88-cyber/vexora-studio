#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${VEXORA_PORT:-4173}"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required to serve the offline web app." >&2
  exit 1
fi
if command -v xdg-open >/dev/null 2>&1; then
  (sleep 1; xdg-open "http://127.0.0.1:${PORT}/" >/dev/null 2>&1 || true) &
fi
cd "$ROOT"
echo "Starting VEXORA Studio at http://127.0.0.1:${PORT}/"
echo "Press Ctrl+C to stop the local server. No network service is contacted."
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT/web"
