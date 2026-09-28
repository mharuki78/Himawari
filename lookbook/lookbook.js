(() => {
  const cards = [...document.querySelectorAll('[data-lookbook-card]')];
  const filters = [...document.querySelectorAll('[data-lookbook-filter]')];
  const status = document.querySelector('[data-lookbook-status]');
  const more = document.querySelector('[data-lookbook-more]');
  const empty = document.querySelector('[data-lookbook-empty]');
  const dialog = document.querySelector('[data-lookbook-viewer]');
  if (!cards.length || !dialog) return;
  let category = 'all';
  let limit = 12;
  let selected = 0;
  let opener;
  const matching = () => cards.filter(card => category === 'all' || card.dataset.category === category);
  function update() {
    const matches = matching();
    cards.forEach(card => { card.hidden = !matches.slice(0, limit).includes(card); });
    document.querySelectorAll('.lookbook-day').forEach(day => {
      const count = [...day.querySelectorAll('[data-lookbook-card]')].filter(card => !card.hidden).length;
      day.hidden = count === 0;
      day.querySelector('.lookbook-grid').dataset.count = String(count);
    });
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lookbookFilter === category)));
    status.textContent = `${matches.length}장의 장면 · ${Math.min(limit, matches.length)}장 표시`;
    more.hidden = matches.length <= limit;
    empty.hidden = matches.length > 0;
  }
  filters.forEach(button => button.addEventListener('click', () => { category = button.dataset.lookbookFilter; limit = 12; update(); }));
  more.addEventListener('click', () => {
    const next = matching()[limit];
    limit += 12; update();
    next?.querySelector('[data-lookbook-open]')?.focus({ preventScroll: true });
  });
  document.querySelector('[data-lookbook-reset]').addEventListener('click', () => { category = 'all'; limit = 12; update(); filters[0].focus(); });
  function show(index) {
    const matches = matching();
    selected = (index + matches.length) % matches.length;
    const card = matches[selected];
    const image = dialog.querySelector('img');
    image.src = card.querySelector('[data-lookbook-open]').href;
    image.alt = card.querySelector('img').alt;
    dialog.querySelector('h2').textContent = card.querySelector('h3').textContent;
    dialog.querySelector('[data-lookbook-model]').textContent = card.querySelector('[data-model]').textContent;
    dialog.querySelector('[data-lookbook-scene]').textContent = card.dataset.scene;
    dialog.querySelector('[data-lookbook-date]').textContent = card.dataset.date;
    dialog.querySelector('[data-lookbook-product]').href = card.querySelector('.lookbook-product').href;
    dialog.querySelector('[data-lookbook-counter]').textContent = `${selected + 1} / ${matches.length}`;
  }
  cards.forEach(card => card.querySelector('[data-lookbook-open]').addEventListener('click', event => {
    if (typeof dialog.showModal !== 'function' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); opener = event.currentTarget;
    show(matching().indexOf(card)); dialog.showModal(); document.body.classList.add('lookbook-viewer-open');
    dialog.querySelector('[data-lookbook-close]').focus();
  }));
  dialog.querySelector('[data-lookbook-close]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-lookbook-prev]').addEventListener('click', () => show(selected - 1));
  dialog.querySelector('[data-lookbook-next]').addEventListener('click', () => show(selected + 1));
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); show(selected + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(selected - 1); }
  });
  dialog.addEventListener('close', () => { document.body.classList.remove('lookbook-viewer-open'); opener?.focus({ preventScroll: true }); });
  document.querySelector('[data-lookbook-toolbar]').hidden = false;
  update();
})();
