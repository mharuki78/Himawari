import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { getStoryWindow, STORY_PAGE_SIZE } from '../story/list-window.js';

const posts = Array.from({ length: 167 }, (_, index) => ({
  id: `story-${index}`,
  title: `이야기 ${index}`,
  date: new Date(Date.UTC(2026, 9, 28 - index)).toISOString().slice(0, 10),
  summary: index < 31 ? '출근 가방' : '여행 가방',
  url: `story-${index}.html`,
}));

test('story windows start at twelve, preserve date order and stop at the final partial page', () => {
  const source = posts.slice().reverse();
  const first = getStoryWindow(source);
  assert.equal(STORY_PAGE_SIZE, 12);
  assert.equal(first.shown, 12);
  assert.equal(first.total, 167);
  assert.equal(first.remaining, 155);
  assert.equal(first.nextCount, 12);
  assert.deepEqual(first.posts, posts.slice(0, 12));
  assert.deepEqual(source, posts.slice().reverse(), 'Pagination must not reorder the source data');

  const second = getStoryWindow(source, {}, 2);
  assert.deepEqual(second.posts.slice(first.shown), posts.slice(12, 24));
  const last = getStoryWindow(source, {}, 14);
  assert.equal(last.shown, 167);
  assert.equal(last.remaining, 0);
  assert.equal(last.nextCount, 0);
  assert.equal(getStoryWindow(source, {}, 13).nextCount, 11);
  assert.equal(getStoryWindow(source, {}, 100).shown, 167);
  for (const page of [0, -1, NaN, 1.5]) assert.equal(getStoryWindow(source, {}, page).shown, 12);
});

test('search and categories run over every story before the result window is selected', () => {
  const late = getStoryWindow(posts, { query: '이야기 166', category: 'travel' });
  assert.deepEqual(late.posts, [posts[166]]);
  assert.equal(late.total, 1);
  assert.equal(late.remaining, 0);
  assert.equal(getStoryWindow(posts, { category: 'commute' }).total, 31);
  const empty = getStoryWindow(posts, { query: '없는 검색어' });
  assert.equal(empty.shown, 0);
  assert.equal(empty.remaining, 0);
  assert.equal(empty.nextCount, 0);
  assert.deepEqual(getStoryWindow([]).posts, []);
});

async function storyPage(fixture = posts, url = 'https://himawari.co.kr/story/?keep=value') {
  let document;
  class Element {
    constructor(tag = 'div') {
      this.tag = tag;
      this.children = [];
      this.attributes = {};
      this.dataset = {};
      this.listeners = {};
      this.hidden = false;
      this.value = '';
      this.textContent = '';
    }
    append(...children) {
      for (const child of children) {
        if (child.tag === '#fragment') this.append(...child.children);
        else this.children.push(child);
      }
    }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, listener) { this.listeners[name] = listener; }
    dispatch(name, values = {}) { this.listeners[name]?.({ preventDefault() {}, ...values }); }
    querySelector(selector) {
      if (selector === 'a') return this.children.find(child => child.tag === 'a');
      return this.selectors?.[selector] || null;
    }
    querySelectorAll() { return this.buttons || []; }
    focus() { document.activeElement = this; }
    scrollIntoView() { this.scrolledIntoView = true; }
  }
  const list = new Element('ul');
  const search = new Element('input');
  const status = new Element('p');
  const more = new Element('button');
  const pageStatus = new Element('p');
  const pagination = new Element();
  pagination.selectors = { '[data-story-more]': more, '[data-story-window-status]': pageStatus };
  const form = new Element('form');
  form.selectors = { '[data-story-results]': status };
  form.buttons = ['all', 'commute', 'school', 'travel', 'care'].map(category => {
    const button = new Element('button');
    button.dataset.storyCategory = category;
    button.textContent = category;
    return button;
  });
  document = {
    activeElement: null,
    createElement: tag => new Element(tag),
    createDocumentFragment: () => new Element('#fragment'),
    getElementById: () => search,
    querySelector: selector => ({
      '[data-story-index]': list,
      '[data-story-filters]': form,
      '[data-story-pagination]': pagination,
    })[selector] || null,
  };
  const location = new URL(url);
  const context = vm.createContext({
    document, location, URL, URLSearchParams, Intl,
    window: {},
    history: { replaceState(_state, _title, nextUrl) { location.href = nextUrl.href; } },
    fetch: async () => ({ ok: true, json: async () => fixture }),
    setTimeout: () => 1,
    clearTimeout() {},
  });
  const file = new URL('../story/blog.js', import.meta.url);
  const script = new vm.Script(await readFile(file, 'utf8'), {
    filename: file.pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
  });
  await script.runInContext(context);
  return { list, search, status, more, pageStatus, pagination, form, document, location };
}

test('load more appends twelve cards, retains earlier nodes and focuses the first new link', async () => {
  const page = await storyPage(posts.slice(0, 25));
  assert.equal(page.list.children.length, 12);
  assert.equal(page.more.hidden, false);
  assert.match(page.more.textContent, /12개.*13개 남음/);
  assert.match(page.pageStatus.textContent, /25개.*12개/);
  const original = page.list.children[0];
  page.more.dispatch('click');
  assert.equal(page.list.children.length, 24);
  assert.equal(page.list.children[0], original);
  assert.equal(page.document.activeElement, page.list.children[12].querySelector('a'));
  assert.match(page.more.textContent, /1개.*1개 남음/);
  page.more.dispatch('click');
  assert.equal(page.list.children.length, 25);
  assert.equal(page.more.hidden, true);
  assert.equal(page.document.activeElement, page.list.children[24].querySelector('a'));
  assert.match(page.pageStatus.textContent, /25개.*25개/);
});

test('query, category and reset return to twelve results while preserving URL state', async () => {
  const page = await storyPage();
  page.more.dispatch('click');
  assert.equal(page.list.children.length, 24);
  page.form.buttons.find(button => button.dataset.storyCategory === 'travel').dispatch('click');
  assert.equal(page.list.children.length, 12);
  assert.equal(page.list.children[0].querySelector('a').href, 'story-31.html');
  assert.equal(page.location.searchParams.get('category'), 'travel');
  assert.equal(page.location.searchParams.get('keep'), 'value');

  page.more.dispatch('click');
  page.search.value = '이야기 166';
  page.form.dispatch('submit');
  assert.equal(page.list.children.length, 1);
  assert.equal(page.list.children[0].querySelector('a').href, 'story-166.html');
  assert.equal(page.more.hidden, true);
  assert.equal(page.location.searchParams.get('q'), '이야기 166');
  page.form.dispatch('reset');
  assert.equal(page.list.children.length, 12);
  assert.equal(page.more.hidden, false);
  assert.equal(page.location.searchParams.has('q'), false);
  assert.equal(page.location.searchParams.has('category'), false);
  assert.equal(page.location.searchParams.get('keep'), 'value');
  assert.equal(page.document.activeElement, page.search);
});

test('a pending search resets the window before another load-more action', async () => {
  const page = await storyPage();
  page.more.dispatch('click');
  page.search.value = '가방';
  page.search.dispatch('input');
  page.more.dispatch('click');
  assert.equal(page.list.children.length, 12);
  assert.equal(page.location.searchParams.get('q'), '가방');
  page.more.dispatch('click');
  assert.equal(page.list.children.length, 24);
});

test('every story remains reachable without duplicates and the final eleven hide load more', async () => {
  const page = await storyPage();
  for (let index = 0; index < 13; index += 1) page.more.dispatch('click');
  const links = page.list.children.map(item => item.querySelector('a').href);
  assert.deepEqual(links, posts.map(post => post.url));
  assert.equal(page.more.hidden, true);
  assert.match(page.pageStatus.textContent, /167개.*167개/);
});

test('URL criteria search all data and empty results hide pagination with a working reset', async () => {
  const late = await storyPage(posts, 'https://himawari.co.kr/story/?q=166&category=travel');
  assert.equal(late.list.children.length, 1);
  assert.equal(late.list.children[0].querySelector('a').href, 'story-166.html');
  assert.equal(late.more.hidden, true);
  late.search.value = '없는 검색어';
  late.form.dispatch('submit');
  assert.equal(late.pagination.hidden, true);
  assert.equal(late.list.children.length, 1);
  assert.match(late.list.children[0].textContent, /조건에 맞는/);
  late.list.children[0].children[0].onclick();
  assert.equal(late.list.children.length, 12);
  assert.equal(late.pagination.hidden, false);

  const empty = await storyPage([]);
  assert.equal(empty.pagination.hidden, true);
  assert.equal(empty.more.hidden, true);
  assert.match(empty.list.children[0].textContent, /첫 번째 이야기/);
});
