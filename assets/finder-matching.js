import { productCategory, productFamilyKey } from './catalog-tools.js';

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

export function findMatchingProducts(products, answers) {
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
