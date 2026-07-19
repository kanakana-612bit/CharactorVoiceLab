#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "$0")" && pwd -P)"
exec bash "$PROJECT_ROOT/scripts/stop_webui.sh" "$@"
