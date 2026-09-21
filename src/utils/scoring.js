// A round opens at 1250 and ticks down 10 a second to a floor of 25. The rate
// and the floor are unchanged; only the opening value moved, so the reward for
// answering quickly is larger while the shape of the countdown is the same.
// The floor is now reached at 122.5s rather than 47.5s, so a slow round keeps
// yielding a falling score for longer instead of flattening early.
const STARTING_SPEED_POINTS = 1250;
const MINIMUM_SPEED_POINTS = 25;
const POINTS_LOST_PER_SECOND = 10;

export function calculateSpeedPoints(elapsedTimeMs) {
  const elapsedSeconds = Math.max(0, elapsedTimeMs) / 1000;
  const points = STARTING_SPEED_POINTS - Math.floor(elapsedSeconds * POINTS_LOST_PER_SECOND);
  return Math.max(MINIMUM_SPEED_POINTS, points);
}
