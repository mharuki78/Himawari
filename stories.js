const homeStories = document.querySelector('[data-home-stories]');

function storyDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || '';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date).replace(/\. /g, '.').replace(/\.$/, '');
}

function storyHref(post) {
  if (!post.url) return `story/post.html?id=${encodeURIComponent(post.id || '')}`;
  try {
    return new URL(String(post.url)).href;
  } catch {
    return `story/${String(post.url).replace(/^\.\//, '')}`;
  }
}

function createHomeStoryCard(post) {
  const article = document.createElement('article');
  article.className = 'journal-card card reveal';

  const link = document.createElement('a');
  link.href = storyHref(post);

  const time = document.createElement('time');
  time.dateTime = String(post.date || '');
  time.textContent = storyDate(post.date);

  const copy = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = String(post.title || '(제목 없음)');
  const summary = document.createElement('p');
  summary.textContent = String(post.summary || 'Himawari의 새로운 이야기를 만나보세요.');
  copy.append(title, summary);

  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';

  link.append(time, copy, arrow);
  article.append(link);
  return article;
}

function showStoryState(message) {
  const state = document.createElement('p');
  state.className = 'journal-state';
  state.textContent = message;
  homeStories.replaceChildren(state);
  homeStories.setAttribute('aria-busy', 'false');
}

async function loadHomeStories() {
  try {
    const response = await fetch('story/posts.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const posts = await response.json();
    const latest = (Array.isArray(posts) ? posts : [])
      .slice()
      .sort((first, second) => String(second.date || '').localeCompare(String(first.date || '')))
      .slice(0, 3);

    if (!latest.length) {
      showStoryState('첫 번째 이야기를 준비하고 있습니다.');
      return;
    }

    const fragment = document.createDocumentFragment();
    latest.forEach((post) => fragment.append(createHomeStoryCard(post)));
    homeStories.replaceChildren(fragment);
    homeStories.setAttribute('aria-busy', 'false');
    window.himawariReveal?.(homeStories);
  } catch {
    showStoryState('이야기를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.');
  }
}

if (homeStories) loadHomeStories();
