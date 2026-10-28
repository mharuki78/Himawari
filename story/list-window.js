import { filterStories } from './discovery-tools.js';

export const STORY_PAGE_SIZE = 12;

export function getStoryWindow(posts, { query = '', category = 'all' } = {}, page = 1) {
  const filtered = filterStories(Array.isArray(posts) ? posts : [], { query, category })
    .sort((first, second) => String(second.date || '').localeCompare(String(first.date || '')));
  const currentPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const shown = Math.min(filtered.length, currentPage * STORY_PAGE_SIZE);
  const remaining = filtered.length - shown;
  return {
    posts: filtered.slice(0, shown),
    total: filtered.length,
    shown,
    remaining,
    nextCount: Math.min(STORY_PAGE_SIZE, remaining),
  };
}
