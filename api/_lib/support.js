import { getMember } from './member-auth.js';
import { readOrderForGuest, readOrderForMember } from './orders.js';

export function validateSupportAttachment(input) {
  if (!input) return null;
  const type = String(input.type || '');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type) || typeof input.data !== 'string' || input.data.length > 2_800_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.data)) throw Object.assign(new Error('사진은 JPG·PNG·WebP 형식, 2MB 이하만 가능합니다.'), { status: 400 });
  const bytes = Buffer.from(input.data, 'base64');
  const valid = type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : type === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid || bytes.length > 2 * 1024 * 1024 || bytes.length < 12) throw Object.assign(new Error('사진 파일 내용을 확인해 주세요.'), { status: 400 });
  return { type, data: bytes.toString('base64') };
}

export async function supportContext(request, input) {
  const type = ['product', 'order', 'repair', 'partnership'].includes(input.serviceType) ? input.serviceType : 'product';
  let orderNumber = '';
  if (input.orderNumber) {
    const member = await getMember(request);
    const order = member ? await readOrderForMember(member.id, input.orderNumber) : await readOrderForGuest({ orderNumber: input.orderNumber, email: input.email, phone: input.phone });
    if (!order) throw Object.assign(new Error('주문번호와 주문자 정보를 확인해 주세요.'), { status: 404 });
    orderNumber = order.orderNumber;
  }
  return { serviceType: type, orderNumber, productId: String(input.productId || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 100), attachment: validateSupportAttachment(input.attachment), status: 'received' };
}
