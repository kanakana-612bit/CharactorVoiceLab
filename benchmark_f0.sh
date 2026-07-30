#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="$ROOT_DIR/runtime/mm/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "CharacterVoiceDesigner runtime is not installed. Run ./webui.sh first." >&2
  exit 1
fi
exec "$PYTHON_BIN" "$ROOT_DIR/seed_f0_benchmark.py" "$@"
