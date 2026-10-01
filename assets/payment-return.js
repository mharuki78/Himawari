const params = new URLSearchParams(location.search);
let context;
try { context = JSON.parse(sessionStorage.getItem('himawari-kakaopay-checkout')); } catch {}
const orderId = params.get('order') || context?.orderId || '';
const state = params.get('state') || context?.state || '';
const pgToken = params.get('pg_token') || '';
const outcome = params.get('outcome') || 'approval';
// Remove authentication material before any links or third-party scripts can see it.
history.replaceState(null,'',location.pathname);
const title = document.querySelector('#payment-result-title');
const message = document.querySelector('[data-payment-message]');
const retry = document.querySelector('[data-payment-retry]');
const orderLink = document.querySelector('[data-payment-order]');
const help = document.querySelector('[data-payment-help]');

async function request(url,body) {
  const response = await fetch(url,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || '결제 결과를 확인하지 못했습니다.');
  return result;
}

async function clearPurchasedItems() {
  if (!context || context.orderId!==orderId || context.state!==state || context.cleaned || !context.cartOrder) return;
  const bought = new Map((context.items || []).map(item=>[`${item.productId}::${item.optionId || ''}`,item.quantity]));
  if (context.memberOrder) {
    try {
      const response = await fetch('/api/member/cart',{cache:'no-store'});
      if (response.ok) {
        const cart = await response.json();
        const items = cart.items.flatMap(item=> {
          const quantity = item.quantity - (bought.get(`${item.productId}::${item.optionId || ''}`) || 0);
          return quantity>0 ? [{productId:item.productId,optionId:item.optionId || '',quantity}] : [];
        });
        await fetch('/api/member/cart',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({items})});
      }
    } catch { /* The paid order remains valid if cart cleanup is unavailable. */ }
  }
  if (window.SiteCart) window.SiteCart.replace(window.SiteCart.items().flatMap(item=> {
    const q = item.q - (bought.get(`${item.id}::${item.optionId || ''}`) || 0);
    return q>0 ? [{...item,q}] : [];
  }));
  context.cleaned = true;
  try { sessionStorage.setItem('himawari-kakaopay-checkout',JSON.stringify(context)); sessionStorage.removeItem('himawari-checkout-items'); } catch {}
}

async function confirm() {
  retry.hidden = true;
  message.textContent = '카카오페이 승인 결과와 주문금액을 확인하고 있습니다.';
  try {
    if (!orderId || !state) throw new Error('결제 확인 정보가 없습니다. 주문 내역에서 확인하거나 고객센터에 문의해 주세요.');
    const result = await request(`/api/kakaopay/${['cancel','fail'].includes(outcome) ? 'abandon' : 'finish'}`,{orderId,state,pgToken});
    help.hidden = true;
    document.querySelector('[data-payment-number]').textContent = result.orderNumber;
    document.querySelector('[data-payment-total]').textContent = new Intl.NumberFormat('ko-KR',{style:'currency',currency:'KRW',maximumFractionDigits:0}).format(result.total);
    document.querySelector('[data-payment-receipt]').hidden = false;
    orderLink.hidden = false;
    orderLink.href = context?.memberOrder ? 'account.html#orders' : `guest-order.html?order=${encodeURIComponent(result.orderNumber)}`;
    if (result.paid) {
      title.textContent = '결제가 완료되었습니다.';
      message.textContent = '카카오페이 결제 승인을 확인했습니다. 주문 내역에서 배송 상태를 확인할 수 있습니다.';
      await clearPurchasedItems();
    } else if (result.refunded) {
      title.textContent = '결제가 취소되었습니다.';
      message.textContent = '카카오페이에서 결제 취소를 확인했습니다. 주문 내역에서 처리 상태를 확인해 주세요.';
    } else if (result.phase==='closed') {
      title.textContent = '결제가 완료되지 않았습니다.';
      message.textContent = '결제하지 않은 주문을 종료했습니다. 장바구니의 상품은 유지됩니다.';
    } else {
      throw new Error('결제 결과 확인이 필요합니다. 다시 확인해 주세요.');
    }
  } catch (error) {
    title.textContent = '결제 결과를 다시 확인해 주세요.';
    message.textContent = `${error.message} 새 주문으로 결제하기 전에 이 주문의 결과를 확인해 주세요.`;
    retry.hidden = !orderId || !state;
    help.hidden = false;
  }
  document.title = `${title.textContent} — Himawari`;
  title.focus();
}
retry.addEventListener('click',confirm);
confirm();
