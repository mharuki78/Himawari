const $ = (id) => document.getElementById(id);
const image = $('page-image');
let page = 1, count = 67, entries = [], sequence = 0;
const src = (p) => `/assets/guides/pages/${String(p).padStart(2, '0')}.webp`;
function hashPage() { return Number(new URLSearchParams(location.hash.slice(1)).get('page')) || 1; }
async function go(value, animate = true) {
  const next = Math.min(count, Math.max(1, Math.trunc(Number(value)) || 1));
  const ticket = ++sequence;
  $('reader-status').textContent = '페이지를 불러오는 중입니다…';
  const ready = new Image(); ready.src = src(next);
  try { await ready.decode(); } catch {
    if (ticket === sequence) $('reader-status').textContent = '페이지를 불러오지 못했습니다. 다시 이동하거나 원본 PDF를 열어주세요.';
    return;
  }
  if (ticket !== sequence) return;
  document.querySelectorAll('.turn-sheet').forEach(el => el.remove());
  if (animate && next !== page && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const sheet = image.cloneNode(); sheet.removeAttribute('id'); sheet.alt = ''; sheet.setAttribute('aria-hidden', 'true'); sheet.className = 'turn-sheet';
    $('book').append(sheet);
    sheet.style.transformOrigin = next > page ? 'left center' : 'right center';
    sheet.animate([{transform:'rotateY(0deg)',opacity:1},{transform:`rotateY(${next > page ? -90 : 90}deg)`,opacity:.1}],{duration:360,easing:'cubic-bezier(.22,.7,.2,1)'}).finished.finally(() => sheet.remove());
  }
  page = next;
  const chapter = [...entries].reverse().find(entry => entry.page <= page);
  image.src = ready.src; image.alt = `${chapter?.title || '가이드북'} · ${page}페이지`;
  $('chapter').textContent = chapter?.title || '2026 COLLECTION';
  $('page-number').value = page;
  $('previous').disabled = page === 1; $('next').disabled = page === count;
  $('reader-status').textContent = `${page} / ${count} 페이지`;
  document.querySelectorAll('#guide-toc a').forEach(link => {
    if (Number(link.dataset.page) === chapter?.page) link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  });
  history.replaceState(null,'',`#page=${page}`);
  for (const neighbor of [page-1,page+1]) if (neighbor > 0 && neighbor <= count) { const preload = new Image(); preload.src = src(neighbor); }
}
$('previous').onclick = () => go(page-1);
$('next').onclick = () => go(page+1);
$('page-form').onsubmit = event => { event.preventDefault(); go($('page-number').value); };
document.addEventListener('keydown', event => {
  if ($('zoom-dialog').open || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); go(page + (event.key === 'ArrowRight' ? 1 : -1)); }
});
let start;
$('stage').addEventListener('pointerdown', event => { if (event.isPrimary) start = {x:event.clientX,y:event.clientY,id:event.pointerId}; });
$('stage').addEventListener('pointerup', event => {
  if (!start || start.id !== event.pointerId) return;
  const dx = event.clientX-start.x, dy = event.clientY-start.y; start = null;
  if (Math.abs(dx)>55 && Math.abs(dx)>Math.abs(dy)*1.5) go(page+(dx<0?1:-1));
});
$('stage').addEventListener('pointercancel', () => { start = null; });
image.draggable = false;
const toggle = document.querySelector('.toc-toggle');
toggle.onclick = () => { const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded',String(open)); $('guide-toc').classList.toggle('open',open); toggle.firstChild.textContent = open ? '목차 접기 ' : '목차 펼치기 '; };
$('zoom').onclick = () => { $('zoom-image').src = src(page); $('zoom-image').alt = image.alt; $('zoom-dialog').showModal(); };
$('zoom-close').onclick = () => $('zoom-dialog').close();
window.addEventListener('hashchange', () => go(hashPage()));
try {
  const response = await fetch('/assets/guides/contents.json');
  if (!response.ok) throw new Error('contents');
  const data = await response.json(); count = data.count; entries = data.contents;
  $('page-number').max = count; $('page-total').textContent = `/ ${count}`;
  for (const entry of entries) {
    const link = document.createElement('a'); link.href = `#page=${entry.page}`; link.dataset.page = entry.page;
    const name = document.createElement('span'); name.textContent = entry.title;
    const number = document.createElement('small'); number.textContent = String(entry.page).padStart(2,'0'); link.append(name,number);
    link.onclick = event => { event.preventDefault(); go(entry.page); };
    $('guide-toc').append(link);
  }
  go(hashPage(),false);
} catch { $('reader-status').textContent = '목차를 불러오지 못했습니다. 페이지 번호나 이전·다음 버튼을 이용해주세요.'; }
