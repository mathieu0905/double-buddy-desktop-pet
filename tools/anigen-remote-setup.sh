#!/usr/bin/env bash
set -euo pipefail

cd /data/zhihao/models/AniGen
source .venv311/bin/activate
export ANIGEN_PYTHON="$PWD/.venv311/bin/python"
source ./setup.sh --torch --basic --tsinghua
