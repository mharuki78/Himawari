import { getMember } from './member-auth.js';
import { listMemberOrders } from './orders.js';

export function isOrderQuestion(message) {
  return !/배송비|무료배송|택배비/.test(message) && /내 배송|주문.*(상태|조회|어디|언제|배송)|배송.*(상태|조회|어디|언제)|택배.*(어디|언제)|송장/.test(message);
}

// Identity comes exclusively from the verified server session, never from chat input.
export async function memberDeliveryAnswer(request, { memberReader = getMember, orderReader = listMemberOrders } = {}) {
  try {
    const member = await memberReader(request);
    if (!member) return {answer:'로그인 후 내 배송 조회를 눌러 주세요. 해당 계정으로 홈페이지에서 주문한 내역을 확인할 수 있습니다.',link:'/account.html',mode:'orders'};
    const result = await orderReader(member.id, 1);
    const orders = result.items.slice(0, 5);
    if (!orders.length) return {answer:'현재 로그인한 계정에 연결된 홈페이지 주문이 없습니다. 비회원 주문과 Npay·네이버·쿠팡 등 외부 주문은 해당 구매처의 주문 내역에서 확인해 주세요.',link:'/account.html#orders',mode:'orders'};
    const lines = orders.map(order => {
      const date = new Date(order.createdAt).toLocaleDateString('ko-KR', {timeZone:'Asia/Seoul'});
      const tracking = order.delivery?.trackingNumber;
      return `${date} · ${order.orderNumber}\n${order.statusLabel}\n${tracking ? `${order.delivery.carrier || '택배사'} · 송장 ${tracking}` : '송장번호가 아직 등록되지 않았습니다.'}`;
    });
    return {answer:`최근 주문 ${orders.length}건의 등록된 상태입니다.\n\n${lines.join('\n\n')}\n\n관리자가 등록한 주문·배송 정보이며 택배사의 실시간 위치는 아닙니다. 전체 주문은 아래에서 확인해 주세요.`,link:'/account.html#orders',mode:'orders'};
  } catch {
    return {answer:'지금 주문 정보를 불러오지 못했습니다. 잠시 후 내 배송 조회를 다시 눌러 주세요.',link:'/account.html#orders',mode:'orders'};
  }
}
