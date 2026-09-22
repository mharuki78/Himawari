import { PUBLIC_SPEC_FIELDS as SPEC_FIELDS } from './product-specs.js';
import { parseExternalDimensions } from './product-facts.js';

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

export function renderProductGuidance(product, products = []) {
  let section = document.querySelector('[data-product-guidance]');
  if (!section) {
    section = node('section', 'product-guidance');
    section.dataset.productGuidance = '';
    document.querySelector('.product-description')?.after(section);
  }
  section.id = 'product-specifications';
  section.setAttribute('aria-labelledby', 'product-guidance-title');
  const inner = node('div', 'product-guidance__inner');
  const header = node('header', 'product-guidance__header');
  const heading = node('h2', '', '내 하루에 맞는 크기.');
  heading.id = 'product-guidance-title';
  header.append(node('p', 'product-guidance__eyebrow', '크기와 소재'), heading,
    node('p', 'product-guidance__intro', '매일 담는 물건부터 노트북까지. 선택하기 전, 가방의 사양을 살펴보세요.'));
  const body = node('div', 'product-guidance__body');
  const figure = node('figure', 'product-guidance__visual');
  const image = node('img');
  image.src = product.image || '/assets/favicon.png';
  image.alt = product.name || 'Himawari 제품';
  image.loading = 'lazy'; image.decoding = 'async'; image.width = 640; image.height = 640;
  image.addEventListener('error', () => { image.hidden = true; }, { once: true });
  figure.append(image, node('figcaption', '', product.model || 'Himawari'));
  const size = parseExternalDimensions(product.specs?.dimensions);
  if (size) {
    const [width, height, depth] = size;
    const diagram = node('div', 'product-size-reference');
    diagram.setAttribute('role', 'img');
    diagram.setAttribute('aria-label', `외부 크기 가로 ${width}, 세로 ${height}, 폭 ${depth}cm. A4 용지 가로 21, 세로 29.7cm와 크기만 비교한 도식이며 실제 수납 여부를 보장하지 않습니다.`);
    const canvas = node('div', 'product-size-reference__canvas');
    const scale = 200 / Math.max(height, 29.7, width, 21);
    const outline = node('div', 'product-size-reference__bag', '외부 크기');
    outline.style.width = `${width * scale}px`; outline.style.height = `${height * scale}px`;
    const paper = node('div', 'product-size-reference__paper', 'A4');
    paper.style.width = `${21 * scale}px`; paper.style.height = `${29.7 * scale}px`;
    canvas.append(outline, paper);
    diagram.append(node('strong', '', `${width} × ${height} × ${depth} cm`), canvas,
      node('p', '', '외부 크기와 A4(21 × 29.7cm) 비교 도식. 가방 형태를 단순화했으며 실제 수납 여부와는 다릅니다.'));
    figure.append(diagram);
  }
  const content = node('div', 'product-guidance__content');
  const known = SPEC_FIELDS.filter(([key]) => String(product.specs?.[key] || '').trim());
  const missing = SPEC_FIELDS.filter(([key]) => !String(product.specs?.[key] || '').trim());
  content.append(node('h3', 'product-guidance__subheading', known.length ? '제품 사양' : '궁금한 사양, 먼저 확인하세요.'));
  if (known.length) {
    const list = node('dl', 'product-guidance__specs');
    for (const [key, label] of known) {
      const row = node('div');
      row.append(node('dt', '', label), node('dd', '', String(product.specs[key])));
      list.append(row);
    }
    content.append(list);
  } else {
    content.append(node('p', 'product-guidance__description', '이 제품의 상세 실측 정보는 아직 등록되지 않았습니다. 필요한 크기와 소재는 구매 전 문의해 주세요.'));
  }
  if (missing.length) {
    const details = node('details', 'product-guidance__missing');
    details.append(node('summary', '', `확인이 필요한 항목 ${missing.length}개`));
    const list = node('ul');
    for (const [, label] of missing) list.append(node('li', '', label));
    details.append(list); content.append(details);
  }
  const tip = node('aside', 'product-guidance__tip');
  tip.append(node('strong', '', '노트북을 넣을 예정이라면'), node('p', '', '화면 인치보다 기기의 가로·세로·두께와 수납칸 실측을 비교해 주세요.'));
  const links = node('nav', 'product-guidance__links');
  links.setAttribute('aria-label', '제품 사양 도움말');
  for (const [label, href] of [['제품·수선 문의', `support.html?product=${encodeURIComponent(product.id)}`], ['다른 제품과 비교', `compare.html?products=${encodeURIComponent(product.id)}`], ['관리 방법 보기', 'care.html']]) {
    const link = node('a', '', label); link.href = href;
    const arrow = node('span', '', '↗'); arrow.setAttribute('aria-hidden', 'true'); link.append(arrow); links.append(link);
  }
  content.append(tip, links); body.append(figure, content); inner.append(header, body);
  const related = products.filter(p => p.id !== product.id && product.relatedProductIds?.includes(p.id));
  if (related.length) {
    const group = node('div', 'product-guidance__related');
    group.append(node('h3', '', '함께 사용할 수 있는 구성품'));
    const list = node('ul');
    for (const item of related) {
      const li = node('li'); const a = node('a', '', item.name + (item.soldOut ? ' · 품절' : ''));
      a.href = `product.html?id=${encodeURIComponent(item.id)}`; li.append(a); list.append(li);
    }
    group.append(list); inner.append(group);
  }
  section.replaceChildren(inner);
  loadRelatedStories(product, section);
}

async function loadRelatedStories(product, section) {
  try {
    const response = await fetch('/story/posts.json');
    if (!response.ok) return;
    const posts = await response.json();
    const model = String(product.model || '').toLowerCase().replace(/\s/g, '');
    if (!model || model === 'himawari') return;
    const related = posts.filter(post => {
      const models = [post.title, post.summary, post.imageAlt, ...(post.tags || [])].join(' ').match(/No\.?\s*\d{3,5}[a-z]?/gi) || [];
      return models.some(value => value.toLowerCase().replace(/\s/g, '') === model);
    }).slice(0, 3);
    if (!related.length) return;
    const group = node('section', 'product-related-stories');
    group.setAttribute('aria-label', '이 모델과 함께 읽는 이야기');
    group.append(node('h3', '', '이 모델과 함께 읽는 이야기'));
    const list = node('div', 'product-related-stories__list');
    for (const post of related) {
      if (!/^[a-z0-9-]+$/.test(post.id)) continue;
      const link = node('a'); link.href = `/story/${post.id}.html`;
      const image = node('img');
      const imageUrl = new URL(post.image || '', `${location.origin}/story/`);
      if (imageUrl.origin === location.origin && imageUrl.pathname.startsWith('/assets/')) image.src = imageUrl.href;
      image.alt = post.imageAlt || post.title; image.loading = 'lazy';
      image.addEventListener('error', () => { image.hidden = true; }, { once: true });
      link.append(image, node('strong', '', post.title), node('span', '', '이야기 읽기')); list.append(link);
    }
    group.append(list); section.querySelector('.product-guidance__inner')?.append(group);
  } catch { /* The product's purchase and specification information remains usable. */ }
}
