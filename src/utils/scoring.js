const STARTING_SPEED_POINTS = 500;
const MINIMUM_SPEED_POINTS = 25;
const POINTS_LOST_PER_SECOND = 10;

export function calculateSpeedPoints(elapsedTimeMs) {
  const elapsedSeconds = Math.max(0, elapsedTimeMs) / 1000;
  const points = STARTING_SPEED_POINTS - Math.floor(elapsedSeconds * POINTS_LOST_PER_SECOND);
  return Math.max(MINIMUM_SPEED_POINTS, points);
}
