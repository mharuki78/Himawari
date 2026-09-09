import { SPEC_FIELDS } from './product-specs.js';

export function renderProductGuidance(product, products = []) {
  let section = document.querySelector('[data-product-guidance]');
  if (!section) {
    section = document.createElement('section'); section.dataset.productGuidance = ''; section.className = 'section product-guidance';
    document.querySelector('.product-description')?.after(section);
  }
  const inner = document.createElement('div'); inner.className = 'section-inner';
  const heading = document.createElement('h2'); heading.textContent = '구매 전, 크기부터 확인하세요.';
  const note = document.createElement('p'); note.textContent = '노트북은 화면 인치보다 기기 실측과 수납칸 크기를 비교해 주세요. 미확인 항목은 구매 전 문의로 확인할 수 있습니다.';
  const list = document.createElement('dl'); list.className = 'product-spec-list';
  for (const [key, label] of SPEC_FIELDS) {
    const row = document.createElement('div'); const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = product.specs?.[key] || '미확인 · 구매 전 문의'; row.append(dt, dd); list.append(row);
  }
  const links = document.createElement('p'); links.className = 'guidance-links';
  for (const [label, href] of [['다른 제품과 비교', `compare.html?products=${encodeURIComponent(product.id)}`], ['제품·수선 문의', `support.html?product=${encodeURIComponent(product.id)}`], ['관리 방법 보기', 'care.html']]) {
    const link = document.createElement('a'); link.href = href; link.textContent = `${label} →`; links.append(link);
  }
  inner.append(heading, note, list, links);
  const related = products.filter(p => p.id !== product.id && product.relatedProductIds?.includes(p.id));
  if (related.length) {
    const title = document.createElement('h3'); title.textContent = '함께 사용할 수 있는 구성품'; inner.append(title);
    const group = document.createElement('ul');
    for (const item of related) { const li = document.createElement('li'); const a = document.createElement('a'); a.href = `product.html?id=${encodeURIComponent(item.id)}`; a.textContent = item.name + (item.soldOut ? ' · 품절' : ''); li.append(a); group.append(li); }
    inner.append(group);
  }
  section.replaceChildren(inner);
}
