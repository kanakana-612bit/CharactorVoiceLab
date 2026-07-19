#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
AUDIO_ROOT="$PROJECT_ROOT/runtime/audio.cpp"
PYTHON_BIN=""
RELEASE_TAG="release-0.3-qwen3-tts"
BACKEND="cpu"
CUDA_ARCHITECTURES="native"
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
    --backend)
      BACKEND="$2"
      shift 2
      ;;
    --cuda-architectures)
      CUDA_ARCHITECTURES="$2"
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
if [[ "$BACKEND" != "cpu" && "$BACKEND" != "cuda" ]]; then
  echo "The Linux audio.cpp backend must be cpu or cuda: $BACKEND" >&2
  exit 1
fi
if [[ "$CUDA_ARCHITECTURES" != "native" && ! "$CUDA_ARCHITECTURES" =~ ^[0-9]{2,3}(\;[0-9]{2,3})*$ ]]; then
  echo "CUDA architectures must be 'native' or a semicolon-separated list such as '86'." >&2
  exit 1
fi
if [[ "$BACKEND" == "cuda" && "$(uname -m)" != "x86_64" ]]; then
  echo "The isolated CUDA 13.0 build currently supports Linux x86_64 only." >&2
  exit 1
fi
if [[ -z "$PYTHON_BIN" || ! -x "$PYTHON_BIN" ]]; then
  echo "A project-local Python executable is required: $PYTHON_BIN" >&2
  exit 1
fi

AUDIO_ROOT="$(mkdir -p -- "$AUDIO_ROOT" && cd -- "$AUDIO_ROOT" && pwd -P)"
RUNTIME_ROOT="$(cd -- "$AUDIO_ROOT/.." && pwd -P)"
SOURCE_ROOT="$RUNTIME_ROOT/audio.cpp-source"
if [[ "$BACKEND" == "cuda" ]]; then
  CUDA_ARCHITECTURE_TAG="${CUDA_ARCHITECTURES//;/_}"
  BUILD_ROOT="$RUNTIME_ROOT/audio.cpp-build/linux-cuda13-sm${CUDA_ARCHITECTURE_TAG}-gcc13-native-release"
else
  BUILD_ROOT="$RUNTIME_ROOT/audio.cpp-build/linux-cpu-gcc13-native-release"
fi
SERVER_BIN="$BUILD_ROOT/bin/audiocpp_server"
MODELS_ROOT="$AUDIO_ROOT/models"
VENV_BIN="$(cd -- "$(dirname -- "$PYTHON_BIN")" && pwd -P)"
MICROMAMBA_VERSION="2.8.1-0"
MICROMAMBA_ROOT="$RUNTIME_ROOT/bootstrap/micromamba"
MICROMAMBA_BIN="$MICROMAMBA_ROOT/micromamba"
MAMBA_CACHE_ROOT="$RUNTIME_ROOT/micromamba-root"
TOOLCHAIN_ROOT="$RUNTIME_ROOT/toolchains/gcc13"
CUDA_TOOLKIT_ROOT="$RUNTIME_ROOT/toolchains/cuda13"
CUDA_CHANNEL="nvidia/label/cuda-13.0.0"
PYWORLD_REQUIREMENT="pyworld==0.3.5"
SETUPTOOLS_REQUIREMENT="setuptools<81"

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

compiler_major() {
  "$1" -dumpfullversion -dumpversion 2>/dev/null | awk -F. 'NR == 1 { print $1 }'
}

select_system_compiler() {
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
    CVD_TOOLCHAIN_ROOT=""
    return 0
  done
  return 1
}

select_local_compiler() {
  local cc_candidate cxx_candidate major
  cc_candidate="$(find "$TOOLCHAIN_ROOT/bin" -maxdepth 1 \( -type f -o -type l \) -name '*-conda-linux-gnu-cc' -print -quit 2>/dev/null || true)"
  cxx_candidate="$(find "$TOOLCHAIN_ROOT/bin" -maxdepth 1 \( -type f -o -type l \) -name '*-conda-linux-gnu-c++' -print -quit 2>/dev/null || true)"
  [[ -x "$cc_candidate" && -x "$cxx_candidate" ]] || return 1
  major="$(compiler_major "$cxx_candidate")"
  [[ "$major" =~ ^[0-9]+$ ]] && ((major >= 13)) || return 1
  CVD_CC="$cc_candidate"
  CVD_CXX="$cxx_candidate"
  CVD_TOOLCHAIN_ROOT="$TOOLCHAIN_ROOT"
}

verify_sha256() {
  "$PYTHON_BIN" - "$1" "$2" <<'PY'
from hashlib import sha256
from pathlib import Path
import sys

source = Path(sys.argv[1])
expected = sys.argv[2].lower()
digest = sha256()
with source.open("rb") as handle:
    for chunk in iter(lambda: handle.read(1024 * 1024), b""):
        digest.update(chunk)
actual = digest.hexdigest()
if actual != expected:
    raise SystemExit(f"SHA-256 mismatch for {source.name}: expected {expected}, got {actual}")
PY
}

ensure_micromamba() {
  local architecture asset_name asset_sha
  architecture="$(uname -m)"
  case "$architecture" in
    x86_64)
      asset_name="micromamba-linux-64"
      asset_sha="9689782d863c05a1bf5d2d371ba527104e7a4eb4310c1637d8653b751aed9c82"
      ;;
    aarch64 | arm64)
      asset_name="micromamba-linux-aarch64"
      asset_sha="e5ba23b5945aa49dfd11022e592a510d2686a8feee810e00140b73c9fdf0ba2a"
      ;;
    *)
      echo "No project-local compiler package is configured for $architecture." >&2
      return 1
      ;;
  esac

  mkdir -p -- "$MICROMAMBA_ROOT"
  if [[ ! -x "$MICROMAMBA_BIN" ]]; then
    echo "Downloading micromamba $MICROMAMBA_VERSION for project-local toolchains..."
    download_file \
      "https://github.com/mamba-org/micromamba-releases/releases/download/$MICROMAMBA_VERSION/$asset_name" \
      "$MICROMAMBA_BIN"
    verify_sha256 "$MICROMAMBA_BIN" "$asset_sha"
    chmod 0755 "$MICROMAMBA_BIN"
  fi
}

install_local_compiler() {
  local architecture platform_suffix compiler_suffix
  architecture="$(uname -m)"
  case "$architecture" in
    x86_64)
      platform_suffix="64"
      compiler_suffix="64"
      ;;
    aarch64 | arm64)
      platform_suffix="aarch64"
      compiler_suffix="aarch64"
      ;;
    *)
      echo "No project-local compiler package is configured for $architecture." >&2
      return 1
      ;;
  esac

  ensure_micromamba
  echo "Installing a project-local GCC 13 toolchain; the system compiler will not be changed..."
  MAMBA_ROOT_PREFIX="$MAMBA_CACHE_ROOT" "$MICROMAMBA_BIN" create \
    --yes \
    --prefix "$TOOLCHAIN_ROOT" \
    --override-channels \
    --channel conda-forge \
    "gcc_linux-$compiler_suffix=13" \
    "gxx_linux-$compiler_suffix=13" \
    "sysroot_linux-$platform_suffix=2.17"
}

cuda_toolkit_ready() {
  [[ -x "$CUDA_TOOLKIT_ROOT/bin/nvcc" ]] &&
    "$CUDA_TOOLKIT_ROOT/bin/nvcc" --version 2>/dev/null | grep -q 'release 13\.0'
}

install_cuda_toolkit() {
  local action="create"
  ensure_micromamba
  if [[ -d "$CUDA_TOOLKIT_ROOT/conda-meta" ]]; then
    action="install"
  fi
  echo "Installing the project-local CUDA Toolkit 13.0; the NVIDIA driver and system CUDA will not be changed..."
  MAMBA_ROOT_PREFIX="$MAMBA_CACHE_ROOT" "$MICROMAMBA_BIN" "$action" \
    --yes \
    --prefix "$CUDA_TOOLKIT_ROOT" \
    --override-channels \
    --channel "$CUDA_CHANNEL" \
    cuda-libraries-dev \
    cuda-nvcc \
    cuda-nvtx \
    cuda-cupti
}

if [[ "$BACKEND" == "cuda" ]] && ! cuda_toolkit_ready; then
  install_cuda_toolkit
  if ! cuda_toolkit_ready; then
    echo "The isolated CUDA Toolkit must report release 13.0: $CUDA_TOOLKIT_ROOT/bin/nvcc" >&2
    exit 1
  fi
fi

if [[ ! -x "$SERVER_BIN" ]]; then
  CVD_TOOLCHAIN_ROOT=""
  if ! select_local_compiler && ! select_system_compiler; then
    install_local_compiler
    if ! select_local_compiler; then
      echo "The project-local GCC 13 toolchain could not be prepared." >&2
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
      verify_sha256 "$SOURCE_ARCHIVE" "$PINNED_SOURCE_SHA256"
    fi
    tar -xzf "$SOURCE_ARCHIVE" --strip-components=1 -C "$SOURCE_ROOT"
    rm -f -- "$SOURCE_ARCHIVE"
  fi
fi

postprocess_dependencies_ready() {
  (
    if [[ -d "$TOOLCHAIN_ROOT/lib" ]]; then
      export LD_LIBRARY_PATH="$TOOLCHAIN_ROOT/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
    fi
    "$PYTHON_BIN" "$PROJECT_ROOT/audio_postprocess.py" --check
  )
}

if ! "$PYTHON_BIN" -c "import torch, safetensors, yaml" >/dev/null 2>&1 ||
  ! postprocess_dependencies_ready >/dev/null 2>&1 ||
  [[ ! -x "$VENV_BIN/cmake" || ! -x "$VENV_BIN/ninja" ]]; then
  echo "Installing model-manager, build, and F0-correction dependencies..."
  "$PYTHON_BIN" -m pip install --upgrade pip
  "$PYTHON_BIN" -m pip install \
    "$SETUPTOOLS_REQUIREMENT" \
    torch safetensors PyYAML numpy "$PYWORLD_REQUIREMENT" praat-parselmouth cmake ninja
fi

if ! postprocess_dependencies_ready >/dev/null 2>&1; then
  echo "Repairing the local F0-correction dependencies..."
  "$PYTHON_BIN" -m pip install --upgrade --force-reinstall --no-cache-dir \
    "$SETUPTOOLS_REQUIREMENT" numpy "$PYWORLD_REQUIREMENT" praat-parselmouth
fi
if ! postprocess_dependencies_ready; then
  echo "The local PSOLA F0-correction runtime is incomplete. See the dependency diagnostics above." >&2
  exit 1
fi

if [[ ! -x "$SERVER_BIN" ]]; then
  JOBS="${CVD_BUILD_JOBS:-}"
  if [[ -z "$JOBS" ]]; then
    JOBS="$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)"
    ((JOBS > 4)) && JOBS=4
    ((JOBS < 1)) && JOBS=1
  fi
  echo "Building the optimized audio.cpp $BACKEND server with $CVD_CXX ($JOBS jobs)..."
  (
    cd -- "$SOURCE_ROOT"
    export PATH="$VENV_BIN:$PATH"
    export CC="$CVD_CC"
    export CXX="$CVD_CXX"
    if [[ -n "$CVD_TOOLCHAIN_ROOT" ]]; then
      export CONDA_PREFIX="$CVD_TOOLCHAIN_ROOT"
      export PATH="$CVD_TOOLCHAIN_ROOT/bin:$PATH"
      export LDFLAGS="-Wl,-rpath,$CVD_TOOLCHAIN_ROOT/lib ${LDFLAGS:-}"
    fi
    if [[ "$BACKEND" == "cuda" ]]; then
      export CUDA_HOME="$CUDA_TOOLKIT_ROOT"
      export CUDAToolkit_ROOT="$CUDA_TOOLKIT_ROOT"
      export CUDACXX="$CUDA_TOOLKIT_ROOT/bin/nvcc"
      export CUDAHOSTCXX="$CVD_CXX"
      export CUDAARCHS="$CUDA_ARCHITECTURES"
      export PATH="$CUDA_TOOLKIT_ROOT/bin:$PATH"
      export CMAKE_PREFIX_PATH="$CUDA_TOOLKIT_ROOT${CMAKE_PREFIX_PATH:+:$CMAKE_PREFIX_PATH}"
      for cuda_lib in \
        "$CUDA_TOOLKIT_ROOT/targets/x86_64-linux/lib" \
        "$CUDA_TOOLKIT_ROOT/lib64" \
        "$CUDA_TOOLKIT_ROOT/lib"; do
        if [[ -d "$cuda_lib" ]]; then
          export LD_LIBRARY_PATH="$cuda_lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
          export LIBRARY_PATH="$cuda_lib${LIBRARY_PATH:+:$LIBRARY_PATH}"
          export LDFLAGS="-Wl,-rpath,$cuda_lib ${LDFLAGS:-}"
        fi
      done
    fi
    bash ./scripts/build_linux.sh \
      --backend "$BACKEND" \
      --native-cpu ON \
      --llamafile ON \
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
