import test from 'node:test';
import assert from 'node:assert/strict';
import { clampTarget, pointInStage, dragTarget, walkToward } from '../assets/game-pointer.mjs';

test('click/tap coordinates respect the field offset and existing collision bounds', () => {
  const rect = { left: 200, top: 100, width: 400, height: 600 };
  assert.deepEqual(pointInStage(rect, 400, 400), { x: 50, y: 50 });
  assert.deepEqual(pointInStage(rect, -100, 1000), { x: 10, y: 88 });
  assert.deepEqual(pointInStage(rect, 800, 0), { x: 90, y: 21 });
  assert.equal(pointInStage({ ...rect, width: 0 }, 400, 400), null);
});

test('touch drag preserves the initial finger offset instead of moving underneath it', () => {
  const rect = { left: 0, top: 100, width: 400, height: 600 };
  const anchor = { playerX: 50, playerY: 76, clientX: 80, clientY: 240 };
  assert.deepEqual(dragTarget(rect, anchor, 80, 240), { x: 50, y: 76 });
  assert.deepEqual(dragTarget(rect, anchor, 160, 120), { x: 70, y: 56 });
  assert.deepEqual(dragTarget(rect, anchor, 800, -800), { x: 90, y: 21 });
  assert.equal(dragTarget({ ...rect, height: 0 }, anchor, 80, 240), null);
});

test('pointer movement keeps the keyboard speed, diagonal normalization and frame cap', () => {
  const horizontal = walkToward(50, 76, clampTarget(90, 76), .02);
  const diagonal = walkToward(50, 76, clampTarget(90, 36), .02);
  assert.ok(Math.abs(horizontal.x - 50 - .78) < 1e-10);
  assert.ok(Math.abs(Math.hypot(diagonal.dx, diagonal.dy) - .78) < 1e-10);
  assert.ok(Math.abs(walkToward(50, 76, { x: 90, y: 76 }, 1).dx - 1.365) < 1e-10);
  assert.equal(horizontal.arrived, false);
});

test('arrival cannot overshoot or oscillate, and a zero-time frame stays still', () => {
  const target = { x: 50.2, y: 75.9 };
  const arrived = walkToward(50, 76, target, .02);
  assert.equal(arrived.x, target.x); assert.equal(arrived.y, target.y);
  assert.equal(arrived.arrived, true);
  const still = walkToward(arrived.x, arrived.y, target, .02);
  assert.equal(still.dx, 0); assert.equal(still.dy, 0);
  const zero = walkToward(50, 76, { x: 90, y: 21 }, 0);
  assert.equal(zero.x, 50); assert.equal(zero.y, 76); assert.equal(zero.arrived, false);
});
