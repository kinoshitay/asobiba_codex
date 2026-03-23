#!/bin/zsh
set -euo pipefail

PORT="${1:-8000}"
cd "/Users/yosihikokinoshita/Documents/New project"
exec python3 -m http.server "$PORT"
