#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
RUNTIME_ROOT="$PROJECT_ROOT/runtime/speaker_inversion"
SOURCE_ROOT="$RUNTIME_ROOT/Irodori-TTS"
MODEL_ROOT="$RUNTIME_ROOT/models/Irodori-TTS-v4-Small"
ENVIRONMENT_PATH="$RUNTIME_ROOT/environment.json"
DIAGNOSTICS_PATH="$RUNTIME_ROOT/cuda-diagnostics.json"
CUDA_PROBE="$PROJECT_ROOT/speaker_inversion_cuda_probe.py"
OUTPUT_ROOT=""
UV_BIN="$PROJECT_ROOT/runtime/bootstrap/uv/uv"
UPSTREAM_REPOSITORY="https://github.com/Aratako/Irodori-TTS.git"
UPSTREAM_COMMIT="d48dd92b943fa5dbcb88150eb974c25d8709df9b"
MODEL_REPOSITORY="Aratako/Irodori-TTS-v4-Small"

write_environment() {
  local state="$1"
  (
    cd -- "$SOURCE_ROOT"
    "$UV_BIN" run --no-sync python -c \
      'import json,pathlib,sys; d=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")); e={"schema_version":"cvd_speaker_inversion_environment_0.2","upstream_repository":sys.argv[3],"upstream_commit":sys.argv[4],"model_repository":sys.argv[5],"dependency_extra":"cu128","state":sys.argv[6],"cuda":d,"local_only_after_model_download":True}; pathlib.Path(sys.argv[2]).write_text(json.dumps(e,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")' \
      "$DIAGNOSTICS_PATH" "$ENVIRONMENT_PATH.tmp" "$UPSTREAM_REPOSITORY" "$UPSTREAM_COMMIT" "$MODEL_REPOSITORY" "$state"
  )
  mv -- "$ENVIRONMENT_PATH.tmp" "$ENVIRONMENT_PATH"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      OUTPUT_ROOT="$2"
      shift 2
      ;;
    *)
      echo "Unknown setup option: $1" >&2
      exit 2
      ;;
  esac
done

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "Speaker Inversion training setup currently supports Linux only." >&2
  exit 1
fi
if [[ ! -x "$UV_BIN" ]]; then
  echo "Project-local uv is missing. Run ./webui.sh once before this setup." >&2
  exit 1
fi
if ! command -v git >/dev/null 2>&1; then
  echo "git is required to install the pinned official Irodori-TTS source." >&2
  exit 1
fi
if [[ ! -f "$CUDA_PROBE" ]]; then
  echo "Speaker Inversion CUDA diagnostics are missing from this application build." >&2
  exit 1
fi

mkdir -p -- "$RUNTIME_ROOT" "$MODEL_ROOT"
cat > "$ENVIRONMENT_PATH.tmp" <<JSON
{
  "schema_version": "cvd_speaker_inversion_environment_0.2",
  "upstream_repository": "$UPSTREAM_REPOSITORY",
  "upstream_commit": "$UPSTREAM_COMMIT",
  "model_repository": "$MODEL_REPOSITORY",
  "dependency_extra": "cu128",
  "state": "configuring",
  "cuda": {"ready": false, "message": "Environment setup has not completed."},
  "local_only_after_model_download": true
}
JSON
mv -- "$ENVIRONMENT_PATH.tmp" "$ENVIRONMENT_PATH"
if [[ ! -d "$SOURCE_ROOT/.git" ]]; then
  if [[ -e "$SOURCE_ROOT" ]]; then
    echo "$SOURCE_ROOT exists but is not a git checkout." >&2
    exit 1
  fi
  echo "[progress 0/4] Cloning official Irodori-TTS"
  git clone --filter=blob:none "$UPSTREAM_REPOSITORY" "$SOURCE_ROOT"
fi

echo "[progress 1/4] Pinning official source commit"
git -C "$SOURCE_ROOT" fetch --depth 1 origin "$UPSTREAM_COMMIT"
git -C "$SOURCE_ROOT" checkout --detach "$UPSTREAM_COMMIT"

export UV_CACHE_DIR="$PROJECT_ROOT/runtime/uv-cache"
echo "[progress 2/4] Installing the isolated CUDA 12.8 training environment"
(
  cd -- "$SOURCE_ROOT"
  "$UV_BIN" sync --extra cu128 --frozen
)

echo "[diagnostic] Verifying that the locked PyTorch wheel includes CUDA"
if ! (
  cd -- "$SOURCE_ROOT"
  "$UV_BIN" run --no-sync python "$CUDA_PROBE" --require-cuda-wheel
); then
  echo "[repair] Reinstalling the locked CUDA PyTorch packages"
  (
    cd -- "$SOURCE_ROOT"
    "$UV_BIN" sync --extra cu128 --frozen \
      --reinstall-package torch \
      --reinstall-package torchaudio
  )
fi

echo "[diagnostic] Verifying GPU visibility and a CUDA tensor allocation"
if ! (
  cd -- "$SOURCE_ROOT"
  "$UV_BIN" run --no-sync python "$CUDA_PROBE" \
    --output "$DIAGNOSTICS_PATH" \
    --require-cuda
); then
  write_environment "failed"
  exit 1
fi

echo "[progress 3/4] Downloading the official v4-Small checkpoint"
(
  cd -- "$SOURCE_ROOT"
  "$UV_BIN" run --no-sync python -c \
    'import pathlib,sys; from huggingface_hub import hf_hub_download; p=pathlib.Path(sys.argv[1]); p.mkdir(parents=True,exist_ok=True); print(hf_hub_download(repo_id=sys.argv[2],filename="model.safetensors",local_dir=str(p)))' \
    "$MODEL_ROOT" "$MODEL_REPOSITORY"
)

write_environment "ready"

if [[ -n "$OUTPUT_ROOT" ]]; then
  mkdir -p -- "$OUTPUT_ROOT"
  cp -- "$ENVIRONMENT_PATH" "$OUTPUT_ROOT/summary.json"
fi
echo "[progress 4/4] Speaker Inversion environment is ready"
