#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -x "$ROOT/runtime/mm/bin/python" ]]; then
  PYTHON="$ROOT/runtime/mm/bin/python"
else
  PYTHON="${PYTHON:-python3}"
fi
exec "$PYTHON" "$ROOT/verify_speaker_inversion.py" "$@"
