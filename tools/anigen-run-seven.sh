#!/usr/bin/env bash
set -euo pipefail

ANIGEN_DIR=/data/zhihao/models/AniGen
INPUT_DIR="$ANIGEN_DIR/inputs/pets"
OUTPUT_DIR="$ANIGEN_DIR/results"

cd "$ANIGEN_DIR"
source .venv311/bin/activate
export CUDA_VISIBLE_DEVICES="${CUDA_VISIBLE_DEVICES:-0}"

python example.py \
  --image_path "$INPUT_DIR" \
  --output_dir "$OUTPUT_DIR" \
  --output_name pets \
  --ss_flow_path ckpts/anigen/ss_flow_duet \
  --slat_flow_path ckpts/anigen/slat_flow_auto \
  --seed 42
