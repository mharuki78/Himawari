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
const tableWrap = $('[data-table-wrap]');
const rows = $('[data-product-rows]');
const emptyState = $('[data-empty-state]');
const listError = $('[data-list-error]');
const retryButton = $('[data-retry]');
const errorRetryButton = $('[data-error-retry]');
const loadMoreButton = $('[data-load-more]');
const loadLabel = $('[data-load-label]');
const listTitle = $('#product-list-title');
const productForm = $('[data-product-form]');
const formSummary = $('[data-form-summary]');
const formStatus = $('[data-form-status]');
const submitButton = productForm.querySelector('button[type="submit"]');
const submitLabel = $('[data-submit-label]');
const resetButton = $('[data-reset-form]');
const cancelUploadButton = $('[data-cancel-upload]');
const mainImageInput = $('#product-main-image');
const galleryInput = $('#product-gallery');
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
const discardCancel = $('[data-discard-cancel]');
const discardConfirm = $('[data-discard-confirm]');

const priceFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const maxImageSize = 8 * 1024 * 1024;
const maxGallery = 5;
const fieldNames = ['name', 'model', 'price', 'tagline', 'description', 'highlights', 'url', 'mainImage', 'gallery'];

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

function validateFile(file) {
  if (!allowedImageTypes.has(file.type)) return 'JPG, PNG, WebP, AVIF 이미지만 선택할 수 있습니다.';
  if (file.size <= 0 || file.size > maxImageSize) return '이미지 한 장은 8MB 이하여야 합니다.';
  return '';
}

function validateForm() {
  clearFormErrors();
  const values = {
    name: String(field('name').value || '').trim(),
    model: String(field('model').value || '').trim(),
    price: Number(field('price').value),
    tagline: String(field('tagline').value || '').trim(),
    description: String(field('description').value || '').trim(),
    highlights: String(field('highlights').value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    url: String(field('url').value || '').trim(),
  };
  const mainFile = mainImageInput.files?.[0] || null;
  const galleryFiles = [...(galleryInput.files || [])];
  const errors = {};

  if (values.name.length < 2 || values.name.length > 160) errors.name = '제품명은 2~160자로 입력해 주세요.';
  if (!values.model || values.model.length > 50) errors.model = '모델명은 50자 이내로 입력해 주세요.';
  if (!Number.isInteger(values.price) || values.price < 1 || values.price > 10_000_000) errors.price = '가격은 1원 이상 1,000만원 이하로 입력해 주세요.';
  if (values.tagline.length < 5 || values.tagline.length > 120) errors.tagline = '한 줄 소개는 5~120자로 입력해 주세요.';
  if (values.description.length < 20 || values.description.length > 3_000) errors.description = '상세 설명은 20~3,000자로 입력해 주세요.';
  if (!values.highlights.length || values.highlights.length > 8 || values.highlights.some((item) => item.length > 100)) errors.highlights = '제품 포인트를 줄마다 입력해 주세요. 최대 8개까지 가능합니다.';
  if (!validStoreUrl(values.url)) errors.url = '네이버 스마트스토어 제품 주소를 입력해 주세요.';
  if (!mainFile) errors.mainImage = '대표 이미지를 선택해 주세요.';
  else if (validateFile(mainFile)) errors.mainImage = validateFile(mainFile);
  if (galleryFiles.length > maxGallery) errors.gallery = '상세 이미지는 최대 5개까지 선택할 수 있습니다.';
  else if (galleryFiles.some(validateFile)) errors.gallery = validateFile(galleryFiles.find(validateFile));

  Object.entries(errors).forEach(([name, message]) => setFieldError(name, message));
  const firstError = Object.keys(errors)[0];
  if (firstError) {
    markFormError('입력 내용을 확인해 주세요. 오류가 있는 첫 항목으로 이동합니다.');
    field(firstError)?.focus();
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

function renderFilePreviews() {
  revokePreviews();
  mainPreview.replaceChildren();
  galleryPreview.replaceChildren();
  const mainFile = mainImageInput.files?.[0];
  if (mainFile) {
    const name = document.createElement('p');
    name.textContent = `${mainFile.name} · ${(mainFile.size / 1024 / 1024).toFixed(1)}MB`;
    mainPreview.append(imagePreview(mainFile), name);
    mainPreview.hidden = false;
  } else {
    mainPreview.hidden = true;
  }

  const galleryFiles = [...(galleryInput.files || [])];
  galleryFiles.forEach((file) => {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = file.name;
    item.append(imagePreview(file), name);
    galleryPreview.append(item);
  });
  galleryPreview.hidden = galleryFiles.length === 0;
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
  productForm.reset();
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

function renderRows() {
  rows.replaceChildren();
  products.forEach((product) => {
    const row = document.createElement('tr');
    const identity = document.createElement('td');
    identity.append(createImageCell(product));
    const price = document.createElement('td');
    price.className = 'product-table__price';
    price.textContent = priceFormatter.format(product.price);
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
    remove.setAttribute('aria-label', `${product.name} 영구 삭제`);
    remove.addEventListener('click', () => openDelete(product, remove));
    deleteCell.append(remove);
    row.append(identity, price, viewCell, deleteCell);
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

async function uploadImages(files) {
  uploadController = new AbortController();
  uploadedImageUrls = [];
  uploadsComplete = false;
  uploadProgress.hidden = false;
  cancelUploadButton.hidden = false;
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'img';
    const pathname = `product-media/${requestId}/image-${index + 1}.${extension}`;
    const blob = await upload(pathname, file, {
      access: 'public',
      handleUploadUrl: '/api/admin/product-upload',
      clientPayload: JSON.stringify({ requestId }),
      abortSignal: uploadController.signal,
      onUploadProgress: ({ percentage }) => updateUploadProgress(index, files.length, percentage, file.name),
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
    discardAction = { type: 'logout' };
    discardDialog.showModal();
    discardCancel.focus();
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

productForm.addEventListener('input', (event) => {
  dirty = true;
  if (event.target.name) setFieldError(event.target.name);
  formSummary.hidden = true;
  formStatus.textContent = '';
  formStatus.classList.remove('is-error');
});

async function handleFileChange(name) {
  dirty = true;
  setFieldError(name);
  if (uploadedImageUrls.length) {
    const cleaned = await cleanupUploadedImages();
    if (cleaned) requestId = crypto.randomUUID();
  }
  renderFilePreviews();
}

mainImageInput.addEventListener('change', () => handleFileChange('mainImage'));
galleryInput.addEventListener('change', () => handleFileChange('gallery'));

productForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitButton.disabled) return;
  const values = validateForm();
  if (!values) return;

  submitButton.disabled = true;
  submitButton.setAttribute('aria-busy', 'true');
  submitLabel.textContent = '제품 등록 중';
  resetButton.disabled = true;
  formStatus.textContent = '제품 이미지를 안전하게 업로드하고 있습니다.';

  try {
    if (!uploadsComplete) await uploadImages([values.mainFile, ...values.galleryFiles]);
    formStatus.textContent = '제품 정보를 저장하고 있습니다.';
    const payload = await fetchJson('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify({
        requestId,
        name: values.name,
        model: values.model,
        price: values.price,
        tagline: values.tagline,
        description: values.description,
        highlights: values.highlights,
        url: values.url,
        image: uploadedImageUrls[0],
        gallery: uploadedImageUrls.slice(1),
        managedImages: uploadedImageUrls,
      }),
    });
    catalogEtag = payload.etag;
    dirty = false;
    await resetDraft({ cleanup: false });
    await loadProducts({ reset: true });
    boardStatus.textContent = `“${payload.product.name}” 제품을 등록했습니다.`;
    listTitle.focus();
  } catch (error) {
    if (error.name === 'AbortError') {
      await cleanupUploadedImages();
      requestId = crypto.randomUUID();
      formStatus.textContent = '이미지 업로드를 취소했습니다. 입력 내용은 그대로 유지됩니다.';
    } else if (!uploadsComplete) {
      await cleanupUploadedImages();
      requestId = crypto.randomUUID();
      markFormError(error.message || '이미지를 업로드하지 못했습니다. 파일을 확인한 뒤 다시 시도해 주세요.');
    } else if (!handleSessionError(error)) {
      Object.entries(error.fieldErrors || {}).forEach(([name, message]) => setFieldError(name, message));
      markFormError(error.message || '제품을 등록하지 못했습니다. 입력 내용은 유지됩니다.');
      const firstServerField = Object.keys(error.fieldErrors || {})[0];
      if (firstServerField && field(firstServerField)) field(firstServerField).focus();
    }
  } finally {
    uploadController = null;
    cancelUploadButton.hidden = true;
    submitButton.disabled = false;
    submitButton.removeAttribute('aria-busy');
    submitLabel.textContent = '제품 등록';
    resetButton.disabled = false;
  }
});

cancelUploadButton.addEventListener('click', () => uploadController?.abort());

resetButton.addEventListener('click', () => {
  if (!dirty) {
    resetDraft();
    return;
  }
  discardAction = { type: 'reset' };
  discardDialog.showModal();
  discardCancel.focus();
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
  discardConfirm.disabled = true;
  const reset = await resetDraft({ cleanup: true });
  discardConfirm.disabled = false;
  if (!reset) return;
  discardDialog.close();
  discardAction = null;
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
    discardAction = { type: 'navigate', href: link.href };
    discardDialog.showModal();
    discardCancel.focus();
  });
});

window.addEventListener('beforeunload', (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

window.addEventListener('pagehide', revokePreviews);
loadProducts({ reset: true, initial: true });
