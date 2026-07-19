#!/usr/bin/env bash
set -Eeuo pipefail

NO_BROWSER=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-browser)
      NO_BROWSER=1
      shift
      ;;
    *)
      echo "Unknown launcher option: $1" >&2
      exit 2
      ;;
  esac
done

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "CharacterVoiceDesigner webui.sh supports Linux only." >&2
  exit 1
fi
case "$(uname -m)" in
  x86_64 | aarch64 | arm64) ;;
  *)
    echo "Unsupported Linux architecture: $(uname -m). Use x86_64 or ARM64." >&2
    exit 1
    ;;
esac

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
RUNTIME_ROOT="$PROJECT_ROOT/runtime"
PYTHON_ROOT="$RUNTIME_ROOT/mm"
PYTHON_BIN="$PYTHON_ROOT/bin/python"
AUDIO_ROOT="$RUNTIME_ROOT/audio.cpp"
AUDIO_BUILD_ROOT="$RUNTIME_ROOT/audio.cpp-build/linux-cpu-gcc13-release"
AUDIO_SERVER="$AUDIO_BUILD_ROOT/bin/audiocpp_server"
LOCAL_TOOLCHAIN_ROOT="$RUNTIME_ROOT/toolchains/gcc13"
LOG_ROOT="$RUNTIME_ROOT/logs"
STATE_PATH="$RUNTIME_ROOT/webui.state.json"
UV_ROOT="$RUNTIME_ROOT/bootstrap/uv"
UV_BIN="$UV_ROOT/uv"

mkdir -p -- "$RUNTIME_ROOT" "$LOG_ROOT"

run_privileged() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    echo "Root access or sudo is required to install missing download tools." >&2
    return 1
  fi
}

confirm_base_install() {
  if [[ "${CVD_AUTO_INSTALL_SYSTEM_DEPS:-0}" == "1" ]]; then
    return 0
  fi
  if [[ ! -t 0 ]]; then
    echo "curl or wget and tar are required. Re-run interactively or set CVD_AUTO_INSTALL_SYSTEM_DEPS=1." >&2
    return 1
  fi
  local answer
  read -r -p "Download/build tools are missing. Install the required system packages now? [Y/n] " answer
  [[ -z "$answer" || "$answer" =~ ^[Yy]$ ]]
}

install_base_tools() {
  confirm_base_install || return 1
  if command -v apt-get >/dev/null 2>&1; then
    run_privileged apt-get update
    run_privileged apt-get install -y curl ca-certificates tar
  elif command -v dnf >/dev/null 2>&1; then
    run_privileged dnf install -y curl ca-certificates tar
  elif command -v pacman >/dev/null 2>&1; then
    run_privileged pacman -S --needed --noconfirm curl ca-certificates tar
  elif command -v zypper >/dev/null 2>&1; then
    run_privileged zypper --non-interactive install curl ca-certificates tar
  else
    echo "No supported package manager was found. Install curl or wget, ca-certificates, and tar." >&2
    return 1
  fi
}

if { ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; } ||
  ! command -v tar >/dev/null 2>&1; then
  install_base_tools
fi

download_file() {
  local url="$1"
  local destination="$2"
  if command -v curl >/dev/null 2>&1; then
    curl --fail --location --retry 3 --proto '=https' --tlsv1.2 --output "$destination" "$url"
  else
    wget --https-only --tries=3 --output-document="$destination" "$url"
  fi
}

python_is_ready() {
  [[ -x "$PYTHON_BIN" ]] &&
    "$PYTHON_BIN" -c 'import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 12) else 1)' >/dev/null 2>&1
}

if python_is_ready; then
  echo "[1/4] Local Python is ready."
else
  mkdir -p -- "$UV_ROOT"
  if [[ ! -x "$UV_BIN" ]]; then
    UV_INSTALLER="$RUNTIME_ROOT/bootstrap/uv-install.sh"
    echo "[1/4] Downloading the official uv installer..."
    download_file "https://astral.sh/uv/install.sh" "$UV_INSTALLER"
    UV_UNMANAGED_INSTALL="$UV_ROOT" UV_NO_MODIFY_PATH=1 sh "$UV_INSTALLER"
  fi
  if [[ ! -x "$UV_BIN" ]]; then
    echo "uv installation did not produce $UV_BIN" >&2
    exit 1
  fi
  export UV_PYTHON_INSTALL_DIR="$RUNTIME_ROOT/python"
  export UV_CACHE_DIR="$RUNTIME_ROOT/uv-cache"
  echo "[1/4] Installing project-local Python 3.12..."
  "$UV_BIN" venv "$PYTHON_ROOT" --python 3.12 --seed
  if ! python_is_ready; then
    echo "The project-local Python environment is incomplete: $PYTHON_BIN" >&2
    exit 1
  fi
fi

echo "[2/4] Preparing audio.cpp, the VoiceDesign model, and F0 correction dependencies..."
bash "$SCRIPT_DIR/setup_audio_cpp.sh" \
  --audio-root "$AUDIO_ROOT" \
  --python "$PYTHON_BIN" \
  --release-tag "release-0.3-qwen3-tts"

DESIGNER_REVISION="$(
  "$PYTHON_BIN" - "$PROJECT_ROOT/designer_server.py" "$PROJECT_ROOT/audio_postprocess.py" <<'PY'
from hashlib import sha256
import sys

digest = sha256()
for path in sys.argv[1:]:
    with open(path, "rb") as handle:
        digest.update(handle.read())
print(digest.hexdigest())
PY
)"

http_ok() {
  local url="$1"
  local expected="${2:-}"
  "$PYTHON_BIN" - "$url" "$expected" <<'PY' >/dev/null 2>&1
import sys
import urllib.request

url, expected = sys.argv[1:3]
try:
    with urllib.request.urlopen(url, timeout=2) as response:
        body = response.read(1024 * 1024).decode("utf-8", "replace")
        ok = 200 <= response.status < 300 and (not expected or expected in body)
except Exception:
    ok = False
raise SystemExit(0 if ok else 1)
PY
}

find_free_port() {
  "$PYTHON_BIN" - "$1" <<'PY'
import socket
import sys

preferred = int(sys.argv[1])
for port in range(preferred, preferred + 101):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            continue
        print(port)
        raise SystemExit(0)
raise SystemExit(f"No free local port was found near {preferred}")
PY
}

process_start_ticks() {
  local pid="$1"
  [[ -r "/proc/$pid/stat" ]] || return 1
  awk '{print $22}' "/proc/$pid/stat"
}

process_matches() {
  local pid="$1"
  local expected_ticks="$2"
  local expected_exe="$3"
  [[ "$pid" =~ ^[0-9]+$ && -n "$expected_ticks" && -e "/proc/$pid/exe" ]] || return 1
  [[ "$(process_start_ticks "$pid")" == "$expected_ticks" ]] || return 1
  [[ "$(readlink -f -- "/proc/$pid/exe")" == "$(readlink -f -- "$expected_exe")" ]]
}

stop_verified_process() {
  local pid="$1"
  local expected_ticks="$2"
  local expected_exe="$3"
  process_matches "$pid" "$expected_ticks" "$expected_exe" || return 0
  kill "$pid" 2>/dev/null || true
  local deadline=$((SECONDS + 10))
  while ((SECONDS < deadline)); do
    process_matches "$pid" "$expected_ticks" "$expected_exe" || return 0
    sleep 0.2
  done
  echo "The previous CharacterVoiceDesigner process did not stop: PID $pid" >&2
  return 1
}

wait_for_service() {
  local url="$1"
  local expected="$2"
  local timeout="$3"
  local pid="$4"
  local error_log="$5"
  local deadline=$((SECONDS + timeout))
  while ((SECONDS < deadline)); do
    if http_ok "$url" "$expected"; then
      return 0
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "A local service exited during startup." >&2
      [[ -f "$error_log" ]] && tail -n 30 -- "$error_log" >&2
      return 1
    fi
    sleep 0.5
  done
  echo "Timed out waiting for $url. See $error_log" >&2
  return 1
}

PREVIOUS_AUDIO_PORT=""
PREVIOUS_AUDIO_PID=""
PREVIOUS_AUDIO_TICKS=""
PREVIOUS_DESIGNER_PORT=""
PREVIOUS_DESIGNER_PID=""
PREVIOUS_DESIGNER_TICKS=""
PREVIOUS_DESIGNER_REVISION=""
if [[ -f "$STATE_PATH" ]]; then
  mapfile -t STATE_VALUES < <(
    "$PYTHON_BIN" - "$STATE_PATH" <<'PY'
import json
import sys

try:
    state = json.loads(open(sys.argv[1], encoding="utf-8").read())
except Exception:
    state = {}
for key in (
    "audio_cpp_port",
    "audio_cpp_pid",
    "audio_cpp_start_ticks",
    "designer_port",
    "designer_pid",
    "designer_start_ticks",
    "designer_revision",
):
    value = state.get(key)
    print("" if value is None else value)
PY
  )
  PREVIOUS_AUDIO_PORT="${STATE_VALUES[0]:-}"
  PREVIOUS_AUDIO_PID="${STATE_VALUES[1]:-}"
  PREVIOUS_AUDIO_TICKS="${STATE_VALUES[2]:-}"
  PREVIOUS_DESIGNER_PORT="${STATE_VALUES[3]:-}"
  PREVIOUS_DESIGNER_PID="${STATE_VALUES[4]:-}"
  PREVIOUS_DESIGNER_TICKS="${STATE_VALUES[5]:-}"
  PREVIOUS_DESIGNER_REVISION="${STATE_VALUES[6]:-}"
fi

NEW_AUDIO_PID=""
NEW_DESIGNER_PID=""
cleanup_failed_start() {
  local exit_code=$?
  trap - ERR
  [[ -n "$NEW_DESIGNER_PID" ]] && kill "$NEW_DESIGNER_PID" 2>/dev/null || true
  [[ -n "$NEW_AUDIO_PID" ]] && kill "$NEW_AUDIO_PID" 2>/dev/null || true
  exit "$exit_code"
}
trap cleanup_failed_start ERR

if [[ -n "$PREVIOUS_AUDIO_PORT" ]] &&
  process_matches "$PREVIOUS_AUDIO_PID" "$PREVIOUS_AUDIO_TICKS" "$AUDIO_SERVER" &&
  http_ok "http://127.0.0.1:$PREVIOUS_AUDIO_PORT/health"; then
  AUDIO_PORT="$PREVIOUS_AUDIO_PORT"
  AUDIO_PID="$PREVIOUS_AUDIO_PID"
  AUDIO_TICKS="$PREVIOUS_AUDIO_TICKS"
  echo "[3/4] Reusing audio.cpp on port $AUDIO_PORT."
else
  AUDIO_PORT="$(find_free_port 8080)"
  AUDIO_CONFIG="$AUDIO_ROOT/server.character_voice_designer.json"
  "$PYTHON_BIN" - "$AUDIO_CONFIG" "$AUDIO_PORT" "$AUDIO_ROOT/models/Irodori-TTS-600M-v3-VoiceDesign" <<'PY'
import json
import sys

path, port, model_path = sys.argv[1:4]
config = {
    "host": "127.0.0.1",
    "port": int(port),
    "backend": "cpu",
    "device": 0,
    "threads": 4,
    "lazy_load": True,
    "models": [{
        "id": "irodori-vdes",
        "family": "irodori_tts",
        "path": model_path,
        "task": "vdes",
        "mode": "offline",
    }],
}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(config, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
PY
  AUDIO_OUT_LOG="$LOG_ROOT/audio_cpp.stdout.log"
  AUDIO_ERROR_LOG="$LOG_ROOT/audio_cpp.stderr.log"
  echo "[3/4] Starting audio.cpp on port $AUDIO_PORT..."
  (
    cd -- "$AUDIO_ROOT"
    if [[ -d "$LOCAL_TOOLCHAIN_ROOT/lib" ]]; then
      export LD_LIBRARY_PATH="$LOCAL_TOOLCHAIN_ROOT/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
    fi
    exec nohup "$AUDIO_SERVER" --config "$AUDIO_CONFIG"
  ) >"$AUDIO_OUT_LOG" 2>"$AUDIO_ERROR_LOG" </dev/null &
  NEW_AUDIO_PID=$!
  AUDIO_PID="$NEW_AUDIO_PID"
  AUDIO_TICKS="$(process_start_ticks "$AUDIO_PID")"
  wait_for_service "http://127.0.0.1:$AUDIO_PORT/health" "" 60 "$AUDIO_PID" "$AUDIO_ERROR_LOG"
fi

PYTHON_REAL="$(readlink -f -- "$PYTHON_BIN")"
if [[ -n "$PREVIOUS_DESIGNER_PORT" ]] &&
  [[ "$PREVIOUS_DESIGNER_REVISION" == "$DESIGNER_REVISION" ]] &&
  process_matches "$PREVIOUS_DESIGNER_PID" "$PREVIOUS_DESIGNER_TICKS" "$PYTHON_REAL" &&
  http_ok "http://127.0.0.1:$PREVIOUS_DESIGNER_PORT/api/runtime/health" '"psola_available": true'; then
  DESIGNER_PORT="$PREVIOUS_DESIGNER_PORT"
  DESIGNER_PID="$PREVIOUS_DESIGNER_PID"
  DESIGNER_TICKS="$PREVIOUS_DESIGNER_TICKS"
  echo "[4/4] Reusing CharacterVoiceDesigner on port $DESIGNER_PORT."
else
  stop_verified_process "$PREVIOUS_DESIGNER_PID" "$PREVIOUS_DESIGNER_TICKS" "$PYTHON_REAL"
  DESIGNER_PORT="$(find_free_port 8765)"
  DESIGNER_OUT_LOG="$LOG_ROOT/designer.stdout.log"
  DESIGNER_ERROR_LOG="$LOG_ROOT/designer.stderr.log"
  echo "[4/4] Starting CharacterVoiceDesigner on port $DESIGNER_PORT..."
  (
    cd -- "$PROJECT_ROOT"
    if [[ -d "$LOCAL_TOOLCHAIN_ROOT/lib" ]]; then
      export LD_LIBRARY_PATH="$LOCAL_TOOLCHAIN_ROOT/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
    fi
    exec nohup "$PYTHON_BIN" -u "$PROJECT_ROOT/designer_server.py" \
      --host 127.0.0.1 \
      --port "$DESIGNER_PORT" \
      --audio-cpp-url "http://127.0.0.1:$AUDIO_PORT"
  ) >"$DESIGNER_OUT_LOG" 2>"$DESIGNER_ERROR_LOG" </dev/null &
  NEW_DESIGNER_PID=$!
  DESIGNER_PID="$NEW_DESIGNER_PID"
  DESIGNER_TICKS="$(process_start_ticks "$DESIGNER_PID")"
  wait_for_service "http://127.0.0.1:$DESIGNER_PORT/" "CharacterVoiceDesigner" 30 "$DESIGNER_PID" "$DESIGNER_ERROR_LOG"
fi

"$PYTHON_BIN" - "$STATE_PATH" "$AUDIO_PORT" "$AUDIO_PID" "$AUDIO_TICKS" "$DESIGNER_PORT" "$DESIGNER_PID" "$DESIGNER_TICKS" "$AUDIO_SERVER" "$PYTHON_REAL" "$DESIGNER_REVISION" <<'PY'
from datetime import datetime, timezone
import json
import sys

(
    state_path,
    audio_port,
    audio_pid,
    audio_ticks,
    designer_port,
    designer_pid,
    designer_ticks,
    audio_exe,
    python_exe,
    designer_revision,
) = sys.argv[1:]
state = {
    "app": "CharacterVoiceDesigner",
    "schema_version": "webui_runtime_state_linux_0.1",
    "audio_cpp_port": int(audio_port),
    "audio_cpp_pid": int(audio_pid),
    "audio_cpp_start_ticks": audio_ticks,
    "audio_cpp_executable": audio_exe,
    "designer_port": int(designer_port),
    "designer_pid": int(designer_pid),
    "designer_start_ticks": designer_ticks,
    "designer_executable": python_exe,
    "designer_revision": designer_revision,
    "updated_at": datetime.now(timezone.utc).isoformat(),
}
with open(state_path, "w", encoding="utf-8") as handle:
    json.dump(state, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
PY

trap - ERR
NEW_AUDIO_PID=""
NEW_DESIGNER_PID=""
WEBUI_URL="http://127.0.0.1:$DESIGNER_PORT/"
echo
echo "CharacterVoiceDesigner is ready: $WEBUI_URL"
echo "Run ./stop_webui.sh to stop services started by this launcher."

if [[ "$NO_BROWSER" -eq 0 ]] && command -v xdg-open >/dev/null 2>&1 &&
  [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then
  nohup xdg-open "$WEBUI_URL" >/dev/null 2>&1 </dev/null &
fi
