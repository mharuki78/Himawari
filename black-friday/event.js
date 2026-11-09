const status = document.querySelector('[data-bf-status]');
const grid = document.querySelector('[data-bf-products]');
const period = document.querySelector('[data-bf-period]');
const date = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const won = new Intl.NumberFormat('ko-KR');
let timer, loading = false, lastItems;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function card(item) {
  const article = element('article', 'bf-event__card');
  const media = element('div', 'bf-event__media');
  if (item.image) {
    const photo = document.createElement('img');
    photo.src = item.image; photo.alt = ''; photo.loading = 'lazy'; photo.decoding = 'async';
    media.append(photo);
  }
  const details = element('div', 'bf-event__details');
  const model = element('p', 'bf-event__model', [item.model, item.optionLabel].filter(Boolean).join(' · '));
  const name = element('h2', '', item.name);
  const prices = element('p', 'bf-event__prices');
  const original = element('del', '', `${won.format(item.regularPrice)}원`);
  original.prepend(element('span', 'sr-only', '정상가 '));
  const price = element('strong', '', `${won.format(item.price)}원`);
  price.prepend(element('span', 'sr-only', '행사가 '));
  prices.append(original, price);
  const remaining = element('p', 'bf-event__remaining', item.remaining ? `행사 수량 ${won.format(item.remaining)}개 남음` : '행사 수량 소진');
  details.append(model, name, prices, remaining);
  if (item.remaining > 0) {
    const checkout = element('a', 'bf-event__buy', '행사가로 구매');
    checkout.href = `/checkout.html?blackFriday=${encodeURIComponent(item.offerId)}`;
    checkout.dataset.offerId = item.offerId;
    checkout.setAttribute('aria-label', `${item.name}${item.optionLabel ? ' ' + item.optionLabel : ''} 행사가로 구매`);
    details.append(checkout);
  }
  article.append(media, details);
  return article;
}

function render({ state, startsAt, endsAt, items = [] }) {
  period.hidden = !startsAt || !endsAt;
  if (!period.hidden) period.textContent = `${date.format(new Date(startsAt))} ~ ${date.format(new Date(endsAt))} (한국 시간)`;
  const label = {
    inactive: '현재 진행 중인 행사가 없습니다.',
    scheduled: '행사가 시작되면 이곳에서 상품을 구매할 수 있습니다.',
    closed: '블랙 프라이데이 행사가 종료됐습니다.',
    open: items.length ? '이 페이지에서 구매할 때 행사가가 적용됩니다.' : '현재 구매할 수 있는 행사 상품이 없습니다.',
    error: '행사 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.',
  }[state];
  if (status.textContent !== label) status.textContent = label;
  const snapshot = JSON.stringify(items);
  if (lastItems !== snapshot) {
    const focus = document.activeElement?.dataset.offerId;
    grid.replaceChildren(...items.map(card));
    if (focus) [...grid.querySelectorAll('[data-offer-id]')].find(node => node.dataset.offerId === focus)?.focus({ preventScroll: true });
    lastItems = snapshot;
  }
}

async function refresh() {
  if (loading) return;
  loading = true;
  clearTimeout(timer);
  let delay = 30_000;
  try {
    const response = await fetch('/api/black-friday', { cache: 'no-store' });
    if (!response.ok) throw new Error('Unavailable');
    const event = await response.json();
    render(event);
    const boundary = event.state === 'scheduled' ? event.startsAt : event.state === 'open' ? event.endsAt : null;
    if (boundary) delay = Math.max(250, Math.min(delay, Date.parse(boundary) - Date.parse(event.serverTime) + 100));
  } catch { render({ state: 'error' }); }
  finally { loading = false; timer = setTimeout(refresh, delay); }
}

document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
refresh();
