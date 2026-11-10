import { productCategory, productFamilyKey, productVariantLabel } from './catalog-tools.js';

export const PURPOSE_LABELS = Object.freeze({ school: '학교·학원', business: '출근·노트북', travel: '여행·육아', daily: '가벼운 일상' });

function positiveAmount(value, unit) {
  const match = String(value || '').trim().match(unit === 'weight' ? /^(\d+(?:\.\d+)?)\s*(kg|g)\s*$/i : /^(\d+(?:\.\d+)?)\s*(l|리터)\s*$/i);
  if (!match || Number(match[1]) <= 0) return null;
  return Number(match[1]) * (match[2].toLowerCase() === 'kg' ? 1000 : 1);
}

export function laptopMeasurements(value) {
  const text = String(value || '');
  if (/추정|확인\s*중|외부|인치/.test(text)) return null;
  const match = text.match(/(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)(?:\s*[×xX]\s*(\d+(?:\.\d+)?))?\s*cm/i);
  if (!match || match.slice(1).some(value => value !== undefined && Number(value) <= 0)) return null;
  return { width: Number(match[1]), height: Number(match[2]), depth: match[3] ? Number(match[3]) : null };
}

export function isFinderPurchasable(product) {
  if (!product?.id || product.soldOut || product.active === false || product.available === false || product.purchasable === false) return false;
  if (!Number.isFinite(Number(product.price)) || Number(product.price) <= 0) return false;
  if (product.stock !== null && product.stock !== undefined && product.stock !== '' && (!Number.isFinite(Number(product.stock)) || Number(product.stock) <= 0)) return false;
  if (product.options?.length && !product.options.some(option => Number(option.stock) > 0)) return false;
  return true;
}

function registeredSpecs(product) {
  const specs = product.specs || {};
  const water = String(specs.waterResistance || '').trim();
  return {
    weight: positiveAmount(specs.weight, 'weight'),
    capacity: positiveAmount(specs.capacity, 'capacity'),
    laptop: laptopMeasurements(specs.laptopCompartment),
    water: /방수|발수/.test(water) && !/미확인|미기재|확인\s*중|불가|아님|없음|비방수/.test(water) ? water : '',
  };
}

function matchesPreferences(specs, answers) {
  if ((answers.purpose === 'business' || answers.storage === 'organized') && !specs.laptop) return false;
  if (answers.storage === 'roomy' && !specs.capacity) return false;
  if ((answers.storage === 'light' || answers.priority === 'light') && !specs.weight) return false;
  if (answers.priority === 'waterproof' && !specs.water) return false;
  return true;
}

function compareMatches(a, b, answers) {
  if (answers.priority === 'light' && a.specs.weight !== b.specs.weight) return a.specs.weight - b.specs.weight;
  if (answers.storage === 'roomy' && a.specs.capacity !== b.specs.capacity) return b.specs.capacity - a.specs.capacity;
  if (answers.storage === 'light' && a.specs.weight !== b.specs.weight) return a.specs.weight - b.specs.weight;
  return Number(a.product.price) - Number(b.product.price) || String(a.product.id).localeCompare(String(b.product.id));
}

function explain(item, answers) {
  const { specs, product } = item;
  const reasons = [];
  if (answers.purpose === 'business' || answers.storage === 'organized') reasons.push(`노트북 수납칸 ${specs.laptop.width} × ${specs.laptop.height} cm`);
  if (answers.storage === 'roomy') reasons.push(`등록 용량 ${specs.capacity} L`);
  if (answers.storage === 'light' || answers.priority === 'light') reasons.push(`등록 무게 ${specs.weight} g`);
  if (answers.priority === 'waterproof') reasons.push(specs.water);
  reasons.push(`${PURPOSE_LABELS[answers.purpose]}로 분류된 제품`);
  if (Number(answers.budget) < 999999) reasons.push('선택한 예산 안의 판매 구성');
  if (reasons.length < 2) reasons.push('현재 주문 가능한 판매 구성');
  let check = '색상·구성별 차이는 상세 사진과 옵션에서 확인해 주세요.';
  if (answers.purpose === 'business' || answers.storage === 'organized') {
    check = `${specs.laptop.depth ? `수납칸 두께 ${specs.laptop.depth} cm.` : '수납칸 두께는 미기재입니다.'} 기기·보호 케이스의 실측과 비교하고 입구 형태를 문의해 주세요. 수납을 보장하지 않습니다.`;
  } else if (answers.priority === 'waterproof') {
    check = '생활방수는 완전 방수가 아닙니다. 지퍼·봉제선의 방수 범위는 구매 전 확인해 주세요.';
  } else if (!specs.capacity) {
    check = '용량(L)은 미확인입니다. 담을 물건과 상세 크기를 비교해 주세요.';
  }
  if (product.options?.length) check += ' 재고가 있는 옵션을 상세에서 선택해 주세요.';
  return { reasons: [...new Set(reasons)].slice(0, 2), check };
}

function findLegacyMatches(products, answers) {
  const catalog = Array.isArray(products) ? products : [];
  const available = catalog.filter(isFinderPurchasable);
  const purpose = available.filter(product => productCategory(product) === answers.purpose);
  const budgetLimit = String(answers.budget) === '999999' ? Infinity : Number(answers.budget);
  const budget = purpose.filter(product => Number(product.price) <= budgetLimit);
  const candidates = budget.map(product => ({ product, specs: registeredSpecs(product) }))
    .filter(item => matchesPreferences(item.specs, answers)).sort((a, b) => compareMatches(a, b, answers));
  const families = new Map();
  for (const item of candidates) {
    const key = productFamilyKey(item.product);
    if (!families.has(key)) families.set(key, { ...item, variantCount: 0 });
    families.get(key).variantCount += 1;
  }
  return {
    items: [...families.values()].slice(0, 3).map(item => ({ ...item, ...explain(item, answers) })),
    total: families.size,
    excluded: { unavailable: catalog.length - available.length, purpose: available.length - purpose.length, budget: purpose.length - budget.length, specifications: budget.length - candidates.length },
  };
}

const BUDGETS = {
  'under-30000': [0, 30000],
  '30000-50000': [30000, 50000],
  '50000-80000': [50000, 80000],
  '80000-100000': [80000, 100000],
  '100000-plus': [100000, Infinity],
  any: [0, Infinity],
};

const USES = {
  daily: { pattern: /데일리|일상|daily/i, label: '일상용으로 소개된 가방' },
  travel: { pattern: /여행|출장|트래블|travel/i, label: '여행·출장용으로 소개된 가방' },
  commute: { pattern: /출퇴근|출근|통근|직장|사무실|업무|비즈니스|오피스|commut|business/i, label: '출퇴근용으로 소개된 가방' },
  laptop: { label: '실측 노트북 수납칸' },
};

const COLOR_GROUPS = [
  ['black', /블랙|검정|\bblack\b/i],
  ['gray', /그레이|회색|차콜|\b(?:gr[ae]y|charcoal)\b/i],
  ['light', /아이보리|베이지|화이트|크림|흰색|오트밀|\b(?:ivory|beige|white|cream)\b/i],
  ['brown', /브라운|갈색|카멜|초코|\b(?:brown|camel)\b/i],
  ['blue', /블루|네이비|스카이|하늘색|청색|\b(?:blue|navy)\b/i],
  ['green', /그린|민트|카키|올리브|초록|\b(?:green|mint|khaki|olive)\b/i],
  ['pink', /핑크|분홍|로즈|코랄|피치|\b(?:pink|rose|coral|peach)\b/i],
  ['purple', /퍼플|라벤더|보라|바이올렛|\b(?:purple|lavender|violet)\b/i],
  ['warm', /레드|옐로|노랑|오렌지|버건디|빨강|\b(?:red|yellow|orange|burgundy)\b/i],
  ['silver', /실버|은색|\bsilver\b/i],
];

function colorGroups(value) {
  return COLOR_GROUPS.filter(([, pattern]) => pattern.test(value)).map(([group]) => group);
}

function optionGroups(option) {
  if (/구성|사이즈|size|set/i.test(option?.group || option?.type || '')) return [];
  return colorGroups([option?.color, option?.name, option?.label, option?.value].filter(Boolean).join(' '));
}

function availableColorOption(product, color) {
  return product.options?.find(option => Number(option.stock) > 0 && optionGroups(option).includes(color));
}

function matchesColor(product, color) {
  if (color === 'any') return true;
  if (product.options?.some(option => optionGroups(option).length)) return Boolean(availableColorOption(product, color));
  const explicit = colorGroups(String(product.color || ''));
  const variant = colorGroups(productVariantLabel(product));
  const title = colorGroups(product.name || '');
  return (explicit.length ? explicit : variant.length ? variant : title).includes(color);
}

function exteriorMeasurements(value) {
  const text = String(value || '');
  if (/추정|미확인|확인\s*중|수납칸|내부/.test(text)) return null;
  const match = text.match(/(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)\s*cm/i);
  if (!match) return null;
  const dimensions = match.slice(1).map(Number);
  return dimensions.every(value => value > 0) ? dimensions : null;
}

function finderSize(dimensions) {
  if (!dimensions) return '';
  const longest = Math.max(...dimensions);
  return longest < 36 ? 'small' : longest < 43 ? 'medium' : 'large';
}

function modernSpecs(product) {
  const specs = product.specs || {};
  const material = String(specs.material || '').trim();
  return {
    ...registeredSpecs(product),
    dimensions: exteriorMeasurements(specs.dimensions),
    material: /미확인|미기재|확인\s*중|추정/.test(material) ? '' : material,
  };
}

function priorityEvidence(item, priority) {
  const { product, specs } = item;
  switch (priority) {
    case 'design': return { rank: Number(Boolean(product.featured)), reason: product.featured ? '스토어 추천 상품' : '' };
    case 'material': return { rank: Number(Boolean(specs.material)), reason: specs.material };
    case 'storage': return { rank: Number(Boolean(specs.laptop)), reason: specs.laptop ? laptopReason(specs.laptop) : '' };
    case 'capacity': return { rank: specs.capacity || 0, reason: specs.capacity ? `등록 용량 ${specs.capacity} L` : '' };
    case 'weight': return { rank: specs.weight ? 1 / specs.weight : 0, reason: specs.weight ? `등록 무게 ${specs.weight} g` : '' };
    case 'waterproof': return { rank: Number(Boolean(specs.water)), reason: specs.water };
    default: return { rank: 0, reason: '' };
  }
}

function laptopReason(laptop) {
  return `노트북 수납칸 ${laptop.width} × ${laptop.height} cm`;
}

function explainModern(item, answers) {
  const { product, specs, evidence, fit } = item;
  const useReason = fit.use ? (answers.use === 'laptop' ? laptopReason(specs.laptop) : USES[answers.use].label) : '';
  const sizeReason = specs.dimensions ? `외부 크기 ${specs.dimensions.join(' × ')} cm` : '';
  const practicalReason = sizeReason || (specs.weight ? `등록 무게 ${specs.weight} g` : '');
  const option = availableColorOption(product, answers.color);
  const colorLabel = option?.label || option?.name || option?.color || option?.value;
  const reasons = [...new Set([
    useReason, evidence.reason, colorLabel ? `재고가 있는 색상 옵션: ${colorLabel}` : '',
    answers.intent === 'gift' ? practicalReason : sizeReason,
    fit.budget && answers.budget !== 'any' ? '선택한 예산 범위에 포함' : '', '현재 주문 가능',
  ].filter(Boolean))].slice(0, 3);
  const checks = [];
  if (specs.laptop && (answers.use === 'laptop' || answers.priority === 'storage')) {
    checks.push(`${specs.laptop.depth ? `수납칸 두께 ${specs.laptop.depth} cm.` : '수납칸 두께는 미기재입니다.'} 기기와 케이스 실측을 비교해 주세요. 수납을 보장하지 않습니다.`);
  }
  const priorityChecks = {
    design: '상세 사진에서 디자인과 색감을 확인해 주세요.',
    material: evidence.reason ? '' : '소재 정보는 상세 페이지에서 확인해 주세요.',
    storage: evidence.reason ? '' : '수납칸 사양은 상세 페이지에서 확인해 주세요.',
    durability: '비교할 수 있는 내구성 시험 자료가 등록되어 있지 않습니다.',
    capacity: evidence.reason ? '' : '등록된 용량(L)이 없어 외부 크기와 담을 물건을 비교해 주세요.',
    weight: evidence.reason ? '' : '등록된 무게를 확인할 수 없습니다.',
    waterproof: evidence.reason ? '생활방수·발수는 완전 방수가 아닙니다. 방수 범위를 확인해 주세요.' : '등록된 방수·발수 정보를 확인할 수 없습니다.',
  };
  if (priorityChecks[answers.priority]) checks.push(priorityChecks[answers.priority]);
  if (product.options?.length) checks.push('상세 페이지에서 재고가 있는 옵션을 선택해 주세요.');
  const differences = [
    !fit.use && (answers.use === 'laptop' ? '노트북 수납칸 치수 미확인' : '선택한 용도와 다름'),
    !fit.size && (specs.dimensions ? '선택한 크기와 다름' : '크기 정보 미확인'),
    !fit.budget && '선택한 예산 범위 밖',
    !fit.color && '선택한 색상으로 주문 가능한지 확인 필요',
  ].filter(Boolean);
  return { reasons, differences, check: checks.join(' ') || '상세 사진과 제품 사양을 확인해 주세요.' };
}

function findModernMatches(products, answers) {
  const catalog = Array.isArray(products) ? products : [];
  const available = catalog.filter(isFinderPurchasable);
  const use = Object.hasOwn(USES, answers.use) ? USES[answers.use] : null;
  const range = Object.hasOwn(BUDGETS, answers.budget) ? BUDGETS[answers.budget] : null;
  const evaluated = available.map(product => {
    const specs = modernSpecs(product);
    const price = Number(product.price);
    const fit = {
      use: answers.use === 'laptop' ? Boolean(specs.laptop) : Boolean(use?.pattern?.test([product.name, product.tagline, product.description].filter(Boolean).join(' '))),
      budget: Boolean(range && price >= range[0] && price < range[1]),
      size: answers.size === 'any' || finderSize(specs.dimensions) === answers.size,
      color: matchesColor(product, answers.color),
    };
    return { product, specs, fit, matchCount: Object.values(fit).filter(Boolean).length,
      budgetGap: range ? Math.max(0, range[0] - price, price - range[1] + 1) : 0,
      evidence: priorityEvidence({ product, specs }, answers.priority) };
  });
  const purpose = evaluated.filter(item => item.fit.use);
  const budget = purpose.filter(item => item.fit.budget);
  const size = budget.filter(item => item.fit.size);
  const exact = size.filter(item => item.fit.color);
  const approximate = exact.length === 0 && evaluated.length > 0;
  const candidates = (approximate ? evaluated : exact).sort((a, b) =>
    (approximate ? b.matchCount - a.matchCount || Number(b.fit.use) - Number(a.fit.use) || a.budgetGap - b.budgetGap : 0) ||
    b.evidence.rank - a.evidence.rank ||
    (answers.intent === 'gift' ? Number(Boolean(b.product.featured)) - Number(Boolean(a.product.featured)) : 0) ||
    Number(a.product.price) - Number(b.product.price) || String(a.product.id).localeCompare(String(b.product.id)));

  const families = new Map();
  for (const { evidence, ...item } of candidates) {
    const key = productFamilyKey(item.product);
    if (!families.has(key)) families.set(key, { ...item, ...explainModern({ ...item, evidence }, answers), variantCount: 0 });
    families.get(key).variantCount += 1;
  }
  return {
    items: [...families.values()].slice(0, 3),
    total: families.size,
    approximate,
    excluded: { unavailable: catalog.length - available.length, purpose: available.length - purpose.length,
      budget: purpose.length - budget.length, size: budget.length - size.length, color: size.length - exact.length, specifications: 0 },
  };
}

export function findMatchingProducts(products, answers) {
  return Object.hasOwn(answers, 'use') ? findModernMatches(products, answers) : findLegacyMatches(products, answers);
}
