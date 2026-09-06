import { json, methodNotAllowed } from './_lib/http.js';
import { publicPromotions, readPromotions } from './_lib/promotions.js';

export async function fetch(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const { config } = await readPromotions();
    return json(publicPromotions(config));
  } catch (error) {
    console.error('public_promotions_read_failed', { message: error.message || 'unknown error' });
    return json({ message: '프로모션 정보를 불러오지 못했습니다.' }, 500);
  }
}
