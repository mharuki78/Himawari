import Papa from 'papaparse';
import { normalizeBlobEtag, publicProduct, validateProductUpdateInput, updateProductRecord, mergeProductMedia } from './products.js';

export const MAX_PRODUCT_CSV_BYTES = 2_000_000;
const columns = ['제품ID', '모델명', '제품명', '옵션ID', '옵션값', '판매가', '재고수량', '네이버할인율', '카탈로그버전'];
const version = (etag) => normalizeBlobEtag(etag) || 'initial';
const formulaPrefix = /^[\s]*[=+\-@]|^[\t\r\n]/;

export class ProductCsvError extends Error {
  constructor(message, status = 400, fieldErrors = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function exportProductCsv(products, etag) {
  const data = products.flatMap((product) => {
    const rows = product.options?.length ? product.options : [null];
    return rows.map((option) => [product.id, product.model, product.name, option?.id || '', option?.label || '', product.naverPrice,
      option ? option.stock : (product.stock ?? ''), product.naverDiscountRate ?? '', version(etag)]);
  });
  return '\ufeff' + Papa.unparse({ fields: columns, data }, {
    newline: '\r\n', escapeFormulae: formulaPrefix,
  });
}

function integer(value, { blank = null, min = 0, max = 99999 } = {}) {
  const text = String(value ?? '').trim();
  if (!text) return blank;
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text)) return NaN;
  const number = Number(text.replaceAll(',', ''));
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : NaN;
}

function failRows(errors) {
  if (Object.keys(errors).length) throw new ProductCsvError('CSV에 오류가 있습니다. 아래 행을 수정한 뒤 다시 올려 주세요. 아직 반영된 내용은 없습니다.', 400, errors);
}

/** Parse complete CSV records, retaining quoted commas/newlines and stable option identities. */
export function planProductCsv(csv, products, etag, fallbackEtag) {
  if (typeof csv !== 'string' || !csv.trim() || Buffer.byteLength(csv, 'utf8') > MAX_PRODUCT_CSV_BYTES) {
    throw new ProductCsvError('CSV 파일은 비어 있지 않은 2MB 이하 파일이어야 합니다.');
  }
  const parsed = Papa.parse(csv.replace(/^\ufeff/, ''), { skipEmptyLines: false, dynamicTyping: false });
  if (parsed.errors.length) throw new ProductCsvError('CSV 따옴표나 구분자가 올바르지 않습니다. CSV 형식으로 다시 저장해 주세요.', 400,
    Object.fromEntries(parsed.errors.slice(0, 20).map((error, index) => [`CSV ${Number(error.row || 0) + 1}행 (${index + 1})`, error.message])));
  const header = (parsed.data.shift() || []).map((cell) => cell.trim());
  if (new Set(header).size !== header.length) throw new ProductCsvError('CSV에 같은 이름의 열이 중복되어 있습니다.');
  const modern = header.includes('제품ID');
  const names = modern
    ? { id: '제품ID', name: '제품명', option: '옵션ID', price: '판매가', stock: '재고수량', discount: '네이버할인율', version: '카탈로그버전' }
    : { id: 'id', options: 'options(label=stock|...)', price: header.includes('naverPrice') ? 'naverPrice' : 'price', stock: 'stock', discount: 'naverDiscountRate' };
  const required = modern ? [names.id, names.option, names.price, names.stock, names.discount, names.version] : [names.id, names.stock, names.options];
  if (required.some((name) => !header.includes(name))) throw new ProductCsvError('이 화면에서 내려받은 가격·재고 CSV를 사용해 주세요. 필수 열이 없습니다.');
  const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
  const entries = parsed.data.map((cells, index) => ({ cells, row: index + 2 })).filter(({ cells }) => cells.some((cell) => cell.trim()));
  if (!entries.length || entries.length > 15000) throw new ProductCsvError('반영할 CSV는 1~15,000행이어야 합니다.');
  const widthErrors = Object.fromEntries(entries.filter(({ cells }) => cells.length !== header.length)
    .slice(0, 100).map(({ row }) => [`CSV ${row}행 · 열 수`, '제목 행과 열 수가 다릅니다. CSV 형식으로 다시 저장해 주세요.']));
  failRows(widthErrors);
  if (modern) {
    const versions = new Set(entries.map(({ cells }) => (cells[indexes[names.version]] || '').trim()));
    if (versions.size !== 1 || !versions.has(version(etag))) throw new ProductCsvError('CSV를 받은 뒤 제품 목록이 변경되었습니다. 새 CSV를 내려받아 수정해 주세요.', 409);
  } else if (version(fallbackEtag) !== version(etag)) {
    throw new ProductCsvError('제품 목록이 변경되었습니다. 새 CSV를 내려받아 수정해 주세요.', 409);
  }
  const byId = new Map(products.map((product) => [product.id, product]));
  const patches = new Map();
  const seen = new Set();
  const errors = {};
  for (const { cells, row } of entries) {
    const error = (field, message) => { if (Object.keys(errors).length < 100) errors[`CSV ${row}행 · ${field}`] = message; };
    if (cells.length !== header.length) { error('열 수', '제목 행과 열 수가 다릅니다. 쉼표가 있는 값은 CSV 형식으로 저장해 주세요.'); continue; }
    const get = (name) => String(cells[indexes[name]] ?? '').trim();
    const id = get(names.id);
    const product = byId.get(id);
    if (!product) { error('제품ID', '해당 제품이 없습니다. 제품ID는 수정할 수 없습니다.'); continue; }
    const optionId = modern ? get(names.option) : '';
    const key = JSON.stringify([id, optionId]);
    if (seen.has(key)) { error('중복', modern ? '같은 제품·옵션이 두 번 들어 있습니다.' : '같은 제품이 두 번 들어 있습니다.'); continue; }
    seen.add(key);
    const patch = patches.get(id) || { id, row, optionStocks: new Map(), optionRows: new Map() };
    if (modern && header.includes(names.name)) {
      const text = get(names.name);
      // Papa escapes formula-like names for spreadsheets. Only undo that exact
      // unchanged export value; a newly typed apostrophe is part of the name.
      const exportedName = formulaPrefix.test(product.name) ? `'${product.name}` : product.name;
      const unchangedEscapedName = text.startsWith("'") && formulaPrefix.test(text.slice(1))
        && text.slice(1).replace(/\s+/g, ' ').trim() === product.name;
      const name = !text || text === exportedName || unchangedEscapedName ? product.name : text;
      if (patch.name !== undefined && patch.name !== name) error('제품명', '같은 제품의 모든 옵션 행에 제품명을 동일하게 입력해 주세요.');
      patch.name = name;
    }
    const price = integer(get(names.price), { blank: product.naverPrice, min: 1, max: 10_000_000 });
    const discount = header.includes(names.discount) ? integer(get(names.discount), { max: 99 }) : product.naverDiscountRate;
    if (!Number.isFinite(price)) error('판매가', '1~10,000,000 사이의 정수를 입력해 주세요.');
    if (discount !== null && !Number.isFinite(discount)) error('네이버할인율', '0~99 사이의 정수를 입력하거나 비워 주세요.');
    if (patch.naverPrice !== undefined && (patch.naverPrice !== price || patch.naverDiscountRate !== discount)) error('제품 가격', '같은 제품의 옵션 행에는 판매가와 할인율을 동일하게 입력해 주세요.');
    patch.naverPrice = price;
    patch.naverDiscountRate = discount;
    if (modern && product.options?.length) {
      if (!product.options.some((option) => option.id === optionId)) error('옵션ID', '해당 제품의 옵션ID가 아닙니다. 옵션ID는 수정할 수 없습니다.');
      const stock = integer(get(names.stock), { blank: NaN });
      if (!Number.isFinite(stock)) error('재고수량', '옵션 재고는 0~99,999 사이의 정수를 입력해 주세요.');
      patch.optionStocks.set(optionId, stock);
      patch.optionRows.set(optionId, row);
    } else if (modern) {
      if (optionId) error('옵션ID', '옵션이 없는 제품입니다. 옵션ID를 비워 주세요.');
      patch.stock = integer(get(names.stock));
      if (patch.stock !== null && !Number.isFinite(patch.stock)) error('재고수량', '0~99,999 사이의 정수를 입력해 주세요. 빈칸은 수량 제한 없음입니다.');
    } else {
      patch.stock = integer(get(names.stock));
      if (patch.stock !== null && !Number.isFinite(patch.stock)) error('재고수량', '0~99,999 사이의 정수를 입력해 주세요.');
      patch.options = get(names.options) ? get(names.options).split('|').map((part) => {
        const split = part.lastIndexOf('=');
        return { label: part.slice(0, split).trim(), stock: split < 0 ? NaN : integer(part.slice(split + 1), { blank: NaN }) };
      }) : [];
    }
    patches.set(id, patch);
  }
  failRows(errors);
  return planBulkProducts(products, [...patches.values()]);
}

/** Validate the entire batch before producing any catalog to write. */
export function planBulkProducts(products, updates) {
  if (!Array.isArray(updates) || !updates.length || updates.length > 500) throw new ProductCsvError('1~500개 제품을 한 번에 반영할 수 있습니다.');
  const patches = new Map();
  const errors = {};
  const changes = [];
  const changedIds = new Set();
  for (const [index, update] of updates.entries()) {
    const id = String(update?.id || '');
    const label = `CSV ${update?.row || index + 2}행`;
    if (patches.has(id)) errors[`${label} · 중복`] = '같은 제품이 중복되었습니다.';
    if (!products.some((product) => product.id === id)) errors[`${label} · 제품ID`] = '해당 제품이 없습니다.';
    patches.set(id, { ...update, row: update?.row || index + 2 });
  }
  failRows(errors);
  const updatedProducts = products.map((product) => {
    const patch = patches.get(product.id);
    if (!patch) return product;
    const options = (product.options || []).map((option) => ({ ...option }));
    if (patch.options !== undefined) {
      if (!Array.isArray(patch.options) || patch.options.length !== options.length || new Set(patch.options.map((option) => option.label)).size !== options.length) {
        errors[`CSV ${patch.row}행 · 옵션`] = '기존 옵션은 추가하거나 삭제할 수 없습니다.';
      } else for (const option of patch.options) {
        const current = options.find((item) => option.id ? item.id === option.id && item.label === option.label : item.label === option.label);
        if (!current) errors[`CSV ${patch.row}행 · 옵션`] = '기존 옵션 이름과 ID를 유지해 주세요.';
        else current.stock = integer(option.stock, { blank: NaN });
      }
    }
    if (patch.optionStocks) for (const option of options) {
      if (patch.optionStocks.has(option.id)) option.stock = patch.optionStocks.get(option.id);
    }
    const candidate = {
      ...publicProduct(product), options,
      name: patch.name === undefined ? product.name : patch.name,
      naverPrice: patch.naverPrice === undefined && patch.price === undefined ? product.naverPrice : integer(patch.naverPrice ?? patch.price, { blank: NaN, min: 1, max: 10_000_000 }),
      stock: patch.stock === undefined ? product.stock : integer(patch.stock),
      naverDiscountRate: patch.naverDiscountRate === undefined ? product.naverDiscountRate : integer(patch.naverDiscountRate, { max: 99 }),
      replaceMainImage: false, replaceGallery: false, managedImages: [],
    };
    const checked = validateProductUpdateInput(candidate, product);
    if (!checked.valid) {
      for (const [field, message] of Object.entries(checked.fieldErrors)) errors[`CSV ${patch.row}행 · ${field}`] = message;
      return product;
    }
    const updated = updateProductRecord(product, checked.value, mergeProductMedia(product, checked.value));
    const addChange = (field, before, after, option = '', row = patch.row) => {
      if (before === after) return;
      changedIds.add(product.id);
      changes.push({ row, id: product.id, name: product.name, model: product.model, option, field, before, after });
    };
    addChange('제품명', product.name, updated.name);
    addChange('판매가', product.naverPrice, updated.naverPrice);
    addChange('네이버할인율', product.naverDiscountRate ?? null, updated.naverDiscountRate);
    if (options.length) for (const option of product.options) addChange('재고수량', option.stock, updated.options.find((item) => item.id === option.id).stock, option.label, patch.optionRows?.get(option.id) || patch.row);
    else addChange('재고수량', product.stock ?? null, updated.stock);
    return changedIds.has(product.id) ? updated : product;
  });
  failRows(errors);
  return { products: updatedProducts, changes, updated: changedIds.size, submitted: patches.size };
}
