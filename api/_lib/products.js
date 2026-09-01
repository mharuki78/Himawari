import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  del,
  get,
  head,
  put,
} from '@vercel/blob';
import seedPayload from '../../products.json' with { type: 'json' };

const CATALOG_PATH = 'products/v1/catalog.json';
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_MAIN_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_GALLERY_IMAGE_SIZE = 15 * 1024 * 1024;
const MAX_GALLERY_IMAGES = 5;

function productToken() {
  return process.env.PRODUCT_BLOB_READ_WRITE_TOKEN || '';
}

export function productStoreIsConfigured() {
  return Boolean(productToken());
}

function singleLine(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function multiLine(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();
}

function httpsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function storeProductNumber(value) {
  return httpsUrl(value).match(/\/products\/(\d+)/)?.[1] || '';
}

function slug(value) {
  return singleLine(value)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function normalizeProduct(product, index = 0) {
  const storeNumber = storeProductNumber(product.url);
  const derivedModel = singleLine(product.name).match(/No\.\d+[A-Za-z]*/i)?.[0] || '';
  const id = singleLine(product.id) || (storeNumber ? `store-${storeNumber}` : `product-${index + 1}-${slug(product.name) || 'himawari'}`);
  const image = httpsUrl(product.image);
  const gallery = (Array.isArray(product.gallery) ? product.gallery : [])
    .map(httpsUrl)
    .filter(Boolean)
    .slice(0, MAX_GALLERY_IMAGES);

  return {
    id,
    name: singleLine(product.name),
    model: singleLine(product.model) || derivedModel || 'Himawari',
    price: Number.isFinite(Number(product.price)) ? Math.round(Number(product.price)) : 0,
    tagline: singleLine(product.tagline),
    description: multiLine(product.description) || singleLine(product.tagline),
    highlights: (Array.isArray(product.highlights) ? product.highlights : []).map(singleLine).filter(Boolean).slice(0, 8),
    image,
    gallery,
    url: httpsUrl(product.url),
    featured: product.featured === true,
    curatedRank: Number.isFinite(Number(product.curatedRank)) ? Number(product.curatedRank) : null,
    createdAt: singleLine(product.createdAt),
    requestId: singleLine(product.requestId),
    managedImages: (Array.isArray(product.managedImages) ? product.managedImages : []).map(httpsUrl).filter(Boolean),
  };
}

export function seedCatalog() {
  return {
    version: 1,
    revision: 1,
    updatedAt: seedPayload.collectedAt ? `${seedPayload.collectedAt}T00:00:00.000Z` : new Date(0).toISOString(),
    products: (Array.isArray(seedPayload.products) ? seedPayload.products : []).map(normalizeProduct),
  };
}

export function publicProduct(product) {
  const { requestId, managedImages, ...visible } = normalizeProduct(product);
  return visible;
}

function validateProductFields(input) {
  const value = {
    name: singleLine(input.name),
    model: singleLine(input.model),
    price: Number(input.price),
    tagline: singleLine(input.tagline),
    description: multiLine(input.description),
    highlights: (Array.isArray(input.highlights) ? input.highlights : []).map(singleLine).filter(Boolean),
    url: httpsUrl(input.url),
  };
  const fieldErrors = {};

  if (value.name.length < 2 || value.name.length > 160) fieldErrors.name = '제품명은 2~160자로 입력해 주세요.';
  if (!value.model || value.model.length > 50) fieldErrors.model = '모델명은 50자 이내로 입력해 주세요.';
  if (!Number.isInteger(value.price) || value.price < 1 || value.price > 10_000_000) fieldErrors.price = '가격은 1원 이상 1,000만원 이하의 숫자로 입력해 주세요.';
  if (value.tagline.length < 5 || value.tagline.length > 120) fieldErrors.tagline = '한 줄 소개는 5~120자로 입력해 주세요.';
  if (value.description.length < 20 || value.description.length > 3_000) fieldErrors.description = '상세 설명은 20~3,000자로 입력해 주세요.';
  if (!value.highlights.length || value.highlights.length > 8 || value.highlights.some((item) => item.length > 100)) {
    fieldErrors.highlights = '제품 포인트를 줄마다 입력해 주세요. 최대 8개, 각 100자까지 가능합니다.';
  }
  try {
    const storeUrl = new URL(value.url);
    if (storeUrl.hostname !== 'smartstore.naver.com') throw new Error();
  } catch {
    fieldErrors.url = '네이버 스마트스토어 제품 주소를 입력해 주세요.';
  }

  return { value, fieldErrors };
}

export function validateProductInput(input) {
  const fields = validateProductFields(input);
  const value = {
    ...fields.value,
    requestId: singleLine(input.requestId),
    image: httpsUrl(input.image),
    gallery: (Array.isArray(input.gallery) ? input.gallery : []).map(httpsUrl).filter(Boolean),
    managedImages: (Array.isArray(input.managedImages) ? input.managedImages : []).map(httpsUrl).filter(Boolean),
  };
  const fieldErrors = { ...fields.fieldErrors };

  if (!REQUEST_ID_PATTERN.test(value.requestId)) fieldErrors.form = '등록 요청을 새로 시작해 주세요.';
  if (!value.image) fieldErrors.mainImage = '대표 이미지를 선택해 주세요.';
  if (value.gallery.length > MAX_GALLERY_IMAGES) fieldErrors.gallery = `상세 이미지는 최대 ${MAX_GALLERY_IMAGES}개까지 등록할 수 있습니다.`;
  const allImages = [value.image, ...value.gallery];
  if (
    new Set(value.managedImages).size !== value.managedImages.length
    || new Set(allImages).size !== allImages.length
    || allImages.length !== value.managedImages.length
    || allImages.some((url) => !value.managedImages.includes(url))
  ) {
    fieldErrors.mainImage = '이 관리자 화면에서 업로드한 이미지만 새 제품에 사용할 수 있습니다.';
  }

  return { value, fieldErrors, valid: Object.keys(fieldErrors).length === 0 };
}

export function validateProductUpdateInput(input, currentProduct = null) {
  const fields = validateProductFields(input);
  const replaceMainImage = input.replaceMainImage === true;
  const replaceGallery = input.replaceGallery === true;
  const value = {
    ...fields.value,
    requestId: singleLine(input.requestId),
    replaceMainImage,
    replaceGallery,
    image: replaceMainImage ? httpsUrl(input.image) : '',
    gallery: replaceGallery
      ? (Array.isArray(input.gallery) ? input.gallery : []).map(httpsUrl).filter(Boolean)
      : [],
    managedImages: (Array.isArray(input.managedImages) ? input.managedImages : []).map(httpsUrl).filter(Boolean),
  };
  const fieldErrors = { ...fields.fieldErrors };
  const current = currentProduct ? normalizeProduct(currentProduct) : null;
  const replacementImages = [
    ...(replaceMainImage && value.image ? [value.image] : []),
    ...(replaceGallery ? value.gallery : []),
  ];

  if (current) {
    for (const name of ['name', 'model', 'price', 'tagline', 'description', 'url']) {
      if (fieldErrors[name] && value[name] === current[name]) delete fieldErrors[name];
    }
    if (
      fieldErrors.highlights
      && value.highlights.length === current.highlights.length
      && value.highlights.every((item, index) => item === current.highlights[index])
    ) {
      delete fieldErrors.highlights;
    }
  }

  if (replaceMainImage && !value.image) fieldErrors.mainImage = '새 대표 이미지를 다시 선택해 주세요.';
  if (value.gallery.length > MAX_GALLERY_IMAGES) fieldErrors.gallery = `상세 이미지는 최대 ${MAX_GALLERY_IMAGES}개까지 등록할 수 있습니다.`;
  if (replacementImages.length && !REQUEST_ID_PATTERN.test(value.requestId)) fieldErrors.form = '이미지 교체 요청을 새로 시작해 주세요.';
  if (
    new Set(value.managedImages).size !== value.managedImages.length
    || new Set(replacementImages).size !== replacementImages.length
    || replacementImages.some((url) => !value.managedImages.includes(url))
    || value.managedImages.some((url) => !replacementImages.includes(url))
  ) {
    fieldErrors.mainImage = '이 관리자 화면에서 새로 업로드한 이미지만 교체에 사용할 수 있습니다.';
  }

  return { value, fieldErrors, valid: Object.keys(fieldErrors).length === 0 };
}

export function mergeProductMedia(product, update) {
  const current = normalizeProduct(product);
  const currentManaged = new Set(current.managedImages);
  const removedCandidates = [];
  let image = current.image;
  let gallery = [...current.gallery];

  if (update.replaceMainImage) {
    if (currentManaged.has(current.image)) removedCandidates.push(current.image);
    image = update.image;
  }
  if (update.replaceGallery) {
    removedCandidates.push(...current.gallery.filter((url) => currentManaged.has(url)));
    gallery = [...update.gallery];
  }

  const referenced = new Set([image, ...gallery]);
  const removedManagedImages = [...new Set(removedCandidates)].filter((url) => !referenced.has(url));
  const managedImages = [
    ...current.managedImages.filter((url) => !removedManagedImages.includes(url) && referenced.has(url)),
    ...update.managedImages,
  ].filter((url, index, list) => referenced.has(url) && list.indexOf(url) === index);

  return { image, gallery, managedImages, removedManagedImages };
}

export function updateProductRecord(product, value, media) {
  const current = normalizeProduct(product);
  return normalizeProduct({
    ...current,
    name: value.name,
    model: value.model,
    price: value.price,
    tagline: value.tagline,
    description: value.description,
    highlights: value.highlights,
    url: value.url,
    image: media.image,
    gallery: media.gallery,
    managedImages: media.managedImages,
    id: current.id,
    createdAt: current.createdAt,
    requestId: current.requestId,
  });
}

async function verifyManagedImage(requestId, url, maximumSize, kind = '') {
  const prefix = `product-media/${requestId}/`;
  let metadata;
  try {
    metadata = await head(url, { token: productToken() });
  } catch {
    throw Object.assign(new Error('업로드된 이미지를 확인할 수 없습니다. 이미지를 다시 선택해 주세요.'), { status: 400 });
  }
  const relativePath = metadata.pathname.startsWith(prefix) ? metadata.pathname.slice(prefix.length) : '';
  const mainRoleMatches = /^main(?:[-.])/.test(relativePath);
  const galleryRoleMatches = /^gallery-\d+(?:[-.])/.test(relativePath);
  const roleMatches = kind === 'main'
    ? mainRoleMatches
    : kind === 'gallery'
      ? galleryRoleMatches
      : mainRoleMatches || galleryRoleMatches;
  if (!roleMatches || !IMAGE_TYPES.has(metadata.contentType) || metadata.size > maximumSize) {
    throw Object.assign(new Error('허용되지 않은 이미지가 포함되어 있습니다.'), { status: 400 });
  }
  return metadata.url;
}

export async function verifyManagedImages(requestId, { mainImage = '', gallery = [] } = {}) {
  const normalizedMainImage = httpsUrl(mainImage);
  const normalizedGallery = (Array.isArray(gallery) ? gallery : []).map(httpsUrl).filter(Boolean);
  const urls = [...(normalizedMainImage ? [normalizedMainImage] : []), ...normalizedGallery];
  if (
    !REQUEST_ID_PATTERN.test(requestId)
    || !urls.length
    || normalizedGallery.length > MAX_GALLERY_IMAGES
    || new Set(urls).size !== urls.length
  ) {
    throw Object.assign(new Error('업로드 이미지를 확인할 수 없습니다.'), { status: 400 });
  }

  const verifiedMainImage = normalizedMainImage
    ? await verifyManagedImage(requestId, normalizedMainImage, MAX_MAIN_IMAGE_SIZE, 'main')
    : '';
  const verifiedGallery = [];
  for (const url of normalizedGallery) {
    verifiedGallery.push(await verifyManagedImage(requestId, url, MAX_GALLERY_IMAGE_SIZE, 'gallery'));
  }
  return { mainImage: verifiedMainImage, gallery: verifiedGallery };
}

export async function verifyManagedImageOwnership(requestId, urls) {
  const normalizedUrls = (Array.isArray(urls) ? urls : []).map(httpsUrl).filter(Boolean);
  if (
    !REQUEST_ID_PATTERN.test(requestId)
    || !normalizedUrls.length
    || normalizedUrls.length > MAX_GALLERY_IMAGES + 1
    || new Set(normalizedUrls).size !== normalizedUrls.length
  ) {
    throw Object.assign(new Error('업로드 이미지를 확인할 수 없습니다.'), { status: 400 });
  }
  const verified = [];
  for (const url of normalizedUrls) {
    verified.push(await verifyManagedImage(requestId, url, MAX_GALLERY_IMAGE_SIZE));
  }
  return verified;
}

export function createProductRecord(value, existingProducts) {
  const base = slug(value.model) || 'product';
  const suffix = value.requestId.slice(0, 8);
  let id = `${base}-${suffix}`;
  let attempt = 1;
  while (existingProducts.some((product) => product.id === id)) {
    id = `${base}-${suffix}-${attempt}`;
    attempt += 1;
  }

  return normalizeProduct({
    ...value,
    id,
    createdAt: new Date().toISOString(),
    featured: false,
    curatedRank: null,
  });
}

export async function readProductCatalog() {
  if (!productStoreIsConfigured()) return { catalog: seedCatalog(), etag: null, persisted: false };

  try {
    const result = await get(CATALOG_PATH, {
      access: 'public',
      token: productToken(),
      useCache: false,
    });
    if (!result || result.statusCode !== 200) return { catalog: seedCatalog(), etag: null, persisted: false };
    const parsed = JSON.parse(await new Response(result.stream).text());
    const products = (Array.isArray(parsed.products) ? parsed.products : []).map(normalizeProduct);
    return {
      catalog: {
        version: 1,
        revision: Number.isInteger(parsed.revision) ? parsed.revision : 1,
        updatedAt: singleLine(parsed.updatedAt) || new Date().toISOString(),
        products,
      },
      etag: result.blob.etag,
      persisted: true,
    };
  } catch (error) {
    if (error instanceof BlobNotFoundError) return { catalog: seedCatalog(), etag: null, persisted: false };
    throw error;
  }
}

export async function writeProductCatalog(catalog, etag) {
  const nextCatalog = {
    version: 1,
    revision: Number(catalog.revision || 0) + 1,
    updatedAt: new Date().toISOString(),
    products: catalog.products.map(normalizeProduct),
  };
  const options = {
    access: 'public',
    token: productToken(),
    addRandomSuffix: false,
    contentType: 'application/json; charset=utf-8',
    cacheControlMaxAge: 60,
    ...(etag ? { allowOverwrite: true, ifMatch: etag } : { allowOverwrite: false }),
  };
  const result = await put(CATALOG_PATH, JSON.stringify(nextCatalog), options);
  return { catalog: nextCatalog, etag: result.etag };
}

export async function deleteManagedImages(urls) {
  const unique = [...new Set((Array.isArray(urls) ? urls : []).map(httpsUrl).filter(Boolean))];
  if (!unique.length) return true;
  try {
    await del(unique, { token: productToken() });
    return true;
  } catch {
    return false;
  }
}

export {
  BlobPreconditionFailedError,
  IMAGE_TYPES,
  MAX_GALLERY_IMAGES,
  MAX_GALLERY_IMAGE_SIZE,
  MAX_MAIN_IMAGE_SIZE,
  REQUEST_ID_PATTERN,
};
