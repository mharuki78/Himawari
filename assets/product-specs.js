export const SPEC_FIELDS = Object.freeze([
  ['dimensions', '외부 크기 (가로 × 세로 × 폭, cm)'],
  ['weight', '무게 (g)'], ['capacity', '용량 (L)'],
  ['laptopCompartment', '노트북 수납칸 실측 (가로 × 세로 × 두께, cm)'],
  ['material', '겉감·안감 소재'], ['waterResistance', '생활방수 범위'],
  ['care', '세탁·보관·관리 방법'], ['warranty', 'A/S 범위·비용 안내'],
  ['measurementNote', '측정 조건·오차 안내'],
]);

export function normalizeSpecs(input = {}) {
  return Object.fromEntries(SPEC_FIELDS.map(([key]) => [key, String(input?.[key] || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 600)]));
}

export function normalizeRelatedIds(value) {
  return [...new Set((Array.isArray(value) ? value : []).filter(x => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(x)))].slice(0, 8);
}
