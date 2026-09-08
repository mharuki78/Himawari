import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_REELS,
  MAX_REEL_POSTER_SIZE,
  MAX_REEL_VIDEO_SIZE,
  classifyReelPath,
  defaultReelsConfig,
  normalizeReelsConfig,
  publicReels,
  validateNewReel,
} from '../api/_lib/reels.js';

const requestId = '9b3571c6-66cb-4f30-85a7-79ca7486054e';

test('기본 홈 영상과 영상 업로드 제한을 유지한다', () => {
  assert.equal(defaultReelsConfig().reels.length, 8);
  assert.equal(MAX_REELS, 12);
  assert.equal(MAX_REEL_VIDEO_SIZE, 50 * 1024 * 1024);
  assert.equal(MAX_REEL_POSTER_SIZE, 4 * 1024 * 1024);
});

test('영상과 포스터 업로드 경로를 요청별로 구분한다', () => {
  assert.equal(classifyReelPath(`reel-media/${requestId}/video-demo.mp4`, requestId), 'reel-video');
  assert.equal(classifyReelPath(`reel-media/${requestId}/poster-demo.webp`, requestId), 'reel-poster');
  assert.equal(classifyReelPath(`reel-media/other/video-demo.mp4`, requestId), '');
});

test('비공개 영상과 관리용 URL은 공개 응답에서 제외한다', () => {
  const config = normalizeReelsConfig({ reels: [
    { id: 'one', name: '공개 영상', label: '01 · 공개', caption: '공개 문구', videoUrl: 'https://example.com/one.mp4', enabled: true, managedMedia: ['https://example.com/one.mp4'] },
    { id: 'two', name: '비공개 영상', label: '02 · 비공개', caption: '비공개 문구', videoUrl: 'https://example.com/two.mp4', enabled: false },
  ] });
  const visible = publicReels(config);
  assert.equal(visible.length, 1);
  assert.equal('managedMedia' in visible[0], false);
});

test('새 영상의 화면 문구를 필수로 검증한다', () => {
  const checked = validateNewReel({ name: '', label: '', caption: '' }, { videoUrl: 'https://example.com/video.mp4', posterUrl: '', managedMedia: [] });
  assert.equal(checked.valid, false);
  assert.deepEqual(Object.keys(checked.fieldErrors).sort(), ['caption', 'label', 'name']);
});
