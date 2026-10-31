import { animate } from 'animejs';
import { getHomeHeroSelection } from './home-colours.js';

const root = document.querySelector('[data-home-colours]');
if (root) initializeHomeColours(root);

async function initializeHomeColours(root) {
  const picker = root.querySelector('[data-colour-picker]');
  let photo = root.querySelector('[data-colour-photo]');
  const panel = root.querySelector('[data-colour-panel]');
  const status = root.querySelector('[data-colour-status]');
  const retry = root.querySelector('[data-colour-retry]');
  const placeholderLabel = root.querySelector('[data-colour-placeholder-label]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let revision = 0, animation, selected = null, disposed = false, suspended = false;
  function fallbackLink() {
    const link = root.querySelector('[data-colour-detail]');
    link.href = '/products.html';
    link.querySelector('span').textContent = '전체 가방 보기';
  }
  function withDeadline(operation) {
    let timer;
    return Promise.race([
      operation,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Hero loading timed out')), 15000); }),
    ]).finally(() => clearTimeout(timer));
  }
  function isCurrent(current) { return !disposed && !suspended && current === revision; }
  function showInitialError(message) {
    fallbackLink();
    picker.hidden = true;
    status.textContent = message;
    if (placeholderLabel) placeholderLabel.textContent = '가방을 불러오지 못했습니다. 다시 시도해 주세요.';
    retry.hidden = false;
    root.dataset.colourState = 'error';
  }
  function stopMotion() { animation?.revert(); animation = null; }
  motion.addEventListener('change', stopMotion);
  function onPageShow(event) {
    if (!event.persisted) return;
    suspended = false;
    panel.removeAttribute('aria-busy');
    if (selected) status.textContent = `${selected.label} 선택됨. ${selected.model} 제품 사진입니다.`;
    else void load();
  }
  function onPageHide(event) {
    suspended = true;
    revision++; stopMotion();
    // bfcache preserves this document and its handlers for browser Back.
    if (event.persisted) return;
    disposed = true;
    motion.removeEventListener('change', stopMotion);
    removeEventListener('pageshow', onPageShow);
    removeEventListener('pagehide', onPageHide);
  }
  addEventListener('pageshow', onPageShow);
  addEventListener('pagehide', onPageHide);

  async function select(choice, selection = null, current = ++revision) {
    status.textContent = selected ? `${choice.label} 사진을 불러오는 중입니다.` : '가방 사진을 불러오는 중입니다.';
    panel.setAttribute('aria-busy', 'true');
    try {
      const loaded = new Image();
      loaded.src = choice.image;
      await withDeadline(loaded.decode());
      if (!isCurrent(current)) return;
      stopMotion();
      if (selection) {
        picker.replaceChildren(...selection.choices.map(item => {
          const button = document.createElement('button');
          button.type = 'button'; button.className = 'colour-swatch'; button.dataset.colourId = item.id;
          button.setAttribute('aria-label', `${item.label} 가방 보기`); button.setAttribute('aria-pressed', 'false');
          const circle = document.createElement('span'); circle.className = 'colour-swatch__circle'; circle.style.backgroundColor = item.colour; circle.style.setProperty('--swatch-check', item.checkColour); circle.setAttribute('aria-hidden', 'true');
          const label = document.createElement('span'); label.textContent = item.label;
          button.append(circle, label); button.addEventListener('click', () => select(item)); return button;
        }));
        picker.setAttribute('aria-label', `${choice.model} 색상 선택`);
      }
      // Insert the decoded element itself so the old fallback cannot remain
      // visible while a reused <img> processes its new source.
      for (const name of photo.getAttributeNames()) {
        if (!['src', 'alt', 'style'].includes(name)) loaded.setAttribute(name, photo.getAttribute(name));
      }
      loaded.alt = `${choice.name} 공식 제품 이미지`;
      photo.replaceWith(loaded);
      photo = loaded;
      root.querySelectorAll('[data-colour-label]').forEach(label => label.textContent = choice.label);
      root.querySelector('[data-colour-model]').textContent = choice.model;
      root.querySelector('[data-colour-model-caption]').textContent = `Himawari ${choice.model} · 공식 제품 이미지`;
      root.querySelector('[data-colour-detail]').href = choice.href;
      root.querySelector('[data-colour-detail] span').textContent = '가방 자세히 보기';
      panel.style.backgroundColor = choice.tint;
      picker.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.colourId === choice.id)));
      picker.hidden = false;
      selected = choice;
      status.textContent = `${choice.label} 선택됨. ${choice.model} 제품 사진입니다.`;
      retry.hidden = true;
      root.dataset.colourState = 'ready';
      if (!motion.matches) animation = animate(photo, { opacity: [0.5, 1], translateY: [6, 0], duration: 260, ease: 'outQuad' });
      try { localStorage.setItem('himawari-home-last-model', choice.modelKey); } catch { /* Private storage can be unavailable. */ }
    } catch {
      if (!isCurrent(current)) return;
      if (selected) status.textContent = '사진을 불러오지 못했습니다. 현재 선택을 유지합니다. 다시 선택하거나 전체 가방을 살펴보세요.';
      else showInitialError('가방 사진을 불러오지 못했습니다. 다시 시도하거나 전체 가방을 살펴보세요.');
    } finally { if (current === revision) panel.removeAttribute('aria-busy'); }
  }

  async function load() {
    const current = ++revision;
    retry.hidden = true;
    panel.setAttribute('aria-busy', 'true');
    if (!selected) {
      root.dataset.colourState = 'loading';
      picker.hidden = true;
      fallbackLink();
      if (placeholderLabel) placeholderLabel.textContent = '오늘의 가방을 불러오는 중입니다.';
    }
    status.textContent = '오늘의 가방을 불러오는 중입니다.';
    try {
      const products = await withDeadline(import('/products.js').then(({ getCatalogProducts }) => getCatalogProducts()));
      if (!isCurrent(current)) return;
      let previousModel = '';
      try { previousModel = localStorage.getItem('himawari-home-last-model') || ''; } catch { /* Still choose randomly without storage. */ }
      const selection = getHomeHeroSelection(products, { previousModel });
      if (!selection?.choices.length) {
        showInitialError('현재 색상 목록을 준비하고 있습니다. 다시 시도하거나 전체 가방에서 제품을 확인해 주세요.');
        return;
      }
      await select(selection.initial, selection, current);
    } catch {
      if (isCurrent(current)) showInitialError('색상 목록을 불러오지 못했습니다. 다시 시도하거나 전체 가방에서 제품을 확인해 주세요.');
    } finally { if (current === revision) panel.removeAttribute('aria-busy'); }
  }
  retry.addEventListener('click', load);
  root.dataset.colourController = 'ready';
  await load();
}
