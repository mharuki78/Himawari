import { handleUpload } from '@vercel/blob/client';

import { authIsConfigured, isAdminRequest } from '../_lib/auth.js';
import { isSameOrigin, json, methodNotAllowed, readJson } from '../_lib/http.js';
import {
  IMAGE_TYPES,
  MAX_GALLERY_IMAGE_SIZE,
  MAX_MAIN_IMAGE_SIZE,
  REQUEST_ID_PATTERN,
  productStoreIsConfigured,
} from '../_lib/products.js';

export async function fetch(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  if (!productStoreIsConfigured()) return json({ message: '제품 이미지 저장소 설정이 완료되지 않았습니다.' }, 503);

  try {
    const body = await readJson(request, 32_768);
    const isTokenRequest = body.type === 'blob.generate-client-token';
    if (isTokenRequest) {
      if (!authIsConfigured() || !isAdminRequest(request)) return json({ message: '관리자 로그인이 필요합니다.' }, 401);
      if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
    } else if (body.type !== 'blob.upload-completed') {
      return json({ message: '업로드 요청 형식을 확인해 주세요.' }, 400);
    }

    const result = await handleUpload({
      body,
      request,
      token: process.env.PRODUCT_BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload;
        try {
          payload = JSON.parse(clientPayload || '{}');
        } catch {
          throw new Error('업로드 정보를 확인할 수 없습니다.');
        }
        const requestId = typeof payload.requestId === 'string' ? payload.requestId : '';
        const kind = payload.kind === 'main' || payload.kind === 'gallery' ? payload.kind : '';
        const prefix = `product-media/${requestId}/`;
        const rolePath = kind === 'main' ? `${prefix}main.` : `${prefix}gallery-`;
        if (!REQUEST_ID_PATTERN.test(requestId) || !kind || !pathname.startsWith(rolePath)) {
          throw new Error('업로드 경로를 확인할 수 없습니다.');
        }
        return {
          allowedContentTypes: [...IMAGE_TYPES],
          maximumSizeInBytes: kind === 'main' ? MAX_MAIN_IMAGE_SIZE : MAX_GALLERY_IMAGE_SIZE,
          addRandomSuffix: true,
          allowOverwrite: false,
          cacheControlMaxAge: 31_536_000,
          validUntil: Date.now() + 15 * 60 * 1000,
          tokenPayload: JSON.stringify({ requestId, kind }),
        };
      },
      onUploadCompleted: async () => {},
    });
    return json(result);
  } catch (error) {
    return json({ message: error.message || '이미지를 업로드하지 못했습니다.' }, Number(error.status) || 400);
  }
}
