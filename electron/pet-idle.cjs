const REST_DELAY = Object.freeze({ min: 14_000, max: 24_000 });
const ACTIVITY_DELAY = Object.freeze({ min: 90_000, max: 210_000 });
const EDGE_TRANSITION_MS = 720;

function randomDelay(range, random = Math.random) {
  return range.min + Math.round(random() * (range.max - range.min));
}

function nextRestDelay(random) {
  return randomDelay(REST_DELAY, random);
}

function nextActivityDelay(petCount = 1, random = Math.random) {
  const crowdFactor = Math.max(1, Number(petCount) * 0.75);
  return Math.round(randomDelay(ACTIVITY_DELAY, random) * crowdFactor);
}

function occasionalAction(random = Math.random) {
  const roll = random();
  if (roll < 0.45) return "walk";
  if (roll < 0.57) return "stretch";
  if (roll < 0.68) return "wave";
  if (roll < 0.82) return "jump";
  if (roll < 0.94) return "dance";
  return "run";
}

function foldedPosition(bounds, area, slot = 0) {
  const visibleStrip = Math.min(90, Math.max(48, Math.round(bounds.width * 0.24)));
  const areaRight = area.x + area.width;
  const boundsCenter = bounds.x + bounds.width / 2;
  const areaCenter = area.x + area.width / 2;
  const side = boundsCenter <= areaCenter ? "left" : "right";
  const x = side === "left"
    ? area.x - bounds.width + visibleStrip
    : areaRight - visibleStrip;
  const baseline = area.y + area.height - bounds.height - 8;
  const y = Math.max(area.y - 10, baseline - Math.max(0, slot % 4) * 54);
  return { x: Math.round(x), y: Math.round(y), side };
}

module.exports = {
  ACTIVITY_DELAY,
  EDGE_TRANSITION_MS,
  REST_DELAY,
  foldedPosition,
  nextActivityDelay,
  nextRestDelay,
  occasionalAction,
  randomDelay
};
