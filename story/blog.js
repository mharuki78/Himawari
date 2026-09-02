const storyIndex = document.querySelector('[data-story-index]');
const storyPost = document.querySelector('[data-story-post]');

function storyElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
}

function formatStoryDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || '';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function postHref(post) {
  return post.url ? String(post.url) : `post.html?id=${encodeURIComponent(post.id || '')}`;
}

function sortedPosts(posts) {
  return (Array.isArray(posts) ? posts : [])
    .slice()
    .sort((first, second) => String(second.date || '').localeCompare(String(first.date || '')));
}

function renderStoryTags(tags) {
  const container = storyElement('div', 'story-tags');
  tags.forEach((tag) => container.append(storyElement('span', 'story-tag', String(tag))));
  return container;
}

function renderStoryImage(post, className, loading = 'lazy') {
  if (!post?.image) return null;
  const image = storyElement('img', className);
  image.src = String(post.image);
  image.alt = String(post.imageAlt || post.title || '');
  image.loading = loading;
  image.decoding = 'async';
  return image;
}

function renderStoryIndex(posts) {
  const ordered = sortedPosts(posts);
  storyIndex.replaceChildren();
  storyIndex.setAttribute('aria-busy', 'false');

  if (!ordered.length) {
    storyIndex.append(storyElement('li', 'story-list-state', '첫 번째 이야기를 준비하고 있습니다.'));
    return;
  }

  ordered.forEach((post) => {
    const item = storyElement('li', 'story-list-card reveal');
    const link = storyElement('a');
    link.href = postHref(post);

    const time = storyElement('time', null, formatStoryDate(post.date));
    time.dateTime = String(post.date || '');

    const copy = storyElement('div', 'story-list-copy');
    const image = renderStoryImage(post, 'story-list-image');
    if (image) copy.append(image);
    copy.append(storyElement('h3', null, String(post.title || '(제목 없음)')));
    if (post.summary) copy.append(storyElement('p', 'story-summary', String(post.summary)));
    if (Array.isArray(post.tags) && post.tags.length) copy.append(renderStoryTags(post.tags));

    const arrow = storyElement('span', 'story-arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    link.append(time, copy, arrow);
    item.append(link);
    storyIndex.append(item);
  });

  window.himawariReveal?.(storyIndex);
}

function renderStoryBody(source) {
  const container = storyElement('div', 'story-body');
  const blocks = String(source || '').replace(/\r\n/g, '\n').split(/\n\s*\n/);

  blocks.forEach((rawBlock) => {
    const block = rawBlock.trim();
    if (!block) return;
    const lines = block.split('\n');

    if (lines.every((line) => /^- /.test(line.trim()))) {
      const list = storyElement('ul');
      lines.forEach((line) => list.append(storyElement('li', null, line.trim().slice(2))));
      container.append(list);
    } else if (/^## /.test(block)) {
      container.append(storyElement('h2', null, block.slice(3).trim()));
    } else {
      container.append(storyElement('p', null, block));
    }
  });

  return container;
}

function setMetaAttribute(selector, attribute, value) {
  const element = document.querySelector(selector);
  if (element) element.setAttribute(attribute, value);
}

function addStructuredData(data) {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  document.head.append(script);
}

function setPostMeta(post) {
  const title = String(post.title || '이야기');
  const description = String(post.description || post.summary || '').slice(0, 160);
  const storyBase = new URL('./', location.href);
  const canonicalUrl = post.url
    ? new URL(String(post.url), storyBase).href
    : `${location.origin}${location.pathname}?id=${encodeURIComponent(post.id || '')}`;
  const author = String(post.author || '').trim();

  document.title = `${title} — Himawari`;
  setMetaAttribute('meta[name="description"]', 'content', description);
  setMetaAttribute('meta[name="author"]', 'content', author);
  setMetaAttribute('link[rel="canonical"]', 'href', canonicalUrl);
  setMetaAttribute('meta[property="og:title"]', 'content', title);
  setMetaAttribute('meta[property="og:description"]', 'content', description);
  setMetaAttribute('meta[property="og:url"]', 'content', canonicalUrl);
  if (post.image) {
    const imageUrl = new URL(String(post.image), storyBase).href;
    let ogImage = document.querySelector('meta[property="og:image"]');
    if (!ogImage) {
      ogImage = document.createElement('meta');
      ogImage.setAttribute('property', 'og:image');
      document.head.append(ogImage);
    }
    ogImage.setAttribute('content', imageUrl);
  }

  const articleData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    datePublished: String(post.date || ''),
    dateModified: String(post.updated || post.date || ''),
    mainEntityOfPage: canonicalUrl,
    keywords: Array.isArray(post.tags) ? post.tags.map(String).join(', ') : '',
  };
  if (author) articleData.author = { '@type': 'Person', name: author };
  addStructuredData(articleData);

  const faq = Array.isArray(post.faq) ? post.faq.filter((item) => item?.q && item?.a) : [];
  if (faq.length) {
    addStructuredData({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: String(item.q),
        acceptedAnswer: { '@type': 'Answer', text: String(item.a) },
      })),
    });
  }

  addStructuredData({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: `${location.origin}/` },
      { '@type': 'ListItem', position: 2, name: '이야기', item: storyBase.href },
      { '@type': 'ListItem', position: 3, name: title, item: canonicalUrl },
    ],
  });
}

function renderFaq(items) {
  const section = storyElement('section', 'story-faq');
  section.append(storyElement('h2', null, '자주 묻는 질문'));
  items.forEach((item) => {
    const details = storyElement('details');
    details.append(storyElement('summary', null, String(item.q)));
    details.append(storyElement('p', null, String(item.a)));
    section.append(details);
  });
  return section;
}

function renderSources(items) {
  const section = storyElement('section', 'story-sources');
  section.append(storyElement('h2', null, '참고·출처'));
  const list = storyElement('ol');
  items.forEach((item) => {
    const entry = storyElement('li');
    if (item?.url) {
      const link = storyElement('a', null, String(item.title || item.url));
      link.href = String(item.url);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      entry.append(link);
    } else {
      entry.textContent = String(item?.title || item || '');
    }
    list.append(entry);
  });
  section.append(list);
  return section;
}

function renderNotFound(message = '주소가 잘못되었거나 삭제된 글일 수 있습니다.') {
  const container = storyElement('div', 'story-not-found');
  container.append(storyElement('h1', null, '글을 찾을 수 없습니다'));
  container.append(storyElement('p', null, message));
  const link = storyElement('a', null, '이야기 목록으로 돌아가기');
  link.href = 'index.html';
  container.append(link);
  storyPost.replaceChildren(document.querySelector('.story-top'), container);
  storyPost.setAttribute('aria-busy', 'false');
}

function renderPostNavigation(posts, index) {
  const previous = posts[index + 1];
  const next = posts[index - 1];
  if (!previous && !next) return null;

  const navigation = storyElement('nav', 'story-post-nav');
  navigation.setAttribute('aria-label', '이전 글과 다음 글');

  function appendLink(post, className, label) {
    if (!post) {
      navigation.append(storyElement('span'));
      return;
    }
    const link = storyElement('a', className);
    link.href = postHref(post);
    link.append(storyElement('div', 'story-direction', label));
    link.append(storyElement('div', 'story-nav-title', String(post.title || '')));
    navigation.append(link);
  }

  appendLink(previous, 'previous', '이전 글');
  appendLink(next, 'next', '다음 글');
  return navigation;
}

function renderStoryPost(posts) {
  const ordered = sortedPosts(posts);
  const params = new URLSearchParams(location.search);
  const id = params.get('id') || params.get('slug');
  const postIndex = ordered.findIndex((post) => String(post.id) === id || (post.url && String(post.url).replace(/\.html$/, '') === id));

  if (postIndex < 0) {
    renderNotFound();
    return;
  }

  const post = ordered[postIndex];
  setPostMeta(post);
  const article = storyElement('article', 'story-article');
  const header = storyElement('header', 'story-post-head');
  const time = storyElement('time', null, formatStoryDate(post.date));
  time.dateTime = String(post.date || '');
  header.append(time);
  header.append(storyElement('h1', null, String(post.title || '(제목 없음)')));

  if (post.author || (post.updated && post.updated !== post.date)) {
    const meta = storyElement('div', 'story-post-meta');
    if (post.author) meta.append(storyElement('span', null, String(post.author)));
    if (post.updated && post.updated !== post.date) meta.append(storyElement('span', null, `수정 ${formatStoryDate(post.updated)}`));
    header.append(meta);
  }
  if (Array.isArray(post.tags) && post.tags.length) header.append(renderStoryTags(post.tags));

  article.append(header, storyElement('hr', 'story-post-rule'));
  const image = renderStoryImage(post, 'story-post-image', 'eager');
  if (image) article.append(image);
  article.append(renderStoryBody(post.body));
  const faq = Array.isArray(post.faq) ? post.faq.filter((item) => item?.q && item?.a) : [];
  if (faq.length) article.append(renderFaq(faq));
  if (Array.isArray(post.sources) && post.sources.length) article.append(renderSources(post.sources));
  const navigation = renderPostNavigation(ordered, postIndex);
  if (navigation) article.append(navigation);

  storyPost.replaceChildren(document.querySelector('.story-top'), article);
  storyPost.setAttribute('aria-busy', 'false');
}

async function loadStories() {
  try {
    const response = await fetch('posts.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const posts = await response.json();
    if (storyIndex) renderStoryIndex(posts);
    if (storyPost) renderStoryPost(posts);
  } catch {
    if (storyIndex) {
      storyIndex.replaceChildren(storyElement('li', 'story-list-state', '이야기를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.'));
      storyIndex.setAttribute('aria-busy', 'false');
    }
    if (storyPost) renderNotFound('글을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.');
  }
}

if (storyIndex || storyPost) loadStories();
