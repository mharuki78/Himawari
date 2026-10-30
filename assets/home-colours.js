import { productColor, productFamilyKey } from './catalog-tools.js';

// Screen swatches describe named catalogue colours, not measured fabric values.
const PALETTE = {
  민트: ['#bed8cc','#edf5f1'], 핑크: ['#dfbfc4','#fcf1f3'], 블루: ['#273d50','#edf1f5'],
  옐로: ['#d8ad39','#faf4dd'], 퍼플: ['#66516c','#f3eef6'], 블랙: ['#343a3a','#f2f3f3'],
  카키: ['#8c9273','#f2f3ec'], 아이보리: ['#e7e1d1','#faf8f2'], 실버: ['#b6babb','#f3f5f5'],
  그레이: ['#898d8c','#f2f3f3'], 베이지: ['#cdbb9f','#f7f2e9'], 브라운: ['#94745f','#f5eeea'],
  레드: ['#b45353','#fbefef'], 오렌지: ['#d08a51','#fbf1e7'], 그린: ['#648b72','#edf5ef'],
  네이비: ['#34495a','#eef2f5'], 화이트: ['#f4f1e9','#f7f7f4'], 피치: ['#e4b39f','#fcf0e9'],
  라벤더: ['#b8a3d1','#f4effa'], 스카이: ['#a8c6d4','#eef6fa'], 버건디: ['#824f59','#f6eef0'], 코랄: ['#df9e8e','#fcf0ed'],
};

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value,16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}

export function getHomeColourChoices(products, model = '0422') {
  const seen = new Set();
  return (Array.isArray(products) ? [...products] : [])
    .sort((a,b) => Number(/SET|세트|\+/i.test(a.name)) - Number(/SET|세트|\+/i.test(b.name)))
    .flatMap(product => {
      const modelKey = productFamilyKey(product), colourName = productColor(product);
      if (modelKey !== model || !/^\d{3,5}[A-Z]?$/.test(modelKey) || !product.id || !PALETTE[colourName] || seen.has(colourName)) return [];
      let image;
      try { image = new URL(product.image); } catch { return []; }
      if (image.protocol !== 'https:') return [];
      seen.add(colourName);
      const [colour,tint] = PALETTE[colourName];
      const light = luminance(colour);
      const checkColour = (light + .05) / (luminance('#202423') + .05) >= 1.05 / (light + .05) ? '#202423' : '#ffffff';
      const label = (colourName === '옐로' ? '옐로우' : colourName) + (/SET|세트|\+/i.test(product.name) ? ' 세트' : '');
      return [{ id: String(product.id), modelKey, model: `No.${modelKey}`, label, colour, tint, checkColour, image: image.href, name: product.name, href: `/product.html?id=${encodeURIComponent(product.id)}` }];
    });
}

export function getHomeHeroSelection(products, { previousModel = '', random = Math.random } = {}) {
  const models = [...new Set((Array.isArray(products) ? products : []).map(productFamilyKey))]
    .filter(model => getHomeColourChoices(products, model).length);
  if (!models.length) return null;
  const candidates = models.length > 1 ? models.filter(model => model !== previousModel) : models;
  const pick = values => values[Math.min(values.length - 1, Math.max(0, Math.floor(random() * values.length)))];
  const model = pick(candidates), choices = getHomeColourChoices(products, model);
  return { model, choices, initial: pick(choices) };
}
