import { upload } from '@vercel/blob/client';
import { uploadProductImage } from './product-network.js';

const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };

export function setupBlackFridayBanner(form, onChange) {
  const input = form.querySelector('[data-bf-banner-file]');
  const alt = form.querySelector('[data-bf-banner-alt]');
  const preview = form.querySelector('[data-bf-banner-preview]');
  const empty = form.querySelector('[data-bf-banner-empty]');
  const remove = form.querySelector('[data-bf-banner-remove]');
  const cancel = form.querySelector('[data-bf-banner-cancel]');
  const status = form.querySelector('[data-bf-banner-status]');
  const progress = form.querySelector('[data-bf-banner-progress]');
  let banner = null, file = null, objectUrl = '', dimensions, requestId, controller, decoding = false;

  function releasePreview() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = '';
  }
  function show() {
    const src = objectUrl || banner?.url;
    preview.hidden = !src; empty.hidden = Boolean(src);
    if (src) { preview.src = src; preview.alt = alt.value || '블랙 프라이데이 배너 미리보기'; }
    else preview.removeAttribute('src');
    onChange();
  }
  function load(value) {
    releasePreview(); banner = value || null; file = null; input.value = '';
    alt.value = banner?.alt || '';
    status.textContent = ''; progress.hidden = true; show();
  }
  input.addEventListener('change', async () => {
    const selected = input.files[0];
    if (!selected) return;
    if (!extensions[selected.type] || selected.size > 8 * 1024 * 1024) {
      input.value = '';
      status.textContent = 'JPG·PNG·WebP·AVIF 파일을 8MB 이하로 선택해 주세요.';
      return;
    }
    decoding = true; onChange();
    const local = URL.createObjectURL(selected);
    try {
      const image = new Image(); image.src = local; await image.decode();
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 20000 || image.naturalHeight > 20000) throw new Error();
      releasePreview(); objectUrl = local; file = selected; banner = null;
      dimensions = { width: image.naturalWidth, height: image.naturalHeight };
      requestId = crypto.randomUUID();
      if (!alt.value.trim()) alt.value = '히마와리 블랙 프라이데이';
      status.textContent = '미리보기입니다. 아래 ‘행사 설정 저장’을 눌러 반영해 주세요.';
    } catch {
      URL.revokeObjectURL(local); input.value = '';
      status.textContent = '사진을 열 수 없습니다. 다른 이미지 파일을 선택해 주세요.';
    } finally { decoding = false; show(); }
  });
  alt.addEventListener('input', () => { preview.alt = alt.value || '블랙 프라이데이 배너 미리보기'; });
  remove.addEventListener('click', () => {
    load(null);
    status.textContent = '배너를 삭제하려면 아래 ‘행사 설정 저장’을 눌러 주세요.';
  });
  cancel.addEventListener('click', () => controller?.abort());
  addEventListener('pagehide', () => { controller?.abort(); releasePreview(); });

  return {
    load,
    isDecoding: () => decoding,
    sync(disabled) {
      input.disabled = alt.disabled = disabled || decoding;
      remove.disabled = disabled || decoding || !(file || banner);
      cancel.hidden = !controller;
    },
    async prepare() {
      if (file) {
        controller = new AbortController(); progress.hidden = false; progress.value = 0; onChange();
        status.textContent = '배너 이미지를 업로드하고 있습니다. 0%';
        try {
          const blob = await uploadProductImage(upload, `black-friday-banners/${requestId}/banner.${extensions[file.type]}`, file, {
            access: 'public', handleUploadUrl: '/api/admin/product-upload',
            clientPayload: JSON.stringify({ requestId, kind: 'black-friday-banner' }),
            abortSignal: controller.signal,
            onUploadProgress: event => {
              progress.value = Math.round(event.percentage);
              status.textContent = `배너 이미지를 업로드하고 있습니다. ${progress.value}%`;
            },
          });
          banner = { requestId, url: blob.url, ...dimensions, alt: alt.value.trim() };
          file = null; input.value = ''; releasePreview(); show();
          status.textContent = '이미지 업로드 완료. 행사 설정을 저장하고 있습니다.';
        } catch (error) {
          status.textContent = error.name === 'AbortError' ? '업로드를 취소했습니다. 다시 저장하면 재시도합니다.' : error.message;
          throw new Error(status.textContent);
        } finally { controller = null; progress.hidden = true; onChange(); }
      }
      return banner ? { ...banner, alt: alt.value.trim() || '히마와리 블랙 프라이데이' } : null;
    },
    saved(value) {
      load(value);
      status.textContent = value ? '배너를 저장했습니다. 행사 진행 중에 기획전 상단에 표시됩니다.' : '';
    },
  };
}
