import assert from 'node:assert/strict';

// User-authorized extra afternoon editions; bounds apply to the publication
// date so these archived editions still validate after the schedule expires.
export const isTwiceDailyDate = date => date >= '2026-10-03' && date <= '2026-10-07';

export function validateStoryCount(date, count, expectedCount = 3) {
  assert.ok(expectedCount === 3 || (isTwiceDailyDate(date) && expectedCount === 6), 'Invalid story edition target');
  assert.equal(count, expectedCount, `${date}: expected exactly ${expectedCount} posts, found ${count}`);
}

export function validateLookbookCount(date, count) {
  assert.ok(count === 2 || count === 3 || (isTwiceDailyDate(date) && count === 4), `${date}: expected 2–3 photos${isTwiceDailyDate(date) ? ' or 4 across two editions' : ''}`);
}
