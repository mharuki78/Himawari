import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { productsForGuideChapter, matchesGuideChapter } from '../assets/guidebook-tools.js';
import { filterStories } from '../story/discovery-tools.js';

const guide = JSON.parse(await readFile(new URL('../data/guidebook-specs-2026.json', import.meta.url)));

test('guidebook product links use confirmed page mappings and keep size overrides separate', () => {
  const products = [
    { id: 'regular', model: 'No.1884', name: 'No.1884 블랙', specs: { weight: '1050 g' } },
    { id: 'store-13641866477', model: 'No.1884', name: 'No.1884 블랙M', specs: { weight: '910 g' } },
    { id: 'unknown', model: 'No.18840', name: '다른 가방' },
    { id: 'pending', model: 'No.1084H', name: '대응 확인 중인 모델' },
  ];
  const groups = productsForGuideChapter(products, { page: 29 }, guide);
  assert.deepEqual(groups.map(group => group.model), ['No.1884', 'No.1884M']);
  assert.equal(groups[0].variants[0].specs.weight, '1050 g');
  assert.equal(groups[1].variants[0].id, 'store-13641866477');
  assert.deepEqual(productsForGuideChapter(products, { page: 44 }, guide), []);
  assert.deepEqual(productsForGuideChapter(products, { page: 1 }, guide), []);
  assert.equal(matchesGuideChapter({ page: 29, title: 'No.1884L / 1884M' }, 'No. 1884', guide), true);
  assert.equal(matchesGuideChapter({ page: 44, title: 'No.H1084' }, '1084H', guide), false);
});

test('story discovery combines topic and all search terms, and reset restores every story', () => {
  const posts = [
    { title: '비 오는 출근길', summary: '젖은 가방 관리', tags: ['퇴근'] },
    { title: '통학 준비', summary: '학생 책가방 정리', tags: ['학교'] },
    { title: '주말 여행', summary: '공항과 기내 수납' },
    { title: '브랜드 이야기', summary: '가방을 만드는 마음' },
  ];
  assert.deepEqual(filterStories(posts, { category: 'commute', query: '가방 관리' }), [posts[0]]);
  assert.deepEqual(filterStories(posts, { category: 'school', query: '여행' }), []);
  assert.deepEqual(filterStories(posts, { category: 'care' }), [posts[0]]);
  assert.deepEqual(filterStories(posts, { category: 'all', query: '' }), posts);
  assert.deepEqual(filterStories(posts, { query: '없는 검색어' }), []);
});
