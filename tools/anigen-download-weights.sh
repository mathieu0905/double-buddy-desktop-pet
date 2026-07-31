#!/usr/bin/env bash
set -euo pipefail

ANIGEN_DIR=/data/zhihao/models/AniGen
HF_BIN=/data/zhihao/models/.hfenv313/bin/hf
export HF_ENDPOINT=https://hf-mirror.com

cd "$ANIGEN_DIR"
"$HF_BIN" download VAST-AI/AniGen \
  --include "ckpts/dinov2/**" \
  --include "ckpts/dsine/**" \
  --include "ckpts/vgg/**" \
  --include "ckpts/anigen/ss_dae/**" \
  --include "ckpts/anigen/slat_dae/**" \
  --include "ckpts/anigen/ss_flow_duet/**" \
  --include "ckpts/anigen/slat_flow_auto/**" \
  --local-dir "$ANIGEN_DIR"
