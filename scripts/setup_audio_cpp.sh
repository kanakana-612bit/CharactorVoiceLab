#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
AUDIO_ROOT="$PROJECT_ROOT/runtime/audio.cpp"
PYTHON_BIN=""
RELEASE_TAG="release-0.3-qwen3-tts"
PINNED_SOURCE_SHA256="fd50dc3d331357886dd0e6475e4060c165351dfcf5d33ceaa083766285c1ce59"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --audio-root)
      AUDIO_ROOT="$2"
      shift 2
      ;;
    --python)
      PYTHON_BIN="$2"
      shift 2
      ;;
    --release-tag)
      RELEASE_TAG="$2"
      shift 2
      ;;
    *)
      echo "Unknown setup option: $1" >&2
      exit 2
      ;;
  esac
done

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This setup script supports Linux only." >&2
  exit 1
fi
if [[ ! "$RELEASE_TAG" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "The audio.cpp release tag contains unsupported characters." >&2
  exit 1
fi
if [[ -z "$PYTHON_BIN" || ! -x "$PYTHON_BIN" ]]; then
  echo "A project-local Python executable is required: $PYTHON_BIN" >&2
  exit 1
fi

AUDIO_ROOT="$(mkdir -p -- "$AUDIO_ROOT" && cd -- "$AUDIO_ROOT" && pwd -P)"
RUNTIME_ROOT="$(cd -- "$AUDIO_ROOT/.." && pwd -P)"
SOURCE_ROOT="$RUNTIME_ROOT/audio.cpp-source"
BUILD_ROOT="$RUNTIME_ROOT/audio.cpp-build/linux-cpu-release"
SERVER_BIN="$BUILD_ROOT/bin/audiocpp_server"
MODELS_ROOT="$AUDIO_ROOT/models"
VENV_BIN="$(cd -- "$(dirname -- "$PYTHON_BIN")" && pwd -P)"

download_file() {
  local url="$1"
  local destination="$2"
  if command -v curl >/dev/null 2>&1; then
    curl --fail --location --retry 3 --proto '=https' --tlsv1.2 --output "$destination" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget --https-only --tries=3 --output-document="$destination" "$url"
  else
    echo "curl or wget is required to download audio.cpp." >&2
    return 1
  fi
}

run_privileged() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    echo "Root access or sudo is required to install the missing compiler." >&2
    return 1
  fi
}

confirm_system_install() {
  if [[ "${CVD_AUTO_INSTALL_SYSTEM_DEPS:-0}" == "1" ]]; then
    return 0
  fi
  if [[ ! -t 0 ]]; then
    echo "GCC 13 or newer is missing. Re-run interactively or set CVD_AUTO_INSTALL_SYSTEM_DEPS=1." >&2
    return 1
  fi
  local answer
  read -r -p "GCC 13 or newer is required. Install system build packages now? [Y/n] " answer
  [[ -z "$answer" || "$answer" =~ ^[Yy]$ ]]
}

install_system_compiler() {
  confirm_system_install || return 1
  if command -v apt-get >/dev/null 2>&1; then
    run_privileged apt-get update
    if ! run_privileged apt-get install -y gcc-13 g++-13 make curl ca-certificates tar; then
      run_privileged apt-get install -y build-essential curl ca-certificates tar
    fi
  elif command -v dnf >/dev/null 2>&1; then
    run_privileged dnf install -y gcc gcc-c++ make curl ca-certificates tar
  elif command -v pacman >/dev/null 2>&1; then
    run_privileged pacman -S --needed --noconfirm base-devel curl ca-certificates tar
  elif command -v zypper >/dev/null 2>&1; then
    run_privileged zypper --non-interactive install gcc13 gcc13-c++ make curl ca-certificates tar
  else
    echo "No supported package manager was found. Install GCC/G++ 13 or newer, make, curl, ca-certificates, and tar." >&2
    return 1
  fi
}

compiler_major() {
  "$1" -dumpfullversion -dumpversion 2>/dev/null | awk -F. 'NR == 1 { print $1 }'
}

select_compiler() {
  local candidate major suffix cc_candidate
  for candidate in g++-15 g++-14 g++-13 g++; do
    command -v "$candidate" >/dev/null 2>&1 || continue
    major="$(compiler_major "$candidate")"
    [[ "$major" =~ ^[0-9]+$ ]] || continue
    ((major >= 13)) || continue
    suffix="${candidate#g++}"
    cc_candidate="gcc${suffix}"
    command -v "$cc_candidate" >/dev/null 2>&1 || continue
    CVD_CC="$(command -v "$cc_candidate")"
    CVD_CXX="$(command -v "$candidate")"
    return 0
  done
  return 1
}

if [[ ! -x "$SERVER_BIN" ]]; then
  if ! select_compiler; then
    install_system_compiler
    if ! select_compiler; then
      echo "A supported compiler was not found after package installation. audio.cpp requires GCC/G++ 13 or newer." >&2
      exit 1
    fi
  fi

  if ! command -v tar >/dev/null 2>&1; then
    echo "tar is required to unpack the audio.cpp source archive." >&2
    exit 1
  fi

  if [[ ! -f "$SOURCE_ROOT/CMakeLists.txt" ]]; then
    mkdir -p -- "$SOURCE_ROOT"
    if find "$SOURCE_ROOT" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
      echo "The audio.cpp source directory is incomplete: $SOURCE_ROOT" >&2
      exit 1
    fi
    SOURCE_ARCHIVE="$RUNTIME_ROOT/audio.cpp-$RELEASE_TAG-source.tar.gz"
    echo "Downloading audio.cpp source $RELEASE_TAG..."
    download_file "https://github.com/0xShug0/audio.cpp/archive/refs/tags/$RELEASE_TAG.tar.gz" "$SOURCE_ARCHIVE"
    if [[ "$RELEASE_TAG" == "release-0.3-qwen3-tts" ]]; then
      "$PYTHON_BIN" - "$SOURCE_ARCHIVE" "$PINNED_SOURCE_SHA256" <<'PY'
from hashlib import sha256
from pathlib import Path
import sys

archive = Path(sys.argv[1])
expected = sys.argv[2].lower()
digest = sha256()
with archive.open("rb") as handle:
    for chunk in iter(lambda: handle.read(1024 * 1024), b""):
        digest.update(chunk)
actual = digest.hexdigest()
if actual != expected:
    raise SystemExit(f"audio.cpp source SHA-256 mismatch: expected {expected}, got {actual}")
PY
    fi
    tar -xzf "$SOURCE_ARCHIVE" --strip-components=1 -C "$SOURCE_ROOT"
    rm -f -- "$SOURCE_ARCHIVE"
  fi
fi

if ! "$PYTHON_BIN" -c "import torch, safetensors, yaml, numpy, pyworld, parselmouth" >/dev/null 2>&1 ||
  [[ ! -x "$VENV_BIN/cmake" || ! -x "$VENV_BIN/ninja" ]]; then
  echo "Installing model-manager, build, and F0-correction dependencies..."
  "$PYTHON_BIN" -m pip install --upgrade pip
  "$PYTHON_BIN" -m pip install torch safetensors PyYAML numpy pyworld praat-parselmouth cmake ninja
fi

if [[ ! -x "$SERVER_BIN" ]]; then
  JOBS="${CVD_BUILD_JOBS:-}"
  if [[ -z "$JOBS" ]]; then
    JOBS="$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)"
    ((JOBS > 4)) && JOBS=4
    ((JOBS < 1)) && JOBS=1
  fi
  echo "Building the portable audio.cpp CPU server with $CVD_CXX ($JOBS jobs)..."
  (
    cd -- "$SOURCE_ROOT"
    PATH="$VENV_BIN:$PATH" CC="$CVD_CC" CXX="$CVD_CXX" \
      bash ./scripts/build_linux.sh \
      --backend cpu \
      --native-cpu OFF \
      --llamafile OFF \
      --deployment-build \
      --build-dir "$BUILD_ROOT" \
      --jobs "$JOBS" \
      --target audiocpp_server
  )
fi

if [[ ! -x "$SERVER_BIN" ]]; then
  echo "audio.cpp build completed without producing $SERVER_BIN" >&2
  exit 1
fi

mkdir -p -- "$MODELS_ROOT"
REQUIRED_MODELS=(
  "$MODELS_ROOT/Irodori-TTS-600M-v3-VoiceDesign/model.safetensors"
  "$MODELS_ROOT/llm-jp-3-150m/model.safetensors"
  "$MODELS_ROOT/Semantic-DACVAE-Japanese-32dim/weights.safetensors"
)
MODELS_READY=1
for model_file in "${REQUIRED_MODELS[@]}"; do
  [[ -f "$model_file" ]] || MODELS_READY=0
done

if [[ "$MODELS_READY" -eq 0 ]]; then
  echo "Installing the Japanese VoiceDesign model..."
  (
    cd -- "$SOURCE_ROOT"
    "$PYTHON_BIN" ./tools/model_manager.py install irodori_tts_600m_v3_voice_design --models-root "$MODELS_ROOT"
  )
else
  echo "Japanese VoiceDesign model already exists; skipping model download."
fi

UNUSED_SAMPLE_ROOT="$MODELS_ROOT/Irodori-TTS-600M-v3-VoiceDesign/samples"
if [[ -d "$UNUSED_SAMPLE_ROOT" ]]; then
  "$PYTHON_BIN" - "$MODELS_ROOT" "$UNUSED_SAMPLE_ROOT" <<'PY'
from pathlib import Path
import shutil
import sys

models_root = Path(sys.argv[1]).resolve()
sample_root = Path(sys.argv[2]).resolve()
expected = models_root / "Irodori-TTS-600M-v3-VoiceDesign" / "samples"
if sample_root != expected or models_root not in sample_root.parents:
    raise SystemExit("Refusing to remove an unexpected sample path")
shutil.rmtree(sample_root)
PY
fi

echo "audio.cpp Linux setup completed: $SERVER_BIN"
