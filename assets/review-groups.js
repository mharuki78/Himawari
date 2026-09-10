export function reviewGroupKey(name, model = '') {
  const text = String(name || '');
  let key = (text.match(/No\.\s*(\d+[A-Za-z]*)/i)?.[1] || String(model).replace(/^No\.\s*/i, '') || text.match(/(?:네모백|경량백)\s*(\d+)/)?.[1] || '').toUpperCase();
  if (/체스트벨트/.test(text)) return /SET/i.test(text) ? `${key}-SET` : 'CHEST-BELT';
  if (key === '1884' && /(?:블랙|카키)M\b/.test(text)) key = '1884M';
  if (key === '0514' && /(?:실버|화이트)미니/.test(text)) key = '0514MINI';
  return key;
}
