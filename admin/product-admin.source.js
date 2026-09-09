import { createSpecEditor } from './spec-editor.js';
import { upload } from '@vercel/blob/client';

import { HttpError, bindPasswordToggle, fetchJson } from './admin-client.js';

const $ = (selector) => document.querySelector(selector);
const initialView = $('[data-initial-view]');
const loginView = $('[data-login-view]');
const boardView = $('[data-board-view]');
const loginForm = $('[data-login-form]');
const passwordInput = $('#admin-password');
const passwordError = $('#admin-password-error');
const passwordToggle = $('[data-password-toggle]');
const loginButton = loginForm.querySelector('button[type="submit"]');
const loginLabel = $('[data-login-label]');
const loginStatus = $('[data-login-status]');
const logoutButton = $('[data-logout]');
const boardTitle = $('#board-title');
const boardStatus = $('[data-board-status]');
const productTotal = $('[data-product-total]');
const catalogReadiness = $('[data-catalog-readiness]');
const tableWrap = $('[data-table-wrap]');
const rows = $('[data-product-rows]');
const emptyState = $('[data-empty-state]');
const listError = $('[data-list-error]');
const retryButton = $('[data-retry]');
const errorRetryButton = $('[data-error-retry]');
const loadMoreButton = $('[data-load-more]');
const loadLabel = $('[data-load-label]');
const listTitle = $('#product-list-title');
const bulkDownload = $('[data-bulk-download]');
const bulkFile = $('[data-bulk-file]');
const productForm = $('[data-product-form]');
const specEditor = createSpecEditor(productForm);
const formSummary = $('[data-form-summary]');
const formStatus = $('[data-form-status]');
const editorEyebrow = $('[data-editor-eyebrow]');
const editorTitle = $('[data-editor-title]');
const editorDescription = $('[data-editor-description]');
const editContext = $('[data-edit-context]');
const editProduct = $('[data-edit-product]');
const submitButton = productForm.querySelector('button[type="submit"]');
const submitLabel = $('[data-submit-label]');
const resetButton = $('[data-reset-form]');
const resetLabel = $('[data-reset-label]');
const cancelUploadButton = $('[data-cancel-upload]');
const mainImageInput = $('#product-main-image');
const galleryInput = $('#product-gallery');
const hasOptionsInput = $('#product-has-options');
const stockInput = $('#product-stock');
const optionNameInput = $('#product-option-name');
const simpleStockField = $('[data-simple-stock-field]');
const optionEditor = $('[data-option-editor]');
const optionRows = $('[data-option-rows]');
const addOptionButton = $('[data-add-option]');
const mainRequired = $('[data-main-required]');
const mainImageHelp = $('[data-main-image-help]');
const galleryHelp = $('[data-gallery-help]');
const mainPreview = $('[data-main-preview]');
const galleryPreview = $('[data-gallery-preview]');
const uploadProgress = $('[data-upload-progress]');
const uploadLabel = $('[data-upload-label]');
const uploadPercent = $('[data-upload-percent]');
const uploadMeter = $('[data-upload-meter]');
const deleteDialog = $('[data-delete-dialog]');
const deleteProduct = $('[data-delete-product]');
const deleteError = $('[data-delete-error]');
const deleteCancel = $('[data-delete-cancel]');
const deleteConfirm = $('[data-delete-confirm]');
const deleteLabel = $('[data-delete-label]');
const discardDialog = $('[data-discard-dialog]');
const discardTitle = $('[data-discard-title]');
const discardDescription = $('[data-discard-description]');
const discardCancel = $('[data-discard-cancel]');
const discardConfirm = $('[data-discard-confirm]');
const discardConfirmLabel = $('[data-discard-confirm-label]');

const priceFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const maxMainImageSize = 8 * 1024 * 1024;
const maxGalleryImageSize = 15 * 1024 * 1024;
const maxGallery = 5;
const longImageSegmentHeight = 6_000;
const fieldNames = ['name', 'model', 'price', 'naverDiscountRate', 'tagline', 'description', 'highlights', 'url', 'stock', 'optionName', 'options', 'mainImage', 'gallery'];

let products = [];
let total = 0;
let cursor = null;
let hasMore = false;
let catalogEtag = null;
let loadingList = false;
let listController = null;
let deleteTarget = null;
let requestId = crypto.randomUUID();
let uploadedImageUrls = [];
let uploadsComplete = false;
let uploadController = null;
let dirty = false;
let previewUrls = [];
let discardAction = null;
let editTarget = null;
let editEtag = null;
let editTrigger = null;

function showLogin(message = '') {
  initialView.hidden = true;
  boardView.hidden = true;
  loginView.hidden = false;
  loginStatus.textContent = message;
  passwordInput.value = '';
  passwordInput.type = 'password';
  passwordToggle.textContent = '표시';
  passwordToggle.setAttribute('aria-label', '비밀번호 표시');
  passwordToggle.setAttribute('aria-pressed', 'false');
  requestAnimationFrame(() => passwordInput.focus());
}

function showBoard() {
  initialView.hidden = true;
  loginView.hidden = true;
  boardView.hidden = false;
}

function setCreateMode() {
  if (editTrigger?.isConnected) {
    editTrigger.disabled = false;
    editTrigger.textContent = '수정';
    editTrigger.closest('tr')?.classList.remove('is-editing');
  }
  rows.querySelectorAll('[data-delete-product-id]').forEach((button) => { button.disabled = false; });
  editTarget = null;
  editEtag = null;
  editTrigger = null;
  productForm.dataset.mode = 'create';
  editorEyebrow.textContent = 'Add a product';
  editorTitle.textContent = '새 제품 등록';
  editorDescription.textContent = '별표가 있는 항목은 필수입니다. 저장 전까지 입력 내용과 선택한 파일은 이 브라우저에만 있습니다.';
  editContext.hidden = true;
  editProduct.textContent = '';
  mainImageInput.required = true;
  mainRequired.hidden = false;
  mainImageHelp.textContent = 'JPG, PNG, WebP, AVIF · 최대 8MB · 1장';
  galleryHelp.textContent = '상세페이지에서 원본 비율로 이어서 보여줄 이미지 · 장당 최대 15MB · 최대 5장 · 한 장짜리 긴 이미지는 WebP로 자동 분할';
  resetLabel.textContent = '입력 지우기';
  submitLabel.textContent = '제품 등록';
}

function createOptionRow(option = {}) {
  const row = document.createElement('div');
  row.className = 'inventory-option-row';
  row.dataset.optionId = String(option.id || '');
  const label = document.createElement('input');
  label.type = 'text';
  label.maxLength = 50;
  label.placeholder = '예: 블랙 / M';
  label.value = String(option.label || '');
  label.setAttribute('aria-label', '옵션값');
  const stock = document.createElement('input');
  stock.type = 'number';
  stock.inputMode = 'numeric';
  stock.min = '0';
  stock.max = '99999';
  stock.step = '1';
  stock.value = Number.isInteger(Number(option.stock)) ? String(option.stock) : '0';
  stock.setAttribute('aria-label', `${option.label || '옵션'} 재고`);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'inventory-option-remove';
  remove.textContent = '−';
  remove.setAttribute('aria-label', `${option.label || '이 옵션'} 삭제`);
  remove.addEventListener('click', () => {
    row.remove();
    dirty = true;
    setFieldError('options');
    if (!optionRows.children.length) createOptionRow();
  });
  row.append(label, stock, remove);
  optionRows.append(row);
  return row;
}

function inventoryOptions() {
  if (!hasOptionsInput.checked) return [];
  return [...optionRows.children].map((row) => ({
    id: row.dataset.optionId || '',
    label: String(row.children[0].value || '').trim(),
    stock: Number(row.children[1].value),
  }));
}

function syncInventoryEditor() {
  const enabled = hasOptionsInput.checked;
  optionEditor.hidden = !enabled;
  simpleStockField.hidden = enabled;
  optionNameInput.required = enabled;
  stockInput.disabled = enabled;
  if (enabled && !optionRows.children.length) createOptionRow();
}

function loadInventory(product = null) {
  const options = Array.isArray(product?.options) ? product.options : [];
  optionRows.replaceChildren();
  hasOptionsInput.checked = options.length > 0;
  stockInput.value = options.length || product?.stock === null || product?.stock === undefined ? '' : String(product.stock);
  optionNameInput.value = product?.optionName || '옵션';
  options.forEach(createOptionRow);
  syncInventoryEditor();
}

function beginEdit(product, trigger) {
  productForm.reset();
  clearFormErrors();
  revokePreviews();
  uploadedImageUrls = [];
  uploadsComplete = false;
  requestId = crypto.randomUUID();
  editTarget = product;
  editEtag = catalogEtag;
  editTrigger = trigger;
  productForm.dataset.mode = 'edit';
  editorEyebrow.textContent = 'Edit a product';
  editorTitle.textContent = '제품 수정';
  editorDescription.textContent = '현재 제품 정보를 불러왔습니다. 변경한 내용만 확인한 뒤 저장해 주세요.';
  editContext.hidden = false;
  editProduct.textContent = product.name;
  mainImageInput.required = false;
  mainRequired.hidden = true;
  mainImageHelp.textContent = '새 파일을 선택하면 현재 대표 이미지를 교체합니다. JPG, PNG, WebP, AVIF · 최대 8MB';
  galleryHelp.textContent = '새 파일을 선택하면 현재 상세 이미지 전체를 교체합니다. 장당 최대 15MB · 최대 5장 · 한 장짜리 긴 이미지는 WebP로 자동 분할';
  resetLabel.textContent = '수정 취소';
  submitLabel.textContent = '변경사항 저장';

  field('name').value = product.name;
  field('model').value = product.model;
  field('price').value = String(product.naverPrice || Math.max(0, Number(product.price || 0)));
  field('naverDiscountRate').value = product.naverDiscountRate === null || product.naverDiscountRate === undefined ? '' : String(product.naverDiscountRate);
  field('tagline').value = product.tagline;
  field('description').value = product.description;
  specEditor.fill(product);
  field('highlights').value = product.highlights.join('\n');
  field('url').value = product.url;
  loadInventory(product);
  renderFilePreviews();
  dirty = false;
  formStatus.textContent = `“${product.name}” 제품을 편집하고 있습니다. 변경 후 ‘변경사항 저장’을 눌러 주세요.`;
  formStatus.classList.remove('is-error');
  trigger.disabled = true;
  trigger.textContent = '선택됨';
  const editingRow = trigger.closest('tr');
  editingRow?.classList.add('is-editing');
  rows.querySelectorAll('[data-delete-product-id]').forEach((button) => { button.disabled = true; });
  document.querySelector('.product-create')?.scrollIntoView({ block: 'start' });
  requestAnimationFrame(() => field('name').focus());
}

function openDiscardDialog(action) {
  discardAction = action;
  if (editTarget) {
    discardTitle.textContent = '제품 수정을 취소할까요?';
    discardDescription.textContent = '저장하지 않은 변경 내용과 새로 선택한 이미지가 사라집니다. 현재 공개 제품 정보는 바뀌지 않습니다.';
    discardConfirmLabel.textContent = '수정 취소';
  } else {
    discardTitle.textContent = '입력한 내용을 지울까요?';
    discardDescription.textContent = '아직 등록하지 않은 제품 정보와 선택한 이미지가 사라집니다.';
    discardConfirmLabel.textContent = '입력 내용 지우기';
  }
  discardDialog.showModal();
  discardCancel.focus();
}

function handleSessionError(error) {
  if (error instanceof HttpError && error.status === 401) {
    showLogin('관리자 세션이 만료되었습니다. 다시 로그인해 주세요.');
    return true;
  }
  return false;
}

function setLoginError(message) {
  passwordError.textContent = message;
  passwordInput.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function field(name) {
  return productForm.elements.namedItem(name);
}

function focusField(name) {
  if (name === 'options') return optionRows.querySelector('input')?.focus();
  return field(name)?.focus();
}

function errorElement(name) {
  return document.querySelector(`#product-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-error`);
}

function setFieldError(name, message = '') {
  const control = field(name);
  const output = errorElement(name);
  if (output) output.textContent = message;
  if (control instanceof HTMLElement) control.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function clearFormErrors() {
  fieldNames.forEach((name) => setFieldError(name));
  formSummary.hidden = true;
  formSummary.textContent = '';
  formStatus.classList.remove('is-error');
}

function markFormError(message) {
  formSummary.textContent = message;
  formSummary.hidden = false;
  formStatus.textContent = message;
  formSummary.focus();
  formStatus.classList.add('is-error');
}

function validStoreUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'smartstore.naver.com';
  } catch {
    return false;
  }
}

function validateFile(file, maximumSize, label) {
  if (!allowedImageTypes.has(file.type)) return 'JPG, PNG, WebP, AVIF 이미지만 선택할 수 있습니다.';
  if (file.size <= 0 || file.size > maximumSize) return `${label}는 ${maximumSize / 1024 / 1024}MB 이하여야 합니다.`;
  return '';
}

function validateGalleryFiles(files) {
  if (files.length > maxGallery) return '상세 이미지는 최대 5개까지 선택할 수 있습니다.';
  return files
    .map((file) => validateFile(file, maxGalleryImageSize, '상세 이미지 한 장'))
    .find(Boolean) || '';
}

function canvasBlob(canvas, type = 'image/webp', quality = .84) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('상세 이미지를 WebP로 변환하지 못했습니다.'));
  }, type, quality));
}

async function optimizeGalleryFiles(files) {
  if (files.length !== 1 || typeof createImageBitmap !== 'function') return files;
  const original = files[0];
  let bitmap;
  try {
    bitmap = await createImageBitmap(original);
    const segmentCount = Math.min(maxGallery, Math.max(1, Math.ceil(bitmap.height / longImageSegmentHeight)));
    if (segmentCount === 1 && original.type === 'image/webp' && original.size < 4 * 1024 * 1024) return files;
    const sourceSegmentHeight = Math.ceil(bitmap.height / segmentCount);
    const targetWidth = Math.min(bitmap.width, 1_600);
    const scale = targetWidth / bitmap.width;
    const basename = original.name.replace(/\.[^.]+$/, '') || 'detail';
    const optimized = [];

    for (let index = 0; index < segmentCount; index += 1) {
      const sourceY = index * sourceSegmentHeight;
      const sourceHeight = Math.min(sourceSegmentHeight, bitmap.height - sourceY);
      if (sourceHeight <= 0) break;
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, sourceY, bitmap.width, sourceHeight, 0, 0, canvas.width, canvas.height);
      const blob = await canvasBlob(canvas);
      if (blob.size > maxGalleryImageSize) throw new Error('변환된 상세 이미지 한 장이 15MB를 초과합니다. 원본 폭을 줄여 다시 시도해 주세요.');
      optimized.push(new File([blob], `${basename}-${String(index + 1).padStart(2, '0')}.webp`, { type: 'image/webp', lastModified: Date.now() }));
    }
    return optimized;
  } catch (error) {
    if (error.message?.includes('15MB')) throw error;
    return files;
  } finally {
    bitmap?.close?.();
  }
}

function validateForm() {
  clearFormErrors();
  const values = {
    name: String(field('name').value || '').trim(),
    model: String(field('model').value || '').trim(),
    price: Number(field('price').value),
    naverDiscountRate: field('naverDiscountRate').value === '' ? null : Number(field('naverDiscountRate').value),
    tagline: String(field('tagline').value || '').trim(),
    description: String(field('description').value || '').trim(),
    highlights: String(field('highlights').value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    url: String(field('url').value || '').trim(),
    stock: hasOptionsInput.checked || stockInput.value === '' ? null : Number(stockInput.value),
    optionName: hasOptionsInput.checked ? String(optionNameInput.value || '').trim() : '',
    options: inventoryOptions(),
  };
  const mainFile = mainImageInput.files?.[0] || null;
  const galleryFiles = [...(galleryInput.files || [])];
  const errors = {};

  if (values.name.length < 2 || values.name.length > 160) errors.name = '제품명은 2~160자로 입력해 주세요.';
  if (!values.model || values.model.length > 50) errors.model = '모델명은 50자 이내로 입력해 주세요.';
  if (!Number.isInteger(values.price) || values.price < 1 || values.price > 10_000_000) errors.price = '가격은 1원 이상 1,000만원 이하로 입력해 주세요.';
  if (values.naverDiscountRate !== null && (!Number.isInteger(values.naverDiscountRate) || values.naverDiscountRate < 0 || values.naverDiscountRate > 99)) errors.naverDiscountRate = '할인율은 0~99 사이의 정수로 입력해 주세요.';
  if (values.tagline.length < 5 || values.tagline.length > 120) errors.tagline = '한 줄 소개는 5~120자로 입력해 주세요.';
  if (values.description.length < 20 || values.description.length > 3_000) errors.description = '상세 설명은 20~3,000자로 입력해 주세요.';
  if (!values.highlights.length || values.highlights.length > 8 || values.highlights.some((item) => item.length > 100)) errors.highlights = '제품 포인트를 줄마다 입력해 주세요. 최대 8개까지 가능합니다.';
  if (!validStoreUrl(values.url)) errors.url = '네이버 스마트스토어 제품 주소를 입력해 주세요.';
  if (hasOptionsInput.checked) {
    if (!values.optionName || values.optionName.length > 20) errors.optionName = '옵션명을 1~20자로 입력해 주세요.';
    const labels = values.options.map((option) => option.label);
    if (!values.options.length || values.options.length > 30 || values.options.some((option) => !option.label || option.label.length > 50 || !Number.isInteger(option.stock) || option.stock < 0 || option.stock > 99_999)) errors.options = '각 옵션값과 0~99,999 사이의 재고를 확인해 주세요.';
    else if (new Set(labels).size !== labels.length) errors.options = '같은 옵션값을 두 번 등록할 수 없습니다.';
  } else if (values.stock !== null && (!Number.isInteger(values.stock) || values.stock < 0 || values.stock > 99_999)) errors.stock = '재고는 0~99,999 사이의 정수로 입력하거나 비워 주세요.';
  if (!mainFile && !editTarget) errors.mainImage = '대표 이미지를 선택해 주세요.';
  else if (mainFile) {
    const mainImageError = validateFile(mainFile, maxMainImageSize, '대표 이미지');
    if (mainImageError) errors.mainImage = mainImageError;
  }
  const galleryError = validateGalleryFiles(galleryFiles);
  if (galleryError) errors.gallery = galleryError;
  if (editTarget) {
    for (const name of ['name', 'model', 'tagline', 'description', 'url']) {
      if (errors[name] && values[name] === editTarget[name]) delete errors[name];
    }
    if (errors.price && values.price === editTarget.naverPrice) delete errors.price;
    if (errors.naverDiscountRate && values.naverDiscountRate === editTarget.naverDiscountRate) delete errors.naverDiscountRate;
    if (
      errors.highlights
      && values.highlights.length === editTarget.highlights.length
      && values.highlights.every((item, index) => item === editTarget.highlights[index])
    ) {
      delete errors.highlights;
    }
  }

  Object.entries(errors).forEach(([name, message]) => setFieldError(name, message));
  const firstError = Object.keys(errors)[0];
  if (firstError) {
    markFormError('입력 내용을 확인해 주세요. 오류가 있는 첫 항목으로 이동합니다.');
    focusField(firstError);
    return null;
  }
  return { ...values, mainFile, galleryFiles };
}

function revokePreviews() {
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls = [];
}

function imagePreview(file) {
  const image = document.createElement('img');
  const url = URL.createObjectURL(file);
  previewUrls.push(url);
  image.src = url;
  image.alt = '';
  return image;
}

function currentImagePreview(url) {
  const image = document.createElement('img');
  image.src = url;
  image.alt = '';
  return image;
}

function renderFilePreviews() {
  revokePreviews();
  mainPreview.replaceChildren();
  galleryPreview.replaceChildren();
  const mainFile = mainImageInput.files?.[0];
  if (mainFile) {
    const name = document.createElement('p');
    name.textContent = `새 대표 이미지 · ${mainFile.name} · ${(mainFile.size / 1024 / 1024).toFixed(1)}MB`;
    mainPreview.append(imagePreview(mainFile), name);
    mainPreview.hidden = false;
  } else if (editTarget?.image) {
    const name = document.createElement('p');
    name.textContent = '현재 대표 이미지 유지';
    mainPreview.append(currentImagePreview(editTarget.image), name);
    mainPreview.hidden = false;
  } else {
    mainPreview.hidden = true;
  }

  const galleryFiles = [...(galleryInput.files || [])];
  const galleryItems = galleryFiles.length
    ? galleryFiles.map((file) => ({ image: imagePreview(file), label: `새 상세 이미지 · ${file.name} · ${(file.size / 1024 / 1024).toFixed(1)}MB` }))
    : (editTarget?.gallery || []).map((url, index) => ({ image: currentImagePreview(url), label: `현재 상세 이미지 ${index + 1} 유지` }));
  galleryItems.forEach((entry) => {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = entry.label;
    item.append(entry.image, name);
    galleryPreview.append(item);
  });
  galleryPreview.hidden = galleryItems.length === 0;
}

async function cleanupUploadedImages() {
  if (!uploadedImageUrls.length) {
    uploadsComplete = false;
    return true;
  }
  const urls = [...uploadedImageUrls];
  try {
    await fetchJson('/api/admin/product-media', {
      method: 'DELETE',
      body: JSON.stringify({ requestId, urls }),
    });
    uploadedImageUrls = [];
    uploadsComplete = false;
    return true;
  } catch (error) {
    if (handleSessionError(error)) return false;
    formStatus.textContent = error.message || '임시 이미지를 정리하지 못했습니다.';
    formStatus.classList.add('is-error');
    return false;
  }
}

async function resetDraft({ cleanup = true } = {}) {
  if (cleanup && !(await cleanupUploadedImages())) return false;
  setCreateMode();
  productForm.reset();
  loadInventory();
  clearFormErrors();
  revokePreviews();
  mainPreview.replaceChildren();
  mainPreview.hidden = true;
  galleryPreview.replaceChildren();
  galleryPreview.hidden = true;
  uploadProgress.hidden = true;
  uploadMeter.value = 0;
  uploadPercent.textContent = '0%';
  formStatus.textContent = '';
  uploadedImageUrls = [];
  uploadsComplete = false;
  requestId = crypto.randomUUID();
  dirty = false;
  return true;
}

function createImageCell(product) {
  const wrapper = document.createElement('div');
  wrapper.className = 'product-table__identity';
  const image = document.createElement('img');
  image.src = product.image;
  image.alt = '';
  image.loading = 'lazy';
  image.addEventListener('error', () => {
    const fallback = document.createElement('span');
    fallback.className = 'product-table__fallback';
    fallback.textContent = '이미지 없음';
    image.replaceWith(fallback);
  });
  const copy = document.createElement('div');
  const name = document.createElement('strong');
  name.textContent = product.name;
  const model = document.createElement('span');
  model.textContent = product.model;
  copy.append(name, model);
  wrapper.append(image, copy);
  return wrapper;
}

async function requestProductEdit(product, trigger) {
  if (dirty) {
    openDiscardDialog({ type: 'edit', productId: product.id });
    return;
  }
  if (editTarget && editTarget.id !== product.id && !(await resetDraft({ cleanup: true }))) return;
  beginEdit(product, trigger);
}

function renderRows() {
  rows.replaceChildren();
  products.forEach((product) => {
    const row = document.createElement('tr');
    const identity = document.createElement('td');
    identity.append(createImageCell(product));
    const price = document.createElement('td');
    price.className = 'product-table__price';
    price.replaceChildren();
    const sitePrice = document.createElement('strong');
    sitePrice.textContent = priceFormatter.format(product.price);
    const naverPrice = document.createElement('span');
    naverPrice.textContent = `네이버 할인가 ${priceFormatter.format(product.naverPrice)}`;
    const stock = document.createElement('span');
    stock.textContent = product.stock === null ? '재고 제한 없음' : (product.soldOut ? '품절' : `재고 ${product.stock}개`);
    price.append(sitePrice, naverPrice, stock);
    const editCell = document.createElement('td');
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'button button--edit';
    edit.textContent = '수정';
    edit.dataset.editProductId = product.id;
    edit.setAttribute('aria-label', `${product.name} 정보 수정`);
    edit.addEventListener('click', () => requestProductEdit(product, edit));
    if (editTarget?.id === product.id) {
      row.classList.add('is-editing');
      edit.disabled = true;
      edit.textContent = '선택됨';
      editTrigger = edit;
    }
    editCell.append(edit);
    const viewCell = document.createElement('td');
    const view = document.createElement('a');
    view.className = 'button button--quiet';
    view.href = `../product.html?id=${encodeURIComponent(product.id)}`;
    view.target = '_blank';
    view.rel = 'noopener noreferrer';
    view.textContent = '상세 보기 ↗';
    view.setAttribute('aria-label', `${product.name} 상세페이지 새 탭에서 보기`);
    viewCell.append(view);
    const deleteCell = document.createElement('td');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button button--danger-outline';
    remove.textContent = '삭제';
    remove.dataset.deleteProductId = product.id;
    remove.setAttribute('aria-label', `${product.name} 영구 삭제`);
    remove.addEventListener('click', () => openDelete(product, remove));
    if (editTarget) remove.disabled = true;
    deleteCell.append(remove);
    row.append(identity, price, editCell, viewCell, deleteCell);
    rows.append(row);
  });

  tableWrap.hidden = products.length === 0;
  emptyState.hidden = products.length !== 0 || loadingList;
  listError.hidden = true;
  loadMoreButton.hidden = !hasMore || products.length === 0;
  productTotal.textContent = String(total);
}

async function loadProducts({ reset = false, initial = false } = {}) {
  if (loadingList) return;
  loadingList = true;
  listController?.abort();
  listController = new AbortController();
  const nextCursor = reset ? '' : cursor || '';
  retryButton.disabled = true;
  retryButton.setAttribute('aria-busy', 'true');
  loadMoreButton.disabled = true;
  loadMoreButton.setAttribute('aria-busy', 'true');
  loadLabel.textContent = '제품 불러오는 중';
  if (!initial) boardStatus.textContent = reset ? '제품 목록을 새로 불러오고 있습니다.' : '제품을 더 불러오고 있습니다.';

  try {
    const query = nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}` : '';
    const payload = await fetchJson(`/api/admin/products${query}`, { signal: listController.signal });
    if (reset) products = [];
    products = [...products, ...payload.items.filter((item) => !products.some((current) => current.id === item.id))];
    total = payload.total;
    cursor = payload.nextCursor;
    hasMore = payload.hasMore;
    catalogEtag = payload.etag;
    const readiness = payload.readiness || {};
    catalogReadiness.replaceChildren();
    [['재고 미입력', readiness.inventoryMissing], ['할인율 미입력', readiness.discountMissing], ['핵심 특징 부족', readiness.highlightsMissing]].forEach(([label, count]) => {
      const item = document.createElement('div'); const strong = document.createElement('strong'); const span = document.createElement('span');
      strong.textContent = String(Number(count) || 0); span.textContent = label; item.append(strong, span); catalogReadiness.append(item);
    });
    showBoard();
    renderRows();
    boardStatus.textContent = total ? `${total}개 제품 중 ${products.length}개를 불러왔습니다.` : '등록된 제품이 없습니다.';
  } catch (error) {
    if (error.name === 'AbortError') return;
    if (handleSessionError(error)) return;
    showBoard();
    if (!products.length) {
      tableWrap.hidden = true;
      emptyState.hidden = true;
      listError.hidden = false;
    }
    boardStatus.textContent = error.message || '제품 목록을 불러오지 못했습니다.';
  } finally {
    loadingList = false;
    retryButton.disabled = false;
    retryButton.removeAttribute('aria-busy');
    loadMoreButton.disabled = false;
    loadMoreButton.removeAttribute('aria-busy');
    loadLabel.textContent = '제품 20개 더 보기';
  }
}

function openDelete(product, trigger) {
  deleteTarget = { product, trigger };
  deleteProduct.textContent = product.name;
  deleteError.textContent = '';
  deleteDialog.showModal();
  deleteCancel.focus();
}

function updateUploadProgress(fileIndex, fileCount, percentage, fileName) {
  const combined = Math.round(((fileIndex + percentage / 100) / fileCount) * 100);
  uploadMeter.value = combined;
  uploadPercent.textContent = `${combined}%`;
  uploadLabel.textContent = `${fileName} 업로드 중`;
}

async function uploadImages(entries) {
  uploadController = new AbortController();
  uploadedImageUrls = [];
  uploadsComplete = false;
  uploadProgress.hidden = false;
  cancelUploadButton.hidden = false;
  let galleryIndex = 0;
  for (let index = 0; index < entries.length; index += 1) {
    const { file, kind } = entries[index];
    const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'img';
    if (kind === 'gallery') galleryIndex += 1;
    const filename = kind === 'main' ? `main.${extension}` : `gallery-${galleryIndex}.${extension}`;
    const pathname = `product-media/${requestId}/${filename}`;
    const blob = await upload(pathname, file, {
      access: 'public',
      handleUploadUrl: '/api/admin/product-upload',
      clientPayload: JSON.stringify({ requestId, kind }),
      abortSignal: uploadController.signal,
      onUploadProgress: ({ percentage }) => updateUploadProgress(index, entries.length, percentage, file.name),
    });
    uploadedImageUrls.push(blob.url);
  }
  uploadMeter.value = 100;
  uploadPercent.textContent = '100%';
  uploadLabel.textContent = '이미지 업로드 완료';
  uploadsComplete = true;
  cancelUploadButton.hidden = true;
  uploadController = null;
  return uploadedImageUrls;
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (loginButton.disabled) return;
  const password = passwordInput.value;
  if (!password) {
    setLoginError('관리자 비밀번호를 입력해 주세요.');
    passwordInput.focus();
    return;
  }
  setLoginError('');
  loginStatus.textContent = '관리자 권한을 확인하고 있습니다.';
  loginButton.disabled = true;
  loginButton.setAttribute('aria-busy', 'true');
  loginLabel.textContent = '로그인 확인 중';
  try {
    await fetchJson('/api/admin/session', { method: 'POST', body: JSON.stringify({ password }) });
    passwordInput.value = '';
    await loadProducts({ reset: true });
  } catch (error) {
    loginStatus.textContent = error.message || '로그인 처리 중 문제가 발생했습니다.';
    if (error instanceof HttpError && error.status === 401) {
      setLoginError('관리자 비밀번호를 확인해 주세요.');
      passwordInput.select();
    }
  } finally {
    loginButton.disabled = false;
    loginButton.removeAttribute('aria-busy');
    loginLabel.textContent = '관리자 로그인';
  }
});

passwordInput.addEventListener('input', () => {
  if (passwordInput.getAttribute('aria-invalid') === 'true') setLoginError('');
});
bindPasswordToggle(passwordInput, passwordToggle);

logoutButton.addEventListener('click', async () => {
  if (dirty) {
    openDiscardDialog({ type: 'logout' });
    return;
  }
  logoutButton.disabled = true;
  try {
    await fetchJson('/api/admin/session', { method: 'DELETE', body: '{}' });
    showLogin('안전하게 로그아웃했습니다.');
  } catch (error) {
    boardStatus.textContent = error.message || '로그아웃하지 못했습니다.';
  } finally {
    logoutButton.disabled = false;
  }
});

retryButton.addEventListener('click', () => loadProducts({ reset: true }));
errorRetryButton.addEventListener('click', () => loadProducts({ reset: true }));
loadMoreButton.addEventListener('click', () => loadProducts());

function csvCell(value) { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function parseCsvLine(line) { const result = []; let value = ''; let quoted = false; for (let index = 0; index < line.length; index += 1) { const char = line[index]; if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { result.push(value); value = ''; } else value += char; } result.push(value); return result; }
function optionText(options) { return (options || []).map((option) => `${option.label}=${option.stock}`).join('|'); }
function parseOptions(value) { if (!String(value).trim()) return []; return String(value).split('|').map((part) => { const split = part.lastIndexOf('='); return { label: part.slice(0, split).trim(), stock: Number(part.slice(split + 1)) }; }); }

bulkDownload.addEventListener('click', async () => {
  bulkDownload.disabled = true; boardStatus.textContent = '현재 재고 CSV를 준비하고 있습니다.';
  try {
    const payload = await fetchJson('/api/admin/products/bulk');
    const lines = [['id','model','name','stock','optionName','options(label=stock|...)','naverDiscountRate'], ...payload.items.map((item) => [item.id,item.model,item.name,item.stock ?? '',item.optionName,optionText(item.options),item.naverDiscountRate ?? ''])];
    const blob = new Blob(['\ufeff' + lines.map((line) => line.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `himawari-stock-${new Date().toISOString().slice(0,10)}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); boardStatus.textContent = '재고 CSV를 내려받았습니다.';
  } catch (error) { boardStatus.textContent = error.message || 'CSV를 준비하지 못했습니다.'; }
  finally { bulkDownload.disabled = false; }
});

bulkFile.addEventListener('change', async () => {
  const file = bulkFile.files[0]; if (!file) return;
  try {
    const lines = (await file.text()).replace(/^\ufeff/, '').split(/\r?\n/).filter(Boolean); const header = parseCsvLine(lines.shift() || '');
    const indexes = Object.fromEntries(header.map((name, index) => [name, index])); if (indexes.id === undefined || indexes.stock === undefined || indexes['options(label=stock|...)'] === undefined) throw new Error('Himawari에서 내려받은 CSV 형식이 아닙니다.');
    const updates = lines.map(parseCsvLine).map((row) => ({ id: row[indexes.id], stock: row[indexes.stock], optionName: row[indexes.optionName] || '', options: parseOptions(row[indexes['options(label=stock|...)']]), naverDiscountRate: row[indexes.naverDiscountRate] || '' }));
    if (!confirm(`${updates.length}개 제품의 재고·할인율을 CSV 내용으로 반영할까요?`)) { bulkFile.value = ''; return; }
    boardStatus.textContent = 'CSV 내용을 검증하고 반영하고 있습니다.'; await fetchJson('/api/admin/products/bulk', { method: 'PUT', body: JSON.stringify({ etag: catalogEtag, updates }) }); await loadProducts({ reset: true }); boardStatus.textContent = `${updates.length}개 제품의 재고·할인율을 반영했습니다.`;
  } catch (error) { boardStatus.textContent = error.message || 'CSV를 반영하지 못했습니다.'; }
  finally { bulkFile.value = ''; }
});

productForm.addEventListener('input', (event) => {
  dirty = true;
  if (event.target.name) setFieldError(event.target.name);
  formSummary.hidden = true;
  formStatus.textContent = '';
  formStatus.classList.remove('is-error');
});

async function handleFileChange(name) {
  dirty = true;
  if (name === 'mainImage') {
    const file = mainImageInput.files?.[0];
    setFieldError(name, file ? validateFile(file, maxMainImageSize, '대표 이미지') : '');
  } else {
    setFieldError(name, validateGalleryFiles([...(galleryInput.files || [])]));
  }
  if (uploadedImageUrls.length) {
    const cleaned = await cleanupUploadedImages();
    if (cleaned) requestId = crypto.randomUUID();
  }
  renderFilePreviews();
}

mainImageInput.addEventListener('change', () => handleFileChange('mainImage'));
galleryInput.addEventListener('change', () => handleFileChange('gallery'));
hasOptionsInput.addEventListener('change', () => {
  dirty = true;
  syncInventoryEditor();
  setFieldError('stock');
  setFieldError('optionName');
  setFieldError('options');
});
addOptionButton.addEventListener('click', () => {
  if (optionRows.children.length >= 30) {
    setFieldError('options', '옵션은 최대 30개까지 등록할 수 있습니다.');
    return;
  }
  const row = createOptionRow();
  dirty = true;
  row.querySelector('input')?.focus();
});

productForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitButton.disabled) return;
  const values = validateForm();
  if (!values) return;
  const editingProduct = editTarget;
  const editingCatalogEtag = editEtag;
  let uploadEntries = [];

  submitButton.disabled = true;
  submitButton.setAttribute('aria-busy', 'true');
  submitLabel.textContent = editingProduct ? '변경사항 저장 중' : '제품 등록 중';
  resetButton.disabled = true;
  formStatus.textContent = values.galleryFiles.length ? '긴 상세 이미지를 전송에 알맞게 준비하고 있습니다.' : '제품 정보를 저장하고 있습니다.';

  try {
    values.galleryFiles = await optimizeGalleryFiles(values.galleryFiles);
    const preparedGalleryError = validateGalleryFiles(values.galleryFiles);
    if (preparedGalleryError) throw new Error(preparedGalleryError);
    uploadEntries = [
      ...(values.mainFile ? [{ file: values.mainFile, kind: 'main' }] : []),
      ...values.galleryFiles.map((file) => ({ file, kind: 'gallery' })),
    ];
    if (uploadEntries.length) formStatus.textContent = '제품 이미지를 안전하게 업로드하고 있습니다.';
    if (uploadEntries.length && !uploadsComplete) await uploadImages(uploadEntries);
    formStatus.textContent = '제품 정보를 저장하고 있습니다.';
    const commonPayload = {
      ...specEditor.read(),
      requestId,
      name: values.name,
      model: values.model,
      naverPrice: values.price,
      naverDiscountRate: values.naverDiscountRate,
      tagline: values.tagline,
      description: values.description,
      highlights: values.highlights,
      url: values.url,
      stock: values.stock,
      optionName: values.optionName,
      options: values.options,
    };
    let payload;

    if (editingProduct) {
      const galleryStart = values.mainFile ? 1 : 0;
      payload = await fetchJson('/api/admin/products', {
        method: 'PATCH',
        body: JSON.stringify({
          ...commonPayload,
          id: editingProduct.id,
          etag: editingCatalogEtag,
          replaceMainImage: Boolean(values.mainFile),
          replaceGallery: values.galleryFiles.length > 0,
          image: values.mainFile ? uploadedImageUrls[0] : '',
          gallery: values.galleryFiles.length ? uploadedImageUrls.slice(galleryStart) : [],
          managedImages: uploadedImageUrls,
        }),
      });
    } else {
      payload = await fetchJson('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          ...commonPayload,
          image: uploadedImageUrls[0],
          gallery: uploadedImageUrls.slice(1),
          managedImages: uploadedImageUrls,
        }),
      });
    }
    catalogEtag = payload.etag;
    dirty = false;
    await resetDraft({ cleanup: false });
    await loadProducts({ reset: true });
    boardStatus.textContent = editingProduct
      ? `“${payload.product.name}” 제품 정보를 수정했습니다.${payload.mediaRemoved === false ? ' 교체 전 이미지는 별도 정리가 필요합니다.' : ''}`
      : `“${payload.product.name}” 제품을 등록했습니다.`;
    listTitle.focus();
  } catch (error) {
    if (error.name === 'AbortError') {
      await cleanupUploadedImages();
      requestId = crypto.randomUUID();
      formStatus.textContent = '이미지 업로드를 취소했습니다. 입력 내용은 그대로 유지됩니다.';
    } else if (uploadEntries.length && !uploadsComplete) {
      await cleanupUploadedImages();
      requestId = crypto.randomUUID();
      markFormError(error.message || '이미지를 업로드하지 못했습니다. 파일을 확인한 뒤 다시 시도해 주세요.');
    } else if (!handleSessionError(error)) {
      Object.entries(error.fieldErrors || {}).forEach(([name, message]) => setFieldError(name, message));
      const failure = error.message || `${editingProduct ? '제품을 수정' : '제품을 등록'}하지 못했습니다.`;
      const recovery = editingProduct
        ? '입력 내용과 선택한 파일은 유지했습니다. 오류를 확인한 뒤 ‘변경사항 저장’을 다시 눌러 주세요.'
        : '입력 내용과 선택한 파일은 유지했습니다. 오류를 확인한 뒤 ‘제품 등록’을 다시 눌러 주세요.';
      markFormError(`${failure} ${recovery}`);
      const firstServerField = Object.keys(error.fieldErrors || {})[0];
      if (firstServerField) focusField(firstServerField);
    }
  } finally {
    uploadController = null;
    cancelUploadButton.hidden = true;
    submitButton.disabled = false;
    submitButton.removeAttribute('aria-busy');
    submitLabel.textContent = editTarget ? '변경사항 저장' : '제품 등록';
    resetButton.disabled = false;
  }
});

cancelUploadButton.addEventListener('click', () => uploadController?.abort());

resetButton.addEventListener('click', async () => {
  if (!dirty) {
    const previousEditTarget = editTarget;
    const previousEditTrigger = editTrigger;
    if (!(await resetDraft())) return;
    if (previousEditTarget) {
      boardStatus.textContent = `“${previousEditTarget.name}” 제품 수정을 취소했습니다.`;
      previousEditTrigger?.focus();
    }
    return;
  }
  openDiscardDialog({ type: 'reset' });
});

deleteCancel.addEventListener('click', () => deleteDialog.close());
deleteDialog.addEventListener('cancel', () => { deleteError.textContent = ''; });
deleteConfirm.addEventListener('click', async () => {
  if (!deleteTarget || deleteConfirm.disabled) return;
  const target = deleteTarget;
  deleteConfirm.disabled = true;
  deleteCancel.disabled = true;
  deleteConfirm.setAttribute('aria-busy', 'true');
  deleteLabel.textContent = '삭제하는 중';
  deleteError.textContent = '';
  try {
    const result = await fetchJson('/api/admin/products', {
      method: 'DELETE',
      body: JSON.stringify({ id: target.product.id, etag: catalogEtag }),
    });
    catalogEtag = result.etag;
    deleteDialog.close();
    deleteTarget = null;
    await loadProducts({ reset: true });
    boardStatus.textContent = `“${target.product.name}” 제품을 영구 삭제했습니다.${result.mediaRemoved ? '' : ' 제품 이미지는 별도 정리가 필요합니다.'}`;
    listTitle.focus();
  } catch (error) {
    if (handleSessionError(error)) {
      deleteDialog.close();
      return;
    }
    deleteError.textContent = error.message || '제품을 삭제하지 못했습니다. 다시 시도하거나 취소해 주세요.';
  } finally {
    deleteConfirm.disabled = false;
    deleteCancel.disabled = false;
    deleteConfirm.removeAttribute('aria-busy');
    deleteLabel.textContent = '제품 삭제';
  }
});

discardCancel.addEventListener('click', () => {
  discardAction = null;
  discardDialog.close();
});

discardConfirm.addEventListener('click', async () => {
  const action = discardAction;
  const previousEditTarget = editTarget;
  const previousEditTrigger = editTrigger;
  discardConfirm.disabled = true;
  const reset = await resetDraft({ cleanup: true });
  discardConfirm.disabled = false;
  if (!reset) return;
  discardDialog.close();
  discardAction = null;
  if (action?.type === 'reset' && previousEditTarget) {
    boardStatus.textContent = `“${previousEditTarget.name}” 제품 수정을 취소했습니다.`;
    previousEditTrigger?.focus();
  }
  if (action?.type === 'edit') {
    const product = products.find((item) => item.id === action.productId);
    const trigger = [...rows.querySelectorAll('[data-edit-product-id]')]
      .find((button) => button.dataset.editProductId === action.productId);
    if (product && trigger) beginEdit(product, trigger);
  }
  if (action?.type === 'navigate') location.href = action.href;
  if (action?.type === 'logout') {
    try {
      await fetchJson('/api/admin/session', { method: 'DELETE', body: '{}' });
      showLogin('안전하게 로그아웃했습니다.');
    } catch (error) {
      boardStatus.textContent = error.message || '로그아웃하지 못했습니다.';
    }
  }
});

document.querySelectorAll('.admin-header a').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (!dirty || link.target === '_blank') return;
    event.preventDefault();
    openDiscardDialog({ type: 'navigate', href: link.href });
  });
});

window.addEventListener('beforeunload', (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

window.addEventListener('pagehide', revokePreviews);
setCreateMode();
loadInventory();
loadProducts({ reset: true, initial: true });
