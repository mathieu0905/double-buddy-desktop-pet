const BASE_PET_WINDOW = Object.freeze({ width: 280, height: 370 });
const MIN_PET_SCALE = 0.7;
const MAX_PET_SCALE = 1.6;
const PET_SCALE_STEP = 0.1;

function clampPetScale(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.round(Math.min(MAX_PET_SCALE, Math.max(MIN_PET_SCALE, numeric)) * 100) / 100;
}

function petWindowSize(scale) {
  const normalized = clampPetScale(scale);
  return {
    width: Math.round(BASE_PET_WINDOW.width * normalized),
    height: Math.round(BASE_PET_WINDOW.height * normalized)
  };
}

function scaledPetBounds(bounds, scale, workArea) {
  const size = petWindowSize(scale);
  const centeredX = bounds.x + (bounds.width - size.width) / 2;
  const bottomAlignedY = bounds.y + bounds.height - size.height;
  const minX = workArea.x - 40;
  const maxX = workArea.x + workArea.width - size.width + 40;
  const minY = workArea.y - 10;
  const maxY = workArea.y + workArea.height - size.height + 70;

  return {
    x: Math.round(Math.min(maxX, Math.max(minX, centeredX))),
    y: Math.round(Math.min(maxY, Math.max(minY, bottomAlignedY))),
    ...size
  };
}

module.exports = {
  BASE_PET_WINDOW,
  MIN_PET_SCALE,
  MAX_PET_SCALE,
  PET_SCALE_STEP,
  clampPetScale,
  petWindowSize,
  scaledPetBounds
};
