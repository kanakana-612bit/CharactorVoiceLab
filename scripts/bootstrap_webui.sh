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
AUDIO_BUILD_ROOT=""
AUDIO_SERVER=""
LOCAL_TOOLCHAIN_ROOT="$RUNTIME_ROOT/toolchains/gcc13"
PINNED_CUDA_TOOLKIT_VERSION="12.8"
PINNED_CUDA_TOOLKIT_NODOT="${PINNED_CUDA_TOOLKIT_VERSION//./}"
CUDA_TOOLKIT_ROOT="$RUNTIME_ROOT/toolchains/cuda${PINNED_CUDA_TOOLKIT_NODOT}"
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

RUNTIME_CONFIG_JSON="$(
  "$PYTHON_BIN" "$SCRIPT_DIR/linux_runtime_config.py" \
    --requested-backend "${CVD_BACKEND:-auto}" \
    --threads "${CVD_INFERENCE_THREADS:-}" \
    --cuda-architectures "${CVD_CUDA_ARCHITECTURES:-}"
)"
mapfile -t RUNTIME_VALUES < <(
  "$PYTHON_BIN" - "$RUNTIME_CONFIG_JSON" <<'PY'
import json
import sys

config = json.loads(sys.argv[1])
for key in (
    "backend",
    "device",
    "threads",
    "cuda_architectures",
    "gpu_name",
    "gpu_memory_mib",
    "gpu_free_memory_mib",
    "driver_version",
    "selection_reason",
):
    print(config.get(key, ""))
PY
)
AUDIO_BACKEND="${RUNTIME_VALUES[0]}"
AUDIO_DEVICE="${RUNTIME_VALUES[1]}"
INFERENCE_THREADS="${RUNTIME_VALUES[2]}"
CUDA_ARCHITECTURES="${RUNTIME_VALUES[3]}"
GPU_NAME="${RUNTIME_VALUES[4]}"
GPU_MEMORY_MIB="${RUNTIME_VALUES[5]}"
GPU_FREE_MEMORY_MIB="${RUNTIME_VALUES[6]}"
NVIDIA_DRIVER_VERSION="${RUNTIME_VALUES[7]}"
RUNTIME_SELECTION_REASON="${RUNTIME_VALUES[8]}"

if [[ "$AUDIO_BACKEND" == "cuda" ]]; then
  CUDA_TOOLKIT_VERSION="$PINNED_CUDA_TOOLKIT_VERSION"
  CUDA_ARCHITECTURE_TAG="${CUDA_ARCHITECTURES//;/_}"
  AUDIO_BUILD_ROOT="$RUNTIME_ROOT/audio.cpp-build/linux-cuda${PINNED_CUDA_TOOLKIT_NODOT}-sm${CUDA_ARCHITECTURE_TAG}-gcc13-native-release"
else
  CUDA_TOOLKIT_VERSION=""
  AUDIO_BUILD_ROOT="$RUNTIME_ROOT/audio.cpp-build/linux-cpu-gcc13-native-release"
fi
AUDIO_SERVER="$AUDIO_BUILD_ROOT/bin/audiocpp_server"

configure_runtime_library_path() {
  local include_cuda="${1:-0}"
  local library_path
  if [[ -d "$LOCAL_TOOLCHAIN_ROOT/lib" ]]; then
    export LD_LIBRARY_PATH="$LOCAL_TOOLCHAIN_ROOT/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  fi
  [[ "$AUDIO_BACKEND" == "cuda" && "$include_cuda" == "1" ]] || return 0
  export CUDA_HOME="$CUDA_TOOLKIT_ROOT"
  export PATH="$CUDA_TOOLKIT_ROOT/bin:$PATH"
  for library_path in \
    "$CUDA_TOOLKIT_ROOT/lib" \
    "$CUDA_TOOLKIT_ROOT/lib64" \
    "$CUDA_TOOLKIT_ROOT/targets/x86_64-linux/lib"; do
    if [[ -d "$library_path" ]]; then
      export LD_LIBRARY_PATH="$library_path${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
    fi
  done
}

echo "[2/4] $RUNTIME_SELECTION_REASON"
echo "[2/4] Preparing audio.cpp, the VoiceDesign model, and F0 correction dependencies..."
SETUP_ARGS=(
  --audio-root "$AUDIO_ROOT"
  --python "$PYTHON_BIN"
  --release-tag "release-0.3-qwen3-tts"
  --backend "$AUDIO_BACKEND"
)
if [[ "$AUDIO_BACKEND" == "cuda" ]]; then
  SETUP_ARGS+=(
    --cuda-architectures "$CUDA_ARCHITECTURES"
    --cuda-version "$PINNED_CUDA_TOOLKIT_VERSION"
  )
fi
if ! bash "$SCRIPT_DIR/setup_audio_cpp.sh" "${SETUP_ARGS[@]}"; then
  echo "audio.cpp setup failed. Re-run scripts/setup_audio_cpp.sh with bash -x for detailed diagnostics." >&2
  exit 1
fi

AUDIO_RUNTIME_CONFIG="$RUNTIME_ROOT/audio_cpp.runtime.json"
configure_runtime_library_path 1
"$PYTHON_BIN" - \
  "$AUDIO_RUNTIME_CONFIG" "$PROJECT_ROOT" "$AUDIO_ROOT" "$AUDIO_SERVER" "$LOG_ROOT" \
  "$INFERENCE_THREADS" "$AUDIO_DEVICE" "$RUNTIME_CONFIG_JSON" "${LD_LIBRARY_PATH:-}" <<'PY'
import json
import sys

(
    destination,
    project_root,
    audio_root,
    executable,
    log_root,
    threads,
    default_device,
    runtime_json,
    library_path,
) = sys.argv[1:]
runtime = json.loads(runtime_json)
devices = [{
    "id": "cpu",
    "label": "CPU only",
    "backend": "cpu",
    "physical_index": None,
    "memory_mib": 0,
    "free_memory_mib": 0,
}]
for gpu in runtime.get("gpus", []):
    devices.append({
        "id": f"cuda:{gpu['index']}",
        "label": f"GPU {gpu['index']} / {gpu['name']} ({gpu['memory_mib']} MiB)",
        "backend": "cuda",
        "physical_index": gpu["index"],
        "name": gpu["name"],
        "memory_mib": gpu["memory_mib"],
        "free_memory_mib": gpu["free_memory_mib"],
        "compute_capability": gpu["compute_capability"],
        "driver_version": gpu["driver_version"],
    })
default_id = f"cuda:{default_device}" if runtime.get("backend") == "cuda" else "cpu"
manifest = {
    "schema_version": "cvd_audio_cpp_runtime_manifest_0.1",
    "project_root": project_root,
    "executable": executable,
    "working_directory": audio_root,
    "log_root": log_root,
    "preferred_port": 8080,
    "threads": int(threads),
    "default_device": default_id,
    "devices": devices,
    "models": [{
        "id": "irodori-vdes",
        "label": "Irodori VoiceDesign / Japanese",
        "family": "irodori_tts",
        "path": f"{audio_root}/models/Irodori-TTS-600M-v3-VoiceDesign",
        "task": "vdes",
        "mode": "offline",
    }],
    "environment": {"LD_LIBRARY_PATH": library_path} if library_path else {},
}
with open(destination, "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
PY

DESIGNER_REVISION="$(
  "$PYTHON_BIN" - \
    "$PROJECT_ROOT/designer_server.py" \
    "$PROJECT_ROOT/audio_cpp_runtime.py" \
    "$PROJECT_ROOT/audio_postprocess.py" \
    "$AUDIO_RUNTIME_CONFIG" <<'PY'
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

stop_verified_process() {
  local pid="$1"
  local expected_ticks="$2"
  local expected_exe="$3"
  local expected_arg="${4:-}"
  process_matches "$pid" "$expected_ticks" "$expected_exe" "$expected_arg" || return 0
  kill "$pid" 2>/dev/null || true
  local deadline=$((SECONDS + 10))
  while ((SECONDS < deadline)); do
    process_matches "$pid" "$expected_ticks" "$expected_exe" "$expected_arg" || return 0
    sleep 0.2
  done
  if process_matches "$pid" "$expected_ticks" "$expected_exe" "$expected_arg"; then
    kill -KILL "$pid" 2>/dev/null || true
  fi
  local kill_deadline=$((SECONDS + 2))
  while ((SECONDS < kill_deadline)); do
    process_matches "$pid" "$expected_ticks" "$expected_exe" "$expected_arg" || return 0
    sleep 0.1
  done
  echo "The previous CharacterVoiceDesigner process did not stop: PID $pid" >&2
  return 1
}

stop_orphaned_services() {
  local proc=""
  local pid=""
  local ticks=""
  local executable=""
  for proc in /proc/[0-9]*; do
    pid="${proc##*/}"
    if process_has_exact_arg "$pid" "$PROJECT_ROOT/designer_server.py"; then
      ticks="$(process_start_ticks "$pid" 2>/dev/null || true)"
      executable="$(readlink -f -- "/proc/$pid/exe" 2>/dev/null || true)"
      [[ -n "$ticks" && -n "$executable" ]] || continue
      echo "[4/4] Stopping orphaned CharacterVoiceDesigner process $pid..."
      stop_verified_process "$pid" "$ticks" "$executable" "$PROJECT_ROOT/designer_server.py"
    fi
  done
  for proc in /proc/[0-9]*; do
    pid="${proc##*/}"
    if process_is_project_audio_cpp "$pid"; then
      ticks="$(process_start_ticks "$pid" 2>/dev/null || true)"
      executable="$(readlink -f -- "/proc/$pid/exe" 2>/dev/null || true)"
      [[ -n "$ticks" && -n "$executable" ]] || continue
      echo "[4/4] Stopping orphaned audio.cpp process $pid..."
      stop_verified_process "$pid" "$ticks" "$executable" "$executable"
    fi
  done
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
PREVIOUS_AUDIO_EXE=""
PREVIOUS_AUDIO_BACKEND=""
PREVIOUS_AUDIO_DEVICE=""
PREVIOUS_AUDIO_THREADS=""
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
    "audio_cpp_executable",
    "audio_cpp_backend",
    "audio_cpp_device",
    "audio_cpp_threads",
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
  PREVIOUS_AUDIO_EXE="${STATE_VALUES[3]:-}"
  PREVIOUS_AUDIO_BACKEND="${STATE_VALUES[4]:-}"
  PREVIOUS_AUDIO_DEVICE="${STATE_VALUES[5]:-}"
  PREVIOUS_AUDIO_THREADS="${STATE_VALUES[6]:-}"
  PREVIOUS_DESIGNER_PORT="${STATE_VALUES[7]:-}"
  PREVIOUS_DESIGNER_PID="${STATE_VALUES[8]:-}"
  PREVIOUS_DESIGNER_TICKS="${STATE_VALUES[9]:-}"
  PREVIOUS_DESIGNER_REVISION="${STATE_VALUES[10]:-}"
fi

NEW_DESIGNER_PID=""
cleanup_failed_start() {
  local exit_code=$?
  trap - ERR
  [[ -n "$NEW_DESIGNER_PID" ]] && kill "$NEW_DESIGNER_PID" 2>/dev/null || true
  exit "$exit_code"
}
trap cleanup_failed_start ERR

if [[ -n "$PREVIOUS_AUDIO_EXE" ]]; then
  stop_verified_process "$PREVIOUS_AUDIO_PID" "$PREVIOUS_AUDIO_TICKS" "$PREVIOUS_AUDIO_EXE" "$PREVIOUS_AUDIO_EXE"
fi
echo "[3/4] audio.cpp is installed and will start after model/device selection."

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
  if [[ -n "$PREVIOUS_DESIGNER_PORT" ]]; then
    "$PYTHON_BIN" - "$PREVIOUS_DESIGNER_PORT" <<'PY' >/dev/null 2>&1 || true
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
  stop_verified_process \
    "$PREVIOUS_DESIGNER_PID" "$PREVIOUS_DESIGNER_TICKS" "$PYTHON_REAL" \
    "$PROJECT_ROOT/designer_server.py"
  stop_orphaned_services
  DESIGNER_PORT="$(find_free_port 8765)"
  DESIGNER_OUT_LOG="$LOG_ROOT/designer.stdout.log"
  DESIGNER_ERROR_LOG="$LOG_ROOT/designer.stderr.log"
  echo "[4/4] Starting CharacterVoiceDesigner on port $DESIGNER_PORT..."
  (
    cd -- "$PROJECT_ROOT"
    configure_runtime_library_path 1
    exec nohup "$PYTHON_BIN" -u "$PROJECT_ROOT/designer_server.py" \
      --host 127.0.0.1 \
      --port "$DESIGNER_PORT" \
      --audio-cpp-runtime-config "$AUDIO_RUNTIME_CONFIG"
  ) >"$DESIGNER_OUT_LOG" 2>"$DESIGNER_ERROR_LOG" </dev/null &
  NEW_DESIGNER_PID=$!
  DESIGNER_PID="$NEW_DESIGNER_PID"
  DESIGNER_TICKS="$(process_start_ticks "$DESIGNER_PID")"
  wait_for_service "http://127.0.0.1:$DESIGNER_PORT/" "CharacterVoiceDesigner" 30 "$DESIGNER_PID" "$DESIGNER_ERROR_LOG"
fi

"$PYTHON_BIN" - \
  "$STATE_PATH" \
  "$AUDIO_RUNTIME_CONFIG" "$AUDIO_SERVER" "$AUDIO_BACKEND" "$AUDIO_DEVICE" "$INFERENCE_THREADS" \
  "$CUDA_TOOLKIT_VERSION" "$CUDA_ARCHITECTURES" \
  "$GPU_NAME" "$GPU_MEMORY_MIB" "$GPU_FREE_MEMORY_MIB" "$NVIDIA_DRIVER_VERSION" \
  "$DESIGNER_PORT" "$DESIGNER_PID" "$DESIGNER_TICKS" \
  "$PYTHON_REAL" "$DESIGNER_REVISION" <<'PY'
from datetime import datetime, timezone
import json
import sys

(
    state_path,
    audio_runtime_config,
    audio_exe,
    audio_backend,
    audio_device,
    audio_threads,
    cuda_toolkit_version,
    cuda_architectures,
    gpu_name,
    gpu_memory_mib,
    gpu_free_memory_mib,
    nvidia_driver_version,
    designer_port,
    designer_pid,
    designer_ticks,
    python_exe,
    designer_revision,
) = sys.argv[1:]
state = {
    "app": "CharacterVoiceDesigner",
    "schema_version": "webui_runtime_state_linux_0.3",
    "audio_cpp_runtime_config": audio_runtime_config,
    "audio_cpp_executable": audio_exe,
    "audio_cpp_backend": audio_backend,
    "audio_cpp_device": int(audio_device),
    "audio_cpp_threads": int(audio_threads),
    "cuda_toolkit_version": cuda_toolkit_version or None,
    "cuda_architectures": cuda_architectures or None,
    "gpu_name": gpu_name or None,
    "gpu_memory_mib": int(gpu_memory_mib or 0),
    "gpu_free_memory_mib_at_startup": int(gpu_free_memory_mib or 0),
    "nvidia_driver_version": nvidia_driver_version or None,
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
NEW_DESIGNER_PID=""
WEBUI_URL="http://127.0.0.1:$DESIGNER_PORT/"
echo
echo "CharacterVoiceDesigner is ready: $WEBUI_URL"
echo "Run ./stop_webui.sh to stop services started by this launcher."

if [[ "$NO_BROWSER" -eq 0 ]] && command -v xdg-open >/dev/null 2>&1 &&
  [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then
  nohup xdg-open "$WEBUI_URL" >/dev/null 2>&1 </dev/null &
fi
