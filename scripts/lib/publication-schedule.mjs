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

// October 14 editorial approval takes effect for new publications on October 15.
// Historical manifests continue to describe the images actually published then.
export const usesMagazineStandard = date => date >= '2026-10-15';
export const bodyText = html => (html.match(/<div class="story-body">([\s\S]*?)<\/div>/)?.[1] || '')
  .replace(/<figure\b[\s\S]*?<\/figure>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export function validateStoryEditorial(date, record, html) {
  if (!usesMagazineStandard(date)) return [record.image];
  assert.ok(bodyText(html).length >= 2400, `${record.id}: 본문 2,400자 이상 필요`);
  const images = record.images || [];
  assert.ok(images.length >= 3, `${record.id}: 사진 3장 이상 필요`);
  assert.equal(new Set(images.map(p => p.image)).size, images.length, '중복 사진');
  assert.ok(images.some(p => p.image === record.image), '대표 사진 기록 누락');
  assert.ok(images.filter(p => p.imageKind === 'generated').length >= 2, '새 생성 사진 2장 이상 필요');
  assert.ok(new Set(images.filter(p=>p.imageKind==='generated').map(p=>p.role)).size>=2, '생성 사진은 서로 다른 역할 필요');
  assert.ok(record.editorialForm && record.coreQuestion, '글 형식과 핵심 질문 필요');
  assert.ok(images.some(p => p.imageKind === 'reference'), '실제 제품 사진 필요');
  for (const photo of images) {
    assert.match(photo.image, /^assets\/story\/[\w-]+\.webp$/, '유효한 이야기 사진 경로 필요');
    const tag = [...html.matchAll(/<img\b[^>]*>/g)].find(m => m[0].includes(`src="../${photo.image}"`) || m[0].includes(`src="/${photo.image}"`))?.[0];
    assert.ok(tag, `본문 사진 누락: ${photo.image}`);
    assert.ok(photo.reference && photo.role, '사진 원본과 역할 필요');
    if (photo.imageKind === 'generated') {
      assert.ok(photo.generatedSource && photo.prompt && photo.fidelityReviewed === true, '생성 근거와 직접 검수 필요');
      assert.match(tag, /alt="[^"]*AI[^"]*"/, 'AI 사진 대체 텍스트 필요');
    } else {
      assert.equal(photo.imageKind, 'reference', '알 수 없는 사진 종류');
      assert.ok(photo.sourceUrl?.startsWith('https://'), '실제 사진 출처 필요');
    }
  }
  return images.map(p => p.image);
}

export function validateLookbookEditorial(date, records) {
  if (!usesMagazineStandard(date)) return;
  for (const record of records) {
    assert.ok(record.composition && ['approach','angle','framing','activity','setting'].every(k => typeof record.composition[k] === 'string' && record.composition[k].trim()), '촬영 방식·각도·거리·활동·장소 기록 필요');
  }
  assert.ok(new Set(records.map(r => `${r.composition.approach}|${r.composition.angle}|${r.composition.framing}`)).size >= 2, '서로 다른 촬영 방식 필요');
  assert.ok(!records.every(r => r.composition.angle === 'rear' && r.composition.framing === 'full-body'), '뒷모습 전신 사진만 반복할 수 없음');
}
