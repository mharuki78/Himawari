import { animate } from 'animejs';
import { getHomeHeroSelection } from './home-colours.js';

const root = document.querySelector('[data-home-colours]');
if (root) initializeHomeColours(root);

async function initializeHomeColours(root) {
  const picker = root.querySelector('[data-colour-picker]');
  const photo = root.querySelector('[data-colour-photo]');
  const panel = root.querySelector('[data-colour-panel]');
  const status = root.querySelector('[data-colour-status]');
  const retry = root.querySelector('[data-colour-retry]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let revision = 0, animation, choices = [], disposed = false;
  function fallbackLink() {
    const link = root.querySelector('[data-colour-detail]');
    link.href = '/products.html';
    link.querySelector('span').textContent = '전체 가방 보기';
  }
  function stopMotion() { animation?.revert(); animation = null; }
  motion.addEventListener('change', stopMotion);
  function onPageShow(event) {
    if (!event.persisted) return;
    panel.removeAttribute('aria-busy');
    if (picker.querySelector('[aria-pressed="true"]')) status.textContent = `${root.querySelector('.colour-selection strong').textContent} 선택됨. ${root.querySelector('[data-colour-model]').textContent} 제품 사진입니다.`;
    else if (!picker.hidden) status.textContent = '원하는 색상을 선택해 주세요.';
  }
  function onPageHide(event) {
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

  async function select(choice) {
    const current = ++revision;
    status.textContent = `${choice.label} 사진을 불러오는 중입니다.`;
    panel.setAttribute('aria-busy', 'true');
    try {
      const loaded = new Image();
      loaded.src = choice.image;
      await loaded.decode();
      if (disposed || current !== revision) return;
      stopMotion();
      photo.src = choice.image;
      photo.alt = `${choice.name} 공식 제품 이미지`;
      root.querySelectorAll('[data-colour-label]').forEach(label => label.textContent = choice.label);
      root.querySelector('[data-colour-model]').textContent = choice.model;
      root.querySelector('[data-colour-model-caption]').textContent = `Himawari ${choice.model} · 공식 제품 이미지`;
      root.querySelector('[data-colour-detail]').href = choice.href;
      root.querySelector('[data-colour-detail] span').textContent = '가방 자세히 보기';
      panel.style.backgroundColor = choice.tint;
      picker.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.colourId === choice.id)));
      if (!motion.matches) animation = animate(photo, { opacity: [0.5, 1], translateY: [6, 0], duration: 260, ease: 'outQuad' });
      status.textContent = `${choice.label} 선택됨. ${choice.model} 제품 사진입니다.`;
      try { localStorage.setItem('himawari-home-last-model', choice.modelKey); } catch { /* Private storage can be unavailable. */ }
      retry.hidden = true;
    } catch {
      if (disposed || current !== revision) return;
      status.textContent = '사진을 불러오지 못했습니다. 현재 선택을 유지합니다. 다시 선택하거나 전체 가방을 살펴보세요.';
    } finally { if (current === revision) panel.removeAttribute('aria-busy'); }
  }

  async function load() {
    retry.hidden = true;
    status.textContent = '색상을 불러오는 중입니다.';
    try {
      const { getCatalogProducts } = await import('/products.js');
      let previousModel = '';
      try { previousModel = localStorage.getItem('himawari-home-last-model') || ''; } catch { /* Still choose randomly without storage. */ }
      const selection = getHomeHeroSelection(await getCatalogProducts(), { previousModel });
      choices = selection?.choices || [];
      if (disposed) return;
      if (!choices.length) { fallbackLink(); status.textContent = '현재 색상 목록을 준비하고 있습니다. 전체 가방에서 제품을 확인해 주세요.'; return; }
      picker.replaceChildren(...choices.map(choice => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'colour-swatch'; button.dataset.colourId = choice.id;
        button.setAttribute('aria-label', `${choice.label} 가방 보기`); button.setAttribute('aria-pressed', 'false');
        const circle = document.createElement('span'); circle.className = 'colour-swatch__circle'; circle.style.backgroundColor = choice.colour; circle.style.setProperty('--swatch-check', choice.checkColour); circle.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span'); label.textContent = choice.label;
        button.append(circle, label); button.addEventListener('click', () => select(choice)); return button;
      }));
      picker.hidden = false;
      picker.setAttribute('aria-label', `No.${selection.model} 색상 선택`);
      await select(selection.initial);
    } catch { if (!disposed) { fallbackLink(); status.textContent = '색상 목록을 불러오지 못했습니다. 전체 가방에서도 제품을 확인할 수 있습니다.'; retry.hidden = false; } }
  }
  retry.addEventListener('click', load);
  await load();
}
