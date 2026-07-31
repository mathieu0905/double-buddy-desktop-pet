#!/usr/bin/env bash
set -euo pipefail

MODELS_DIR=/data/zhihao/models
ANIGEN_DIR="$MODELS_DIR/AniGen"
PYTHON_BIN="$ANIGEN_DIR/.venv311/bin/python"
LOG_FILE="$ANIGEN_DIR/setup-fix.log"

exec > >(tee -a "$LOG_FILE") 2>&1

export CUDA_HOME=/usr/local/cuda
export PATH="$CUDA_HOME/bin:$PATH"
export FORCE_CUDA=1
export MAX_JOBS="${MAX_JOBS:-8}"

cd "$MODELS_DIR"
if [[ ! -d nvdiffrast/.git ]]; then
  git clone --depth 1 https://github.com/NVlabs/nvdiffrast.git
fi

cd "$ANIGEN_DIR"
uv pip install --python "$PYTHON_BIN" "$MODELS_DIR/nvdiffrast" --no-build-isolation

source .venv311/bin/activate
export ANIGEN_PYTHON="$PYTHON_BIN"
source ./setup.sh --basic --tsinghua

"$PYTHON_BIN" - <<'PY'
import torch
import pytorch3d
import spconv.pytorch as spconv
import nvdiffrast.torch as dr

print("torch", torch.__version__)
print("cuda", torch.version.cuda, torch.cuda.is_available())
print("pytorch3d", pytorch3d.__file__)
print("spconv", spconv.__file__)
print("nvdiffrast", dr.__file__)
print("ANIGEN_ENV_OK")
PY
