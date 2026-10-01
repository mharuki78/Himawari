export const PACK_SECONDS = 12;
export const WRONG_POCKET_SECONDS = 2;

export function campusResultTitle({ lives, packItems, packed }) {
  if (lives <= 0) return '모험이 끝났어요. 다시 도전해요.';
  if (!packItems.length) return '이번엔 물건을 모으지 못했어요.';
  if (packed.size === packItems.length) return '오늘의 가방이 완성됐어요.';
  return '다음엔 가방을 끝까지 채워봐요.';
}

// Progress changes pressure, not movement speed or the control geometry.
export function campusDifficulty(elapsed = 0, reducedMotion = false) {
  const progress = Math.max(0, Math.min(1, (Number.isFinite(elapsed) ? elapsed : 0) / 35));
  return {
    maxObjects: 9,
    goodChance: .62 - .10 * progress,
    fallSpeed: reducedMotion ? 0 : 12 + 7 * progress,
    spawnInterval: reducedMotion ? 1100 : 620 - 200 * progress,
  };
}
