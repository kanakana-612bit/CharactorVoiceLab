#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
PYTHON_BIN="$PROJECT_ROOT/runtime/mm/bin/python"
STATE_PATH="$PROJECT_ROOT/runtime/webui.state.json"

if [[ ! -f "$STATE_PATH" ]]; then
  echo "No launcher-owned CharacterVoiceDesigner services are recorded."
  exit 0
fi
if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "The runtime Python needed to validate the service state is missing: $PYTHON_BIN" >&2
  exit 1
fi

mapfile -t STATE_VALUES < <(
  "$PYTHON_BIN" - "$STATE_PATH" <<'PY'
import json
import sys

state = json.loads(open(sys.argv[1], encoding="utf-8").read())
for key in (
    "designer_pid",
    "designer_start_ticks",
    "designer_executable",
    "audio_cpp_pid",
    "audio_cpp_start_ticks",
    "audio_cpp_executable",
):
    value = state.get(key)
    print("" if value is None else value)
PY
)

DESIGNER_PID="${STATE_VALUES[0]:-}"
DESIGNER_TICKS="${STATE_VALUES[1]:-}"
DESIGNER_EXE="${STATE_VALUES[2]:-}"
AUDIO_PID="${STATE_VALUES[3]:-}"
AUDIO_TICKS="${STATE_VALUES[4]:-}"
AUDIO_EXE="${STATE_VALUES[5]:-}"
HAD_WARNING=0

process_start_ticks() {
  local pid="$1"
  [[ -r "/proc/$pid/stat" ]] || return 1
  awk '{print $22}' "/proc/$pid/stat"
}

process_matches() {
  local pid="$1"
  local expected_ticks="$2"
  local expected_exe="$3"
  [[ "$pid" =~ ^[0-9]+$ && -n "$expected_ticks" && -n "$expected_exe" && -e "/proc/$pid/exe" ]] || return 1
  [[ "$(process_start_ticks "$pid")" == "$expected_ticks" ]] || return 1
  [[ "$(readlink -f -- "/proc/$pid/exe")" == "$(readlink -f -- "$expected_exe")" ]]
}

stop_recorded_process() {
  local label="$1"
  local pid="$2"
  local ticks="$3"
  local executable="$4"
  if [[ -z "$pid" || -z "$ticks" || -z "$executable" ]]; then
    echo "$label has no launcher-owned process record and will not be stopped."
    return 0
  fi
  if [[ ! -d "/proc/$pid" ]]; then
    echo "$label is already stopped."
    return 0
  fi
  if ! process_matches "$pid" "$ticks" "$executable"; then
    echo "Refusing to stop PID $pid because it no longer matches the recorded $label process." >&2
    HAD_WARNING=1
    return 0
  fi
  kill "$pid"
  for _ in {1..50}; do
    if ! process_matches "$pid" "$ticks" "$executable"; then
      echo "Stopped $label (PID $pid)."
      return 0
    fi
    sleep 0.1
  done
  if process_matches "$pid" "$ticks" "$executable"; then
    kill -KILL "$pid"
  fi
  echo "Stopped $label (PID $pid)."
}

stop_recorded_process "CharacterVoiceDesigner" "$DESIGNER_PID" "$DESIGNER_TICKS" "$DESIGNER_EXE"
stop_recorded_process "audio.cpp" "$AUDIO_PID" "$AUDIO_TICKS" "$AUDIO_EXE"
rm -f -- "$STATE_PATH"

exit "$HAD_WARNING"
