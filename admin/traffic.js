import { fetchJson, bindPasswordToggle } from './admin-client.js';
import { visitorDay, VISITOR_PRODUCT_PAGES } from '../assets/visitor-pages.js';

const $ = (selector) => document.querySelector(selector);
const initial = $('[data-initial]');
const login = $('[data-login]');
const board = $('[data-board]');
const status = $('[data-status]');
const report = $('[data-report]');
const form = $('[data-login-form]');
const password = form.elements.password;
const refresh = $('[data-refresh]');
const period = $('[data-period]');
const date = $('[data-date]');
const number = new Intl.NumberFormat('ko-KR');
let controller;

bindPasswordToggle(password, $('[data-password-toggle]'));

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderRanking(target, rows, linkFor) {
  if (!rows.length) {
    target.replaceChildren(element('p', '이 기간에 기록된 조회가 없습니다.'));
    return;
  }
  const list = element('ol');
  list.className = 'traffic-rank-list';
  for (const row of rows) {
    const href = linkFor(row);
    const name = element(href ? 'a' : 'span', row.name);
    if (href) name.href = href;
    const line = element('div');
    line.className = 'traffic-rank-row';
    line.append(name, element('strong', `${number.format(row.views)}회`));
    const bar = element('div');
    bar.className = 'traffic-rank-bar';
    bar.setAttribute('aria-hidden', 'true');
    const fill = element('span');
    fill.style.width = `${row.views / rows[0].views * 100}%`;
    bar.append(fill);
    const li = element('li');
    li.append(line, bar);
    list.append(li);
  }
  target.replaceChildren(list);
}

function render(data) {
  const totals = { visits: 0, views: 0, productViews: 0 };
  const daily = [...data.daily].reverse().map((day) => {
    totals.visits += day.visits;
    totals.views += day.views;
    totals.productViews += day.productViews;
    const row = element('tr');
    const label = element('th');
    label.scope = 'row';
    const time = element('time', day.day);
    time.dateTime = day.day;
    label.append(time);
    row.append(label, element('td', number.format(day.visits)), element('td', number.format(day.views)));
    return row;
  });
  $('[data-daily]').replaceChildren(...daily);
  $('[data-total-visits]').textContent = `${number.format(totals.visits)}회`;
  $('[data-total-views]').textContent = `${number.format(totals.views)}회`;
  $('[data-product-views]').textContent = `${number.format(totals.productViews)}회`;
  renderRanking($('[data-top-pages]'), data.pages, ({ path }) => VISITOR_PRODUCT_PAGES.has(path) ? null : path);
  renderRanking($('[data-top-products]'), data.products, ({ id, listed }) => listed ? `/product.html?id=${encodeURIComponent(id)}` : null);
  report.hidden = false;
  status.textContent = totals.views ? '' : '선택한 기간에 기록된 방문과 조회가 없습니다.';
}

async function load() {
  controller?.abort();
  const current = new AbortController();
  controller = current;
  refresh.disabled = true;
  report.hidden = true;
  status.textContent = '방문 통계를 불러오는 중입니다.';
  const query = new URLSearchParams(period.value === 'date' ? { date: date.value } : { days: period.value });
  try {
    const data = await fetchJson(`/api/admin/visitor-traffic?${query}`, { signal: current.signal });
    if (current.signal.aborted) return;
    login.hidden = true;
    board.hidden = false;
    render(data);
  } catch (error) {
    if (current.signal.aborted) return;
    if (error.status === 401) {
      login.hidden = false;
      board.hidden = true;
    } else {
      board.hidden = false;
      status.textContent = error instanceof TypeError ? '사이트에 연결하지 못했습니다. 다시 시도해 주세요.' : error.message;
    }
  } finally {
    if (controller === current) {
      initial.hidden = true;
      refresh.disabled = false;
    }
  }
}

period.addEventListener('change', () => {
  date.hidden = period.value !== 'date';
  date.max = visitorDay();
  date.min = visitorDay(Date.now() - 89 * 86_400_000);
  if (!date.value) date.value = date.max;
  if (!date.hidden) date.focus();
  void load();
});
date.addEventListener('change', () => { if (date.value && date.validity.valid) void load(); });
refresh.addEventListener('click', load);
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = form.querySelector('[type="submit"]');
  const message = $('[data-login-status]');
  submit.disabled = true;
  message.textContent = '';
  try {
    await fetchJson('/api/admin/session', { method: 'POST', body: JSON.stringify({ password: password.value }) });
    form.reset();
    await load();
    $('#traffic-title').focus();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});
$('[data-logout]').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await fetchJson('/api/admin/session', { method: 'DELETE' });
    controller?.abort();
    report.hidden = true;
    board.hidden = true;
    login.hidden = false;
    password.focus();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

void load();
