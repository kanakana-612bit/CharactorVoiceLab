#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
PYTHON_BIN="$PROJECT_ROOT/runtime/mm/bin/python"
STATE_PATH="$PROJECT_ROOT/runtime/webui.state.json"

STATE_VALUES=("" "" "" "" "" "" "")
if [[ -f "$STATE_PATH" ]]; then
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
    "designer_port",
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
else
  echo "No launcher state was found; checking for project-owned orphan processes."
fi

DESIGNER_PORT="${STATE_VALUES[0]:-}"
DESIGNER_PID="${STATE_VALUES[1]:-}"
DESIGNER_TICKS="${STATE_VALUES[2]:-}"
DESIGNER_EXE="${STATE_VALUES[3]:-}"
AUDIO_PID="${STATE_VALUES[4]:-}"
AUDIO_TICKS="${STATE_VALUES[5]:-}"
AUDIO_EXE="${STATE_VALUES[6]:-}"
HAD_WARNING=0

if [[ -n "${DESIGNER_PID:-}" && -n "${DESIGNER_PORT:-}" ]]; then
  "$PYTHON_BIN" - "$DESIGNER_PORT" <<'PY' >/dev/null 2>&1 || true
import sys
import urllib.request

request = urllib.request.Request(
    f"http://127.0.0.1:{sys.argv[1]}/api/audio-cpp/stop",
    data=b"{}",
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(request, timeout=5):
    pass
PY
fi

process_start_ticks() {
  local pid="$1"
  [[ -r "/proc/$pid/stat" ]] || return 1
  awk '{print $22}' "/proc/$pid/stat"
}

process_has_exact_arg() {
  local pid="$1"
  local expected="$2"
  local argument=""
  [[ -n "$expected" && -r "/proc/$pid/cmdline" ]] || return 1
  while IFS= read -r -d '' argument; do
    [[ "$argument" == "$expected" ]] && return 0
  done < "/proc/$pid/cmdline"
  return 1
}

process_is_project_audio_cpp() {
  local pid="$1"
  local executable=""
  [[ -r "/proc/$pid/cmdline" ]] || return 1
  IFS= read -r -d '' executable < "/proc/$pid/cmdline" || true
  [[ "$executable" == "$PROJECT_ROOT/runtime/"*"/bin/audiocpp_server" ]]
}

process_matches() {
  local pid="$1"
  local expected_ticks="$2"
  local expected_exe="$3"
  local expected_arg="${4:-}"
  local actual_exe=""
  local expected_real=""
  [[ "$pid" =~ ^[0-9]+$ && -n "$expected_ticks" && -e "/proc/$pid/exe" ]] || return 1
  [[ "$(process_start_ticks "$pid")" == "$expected_ticks" ]] || return 1
  actual_exe="$(readlink -f -- "/proc/$pid/exe")"
  expected_real="$(readlink -f -- "$expected_exe" 2>/dev/null || true)"
  if [[ -n "$expected_real" && "$actual_exe" == "$expected_real" ]]; then
    return 0
  fi
  process_has_exact_arg "$pid" "$expected_arg"
}

stop_recorded_process() {
  local label="$1"
  local pid="$2"
  local ticks="$3"
  local executable="$4"
  local expected_arg="${5:-}"
  if [[ -z "$pid" || -z "$ticks" || -z "$executable" ]]; then
    echo "$label has no launcher-owned process record and will not be stopped."
    return 0
  fi
  if [[ ! -d "/proc/$pid" ]]; then
    echo "$label is already stopped."
    return 0
  fi
  if ! process_matches "$pid" "$ticks" "$executable" "$expected_arg"; then
    echo "Refusing to stop PID $pid because it no longer matches the recorded $label process." >&2
    return 0
  fi
  kill "$pid"
  for _ in {1..50}; do
    if ! process_matches "$pid" "$ticks" "$executable" "$expected_arg"; then
      echo "Stopped $label (PID $pid)."
      return 0
    fi
    sleep 0.1
  done
  if process_matches "$pid" "$ticks" "$executable" "$expected_arg"; then
    kill -KILL "$pid"
  fi
  for _ in {1..20}; do
    if ! process_matches "$pid" "$ticks" "$executable" "$expected_arg"; then
      echo "Stopped $label (PID $pid)."
      return 0
    fi
    sleep 0.1
  done
  echo "Failed to stop $label (PID $pid)." >&2
  HAD_WARNING=1
}

stop_discovered_process() {
  local label="$1"
  local pid="$2"
  local expected_arg="${3:-}"
  local ticks=""
  local executable=""
  [[ -d "/proc/$pid" ]] || return 0
  ticks="$(process_start_ticks "$pid" 2>/dev/null || true)"
  executable="$(readlink -f -- "/proc/$pid/exe" 2>/dev/null || true)"
  [[ -n "$ticks" && -n "$executable" ]] || return 0
  stop_recorded_process "$label" "$pid" "$ticks" "$executable" "$expected_arg"
}

stop_project_orphans() {
  local proc=""
  local pid=""
  for proc in /proc/[0-9]*; do
    pid="${proc##*/}"
    if process_has_exact_arg "$pid" "$PROJECT_ROOT/designer_server.py"; then
      stop_discovered_process "orphaned CharacterVoiceDesigner" "$pid" "$PROJECT_ROOT/designer_server.py"
    fi
  done
  for proc in /proc/[0-9]*; do
    pid="${proc##*/}"
    if process_is_project_audio_cpp "$pid"; then
      stop_discovered_process "orphaned audio.cpp" "$pid"
    fi
  done
}

stop_recorded_process \
  "CharacterVoiceDesigner" "$DESIGNER_PID" "$DESIGNER_TICKS" "$DESIGNER_EXE" \
  "$PROJECT_ROOT/designer_server.py"
stop_recorded_process "audio.cpp" "$AUDIO_PID" "$AUDIO_TICKS" "$AUDIO_EXE" "$AUDIO_EXE"
stop_project_orphans
rm -f -- "$STATE_PATH"

exit "$HAD_WARNING"
