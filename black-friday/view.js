import { discountPercent } from './pricing.js';

const ORIGIN = 'https://himawari.co.kr';
export const EVENT_PATH = '/black-friday/';
const TITLE = '블랙 프라이데이';
const DESCRIPTION = '히마와리 블랙 프라이데이 행사 일정과 상품을 확인하세요.';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const money = new Intl.NumberFormat('ko-KR');
const date = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const lastKoreanDay = end => new Date(Date.parse(end) - 1 + 9 * 3600_000).toISOString().slice(0, 10);

const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
export const jsonLdText = data => JSON.stringify(data).replace(/</g, '\\u003c');
export const offerPath = id => typeof id === 'string' && uuid.test(id) ? EVENT_PATH + 'item/' + id.toLowerCase() + '/' : '';
const offerName = item => item.optionLabel ? item.name + ' · ' + item.optionLabel : item.name;

function photoUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, ORIGIN);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

function priceBands(items) {
  const groups = new Map();
  for (const item of [...items].sort((a, b) => a.price - b.price)) {
    const band = Math.floor(item.price / 10000);
    if (!groups.has(band)) groups.set(band, []);
    groups.get(band).push(item);
  }
  return groups;
}

const bandLabel = band => band ? `${money.format(band)}만원대` : '1만원 미만';

function card(item, detail, band) {
  const image = photoUrl(item.image);
  const label = escape(offerName(item));
  const path = offerPath(item.offerId);
  const model = [item.model, !detail && item.optionLabel].filter(Boolean).join(' · ');
  const remaining = item.remaining > 0 ? '행사 수량 ' + money.format(item.remaining) + '개 남음' : '행사 수량 소진';
  const discount = discountPercent(item.regularPrice, item.price);
  const discountLabel = discount === 0 ? '1% 미만' : `${discount}%`;
  const info = detail ? '' : `<a class="bf-event__detail-link" data-bf-focus="details:${item.offerId}" href="${path}" aria-label="${label} 상품 정보">상품 정보 <span aria-hidden="true">→</span></a>`;
  const buy = item.remaining > 0 ? `<a class="bf-event__buy" data-bf-focus="buy:${item.offerId}" href="/checkout.html?blackFriday=${item.offerId}" aria-label="${label} 행사가로 구매">행사가로 구매</a>` : '';
  const add = item.remaining > 0 ? `<button type="button" class="bf-event__add" data-bf-focus="cart:${item.offerId}" data-cart-add data-black-friday-offer-id="${item.offerId}" data-product-id="${escape(item.productId)}" data-option-id="${escape(item.optionId)}" data-option-label="${escape(item.optionLabel)}" data-name="${escape(item.name)}" data-price="${item.price}" data-stock="${item.remaining}" aria-label="${label} 행사가로 장바구니 담기">장바구니 담기</button>` : '';
  const anchor = band === undefined ? '' : ` id="bf-price-${band}" tabindex="-1" data-bf-focus="start:${band}"`;
  return `<article class="bf-event__card${detail ? ' bf-event__card--detail' : ''}"${anchor}>
    <div class="bf-event__media">${image ? `<img src="${escape(image)}" alt="" ${detail ? '' : 'loading="lazy" '}decoding="async">` : ''}</div>
    <div class="bf-event__details">${model ? `<p class="bf-event__model">${escape(model)}</p>` : ''}
      ${detail ? '' : `<h2><a href="${path}" data-bf-focus="title:${item.offerId}">${escape(item.name)}</a></h2>`}
      <p class="bf-event__prices"><del><span class="sr-only">정상가 </span>${money.format(item.regularPrice)}원</del><strong><span class="sr-only">행사가 </span>${money.format(item.price)}원</strong>${discount === null ? '' : `<span class="bf-event__discount"><span class="sr-only">할인율 </span>${discountLabel}</span>`}</p>
      <p class="bf-event__remaining${item.remaining > 0 ? '' : ' bf-event__remaining--sold-out'}">${remaining}</p>
      <div class="bf-event__card-actions">${buy}${add}${info}</div>
    </div></article>`;
}

export function blackFridayView(event, offerId = '') {
  const detail = Boolean(offerId);
  const eventOpen = event.state === 'open' && Number.isFinite(Date.parse(event.endsAt)) &&
    (!event.serverTime || Date.parse(event.serverTime) < Date.parse(event.endsAt));
  const groups = priceBands(eventOpen ? (event.items || []).filter(item => offerPath(item.offerId)) : []);
  const items = [...groups.values()].flat();
  const selected = detail ? items.find(item => item.offerId.toLowerCase() === offerId.toLowerCase()) : null;
  const visible = detail ? (selected ? [selected] : []) : items;
  const path = (detail && offerPath(offerId)) || EVENT_PATH;
  const canonical = ORIGIN + path;
  const title = selected ? offerName(selected) : TITLE;
  const description = selected ? offerName(selected) + '의 히마와리 블랙 프라이데이 행사가와 남은 수량을 확인하세요.' : DESCRIPTION;
  const period = event.startsAt && event.endsAt && Number.isFinite(Date.parse(event.startsAt)) && Number.isFinite(Date.parse(event.endsAt))
    ? Date.parse(event.startsAt) < Date.parse(event.endsAt) ? date.formatRange(new Date(event.startsAt), new Date(event.endsAt)) + ' (한국 시간)' : '' : '';
  const label = detail && !selected && eventOpen ? '현재 판매하는 행사 상품이 아닙니다.' : ({
    inactive: '현재 진행 중인 행사가 없습니다.',
    scheduled: '행사가 시작되면 이곳에서 상품을 구매할 수 있습니다.',
    closed: '블랙 프라이데이 행사가 종료됐습니다.',
    open: visible.length ? '이 페이지에서 구매할 때 행사가가 적용됩니다.' : '현재 구매할 수 있는 행사 상품이 없습니다.',
    error: '행사 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.',
  })[!eventOpen && event.state === 'open' ? 'closed' : event.state];
  let schema = null;
  if (selected) {
    const image = photoUrl(selected.image);
    schema = {
      '@context': 'https://schema.org', '@type': 'Product', name: title, url: canonical,
      ...(image ? { image: [image] } : {}),
      brand: { '@type': 'Brand', name: 'Himawari' },
      offers: {
        '@type': 'Offer', url: canonical, priceCurrency: 'KRW', price: selected.price,
        availability: 'https://schema.org/' + (selected.remaining > 0 ? 'InStock' : 'OutOfStock'),
        priceValidUntil: lastKoreanDay(event.endsAt),
        validThrough: event.endsAt,
      },
    };
  } else if (!detail && event.state !== 'error') {
    schema = {
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: TITLE, url: canonical,
      description: DESCRIPTION, inLanguage: 'ko-KR',
      ...(items.length ? { mainEntity: { '@type': 'ItemList', itemListElement: items.map((item, i) => ({
        '@type': 'ListItem', position: i + 1, url: ORIGIN + offerPath(item.offerId), name: offerName(item),
      })) } } : {}),
    };
  }
  const navigation = !detail && groups.size ? `<nav class="bf-event__bands" aria-label="행사가 가격대">${[...groups].map(([band]) =>
    `<a class="hmw-btn bf-event__band-link" data-bf-jump data-bf-focus="band:${band}" href="#bf-price-${band}">${bandLabel(band)} <span aria-hidden="true">↓</span></a>`
  ).join('')}</nav>` : '';
  const products = detail
    ? `<div class="bf-event__grid--detail" data-bf-products>${visible.map(item => card(item, true)).join('')}</div>`
    : `<div class="bf-event__grid" data-bf-products>${[...groups].flatMap(([band, entries]) =>
      entries.map((item, index) => card(item, false, index === 0 ? band : undefined))
    ).join('')}</div>`;
  const banner = !detail && eventOpen && event.banner ? event.banner : null;
  const bannerUrl = banner && photoUrl(banner.url);
  const dimensions = banner && [banner.width, banner.height].every(size => Number.isSafeInteger(size) && size > 0 && size <= 20000)
    ? ` width="${banner.width}" height="${banner.height}"` : '';
  const bannerMarkup = bannerUrl ? `<div class="bf-event__banner"><img src="${escape(bannerUrl)}" alt="${escape(banner.alt || '히마와리 블랙 프라이데이')}"${dimensions} fetchpriority="high" decoding="async"></div>` : '';
  const intro = detail ? `<div class="bf-event__intro${selected ? ' bf-event__intro--detail' : ''}">
      <p class="bf-event__kicker">HIMAWARI · BLACK FRIDAY</p>
      <h1>${escape(title)}</h1>
      ${period ? `<p data-bf-period>${escape(period)}</p>` : ''}
    </div>` : `<h1 class="sr-only">${escape(title)}</h1>`;
  const content = `${bannerMarkup}${intro}<div class="bf-event__body">
      <p class="bf-event__status" data-bf-status role="status" aria-live="polite">${escape(label)}</p>
      ${navigation}
      ${products}
      ${detail ? '<a class="bf-event__browse" href="/black-friday/">행사 목록 보기 <span aria-hidden="true">→</span></a>' : ''}
      <a class="bf-event__browse" href="/products.html">전체 가방 보기 <span aria-hidden="true">→</span></a>
    </div>`;
  return { title: title + ' — Himawari', description, canonical, schema, content, status: event.state === 'error' ? 503 : detail && !selected ? 404 : 200 };
}

export function renderBlackFridayPage(template, event, offerId = '') {
  const view = blackFridayView(event, offerId);
  const metadata = `<title>${escape(view.title)}</title>
  <meta name="description" content="${escape(view.description)}">
  <link rel="canonical" href="${view.canonical}">
  <meta name="robots" content="${view.status === 200 ? 'index,follow' : 'noindex,follow'}">
  ${view.schema ? `<script id="bf-json-ld" type="application/ld+json">${jsonLdText(view.schema)}</script>` : ''}`;
  const deadline = event.state === 'open' && Number.isFinite(Date.parse(event.serverTime))
    ? ` data-bf-starts="${escape(event.startsAt)}" data-bf-ends="${escape(event.endsAt)}" data-bf-time="${escape(event.serverTime)}"` : '';
  const html = template.replace('<!-- BLACK_FRIDAY_HEAD --><meta name="robots" content="noindex,follow">', () => metadata)
    .replace('<!-- BLACK_FRIDAY_MAIN -->', () => `<main id="main" class="bf-event" data-bf-offer="${escape(offerId)}"${deadline}>${view.content}</main>`);
  return { html, status: view.status };
}
