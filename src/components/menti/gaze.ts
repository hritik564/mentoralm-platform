type Point = { x: number; y: number };

/** Target the existing pupil group through its established 2.4px / 1.8px limits. */
export function mentiGazeToward(source: Point, target: Point) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy) || 1;
  return { x: (dx / distance) * 2.4, y: (dy / distance) * 1.8 };
}
