// Coordinates stay in the game's existing percentage space and movement bounds.
export function clampTarget(x, y) {
  return { x: Math.max(10, Math.min(90, x)), y: Math.max(21, Math.min(88, y)) };
}

export function pointInStage(rect, clientX, clientY) {
  if (!rect.width || !rect.height) return null;
  return clampTarget((clientX - rect.left) / rect.width * 100, (clientY - rect.top) / rect.height * 100);
}

export function dragTarget(rect, anchor, clientX, clientY) {
  if (!rect.width || !rect.height) return null;
  return clampTarget(anchor.playerX + (clientX - anchor.clientX) / rect.width * 100,
    anchor.playerY + (clientY - anchor.clientY) / rect.height * 100);
}

// A target is a walking destination, never a teleport or a speed boost.
export function walkToward(x, y, target, delta) {
  const dx = target.x - x, dy = target.y - y;
  const distance = Math.hypot(dx, dy);
  const step = Math.max(0, Math.min(.035, delta)) * 39;
  const ratio = distance ? Math.min(1, step / distance) : 0;
  return { x: x + dx * ratio, y: y + dy * ratio, dx: dx * ratio, dy: dy * ratio, arrived: distance <= step };
}
