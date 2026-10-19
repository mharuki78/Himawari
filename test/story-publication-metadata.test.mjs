import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const origin = 'https://himawari.co.kr';
const load = () => import('../scripts/lib/story-publication-metadata.mjs').catch(() => ({}));
function fixture() {
  const post = { id: 'bag', url: 'bag.html', title: '가방 입구 살피기', date: '2026-10-20', dateModified: '2026-10-20', publishedAt: '2026-10-20T08:05:00+09:00', modifiedAt: '2026-10-20T08:05:00+09:00' };
  const article = { '@type': 'BlogPosting', '@id': `${origin}/story/bag.html#article`, url: `${origin}/story/bag.html`, headline: post.title, datePublished: post.publishedAt, dateModified: post.modifiedAt, image: [`${origin}/assets/story/bag.webp`], author: { url: origin + '/' }, publisher: { url: origin + '/', logo: { url: origin + '/assets/himawari-logo-hq.png' } }, inLanguage: 'ko-KR', isPartOf: { url: origin + '/story/' } };
  const body = '<article><h1>가방 입구 살피기</h1><img src="../assets/story/bag.webp"><p>가방 본문</p></article>';
  const html = `<link rel="canonical" href="${article.url}"><script type="application/ld+json">${JSON.stringify(article)}</script><script type="application/ld+json">${JSON.stringify({ '@type': 'BreadcrumbList', itemListElement: [{ item: origin + '/story/' }, { item: article.url }] })}</script>${body}`;
  const deployment = { id: 'dpl_actual', state: 'READY', target: 'production', meta: { githubCommitSha: 'a'.repeat(40) }, ready: Date.parse(post.publishedAt) };
  const record = { id: post.id, url: article.url, publication: { publishedAt: post.publishedAt, modifiedAt: post.modifiedAt, articleSha256: crypto.createHash('sha256').update(body).digest('hex'), firstDeploymentEvidence: 'backups/story-2026-10-20/first-deployment.json', modificationDeploymentEvidence: 'backups/story-2026-10-20/first-deployment.json' } };
  return { post, record, html, firstDeployment: deployment, modificationDeployment: deployment, published: true };
}

test('new publication timestamps must match real production READY evidence and the complete article', async () => {
  const { validateStoryPublicationMetadata } = await load();
  assert.equal(typeof validateStoryPublicationMetadata, 'function');
  const f = fixture();
  assert.equal(validateStoryPublicationMetadata(f).pending, false);
  for (const change of [
    d => { d.firstDeployment.state = 'BUILDING'; },
    d => { d.firstDeployment.target = 'preview'; },
    d => { delete d.firstDeployment.ready; },
    d => { d.firstDeployment.ready += 1000; },
    d => { delete d.post.publishedAt; },
    d => { delete d.post.modifiedAt; },
    d => { d.post.publishedAt = '2026-10-20T08:05:00'; },
    d => { d.html = d.html.replace('가방 본문', '다른 본문'); },
  ]) {
    const changed = structuredClone(f); change(changed);
    assert.throws(() => validateStoryPublicationMetadata(changed));
  }
});

test('pending first deployment is allowed only during preparation and cannot carry invented times', async () => {
  const { validateStoryPublicationMetadata } = await load();
  assert.equal(typeof validateStoryPublicationMetadata, 'function');
  const f = fixture();
  f.html = f.html.replaceAll(f.post.publishedAt, f.post.date);
  delete f.post.publishedAt; delete f.post.modifiedAt; delete f.record.publication;
  f.record.publicationStatus = 'awaiting-first-deployment'; f.published = false;
  assert.equal(validateStoryPublicationMetadata(f).pending, true);
  assert.throws(() => validateStoryPublicationMetadata({ ...f, published: true }));
  f.post.publishedAt = '2026-10-20T08:00:00+09:00';
  assert.throws(() => validateStoryPublicationMetadata(f));
});

test('schema checks reject missing visible images, breadcrumbs, publisher logo and modification metadata', async () => {
  const { validateStoryPublicationMetadata } = await load();
  assert.equal(typeof validateStoryPublicationMetadata, 'function');
  const f = fixture();
  for (const html of [
    f.html.replace('"image":["https://himawari.co.kr/assets/story/bag.webp"]', '"image":[]'),
    f.html.replace('"BreadcrumbList"', '"Unrelated"'),
    f.html.replace('"logo":{"url":"https://himawari.co.kr/assets/himawari-logo-hq.png"}', '"logo":{}'),
    f.html.replace('"dateModified":"2026-10-20T08:05:00+09:00"', '"dateModified":"2026-10-20"'),
  ]) assert.throws(() => validateStoryPublicationMetadata({ ...f, html }));
});

test('a later content release preserves initial publication time and requires matching modification evidence', async () => {
  const { validateStoryPublicationMetadata } = await load();
  assert.equal(typeof validateStoryPublicationMetadata, 'function');
  const f = fixture();
  f.post.dateModified = '2026-10-21'; f.post.modifiedAt = '2026-10-21T09:10:00+09:00';
  f.record.publication.modifiedAt = f.post.modifiedAt;
  f.html = f.html.replace('"dateModified":"2026-10-20T08:05:00+09:00"', `"dateModified":"${f.post.modifiedAt}"`);
  f.modificationDeployment = { ...f.firstDeployment, id: 'dpl_revision', ready: Date.parse(f.post.modifiedAt), meta: { githubCommitSha: 'b'.repeat(40) } };
  assert.equal(validateStoryPublicationMetadata(f).pending, false);
  f.post.publishedAt = f.post.modifiedAt;
  assert.throws(() => validateStoryPublicationMetadata(f));
});

test('an unpublished revision keeps original publication evidence and cannot finish with a stale modification time', async () => {
  const { validateStoryPublicationMetadata } = await load();
  const { updateStorySchema } = await import('../scripts/lib/story-schema.mjs');
  const f = fixture();
  f.published = false; f.post.dateModified = '2026-10-21';
  f.record.publicationStatus = 'awaiting-content-deployment';
  delete f.post.modifiedAt; delete f.record.publication.modifiedAt; delete f.record.publication.modificationDeploymentEvidence;
  f.html = updateStorySchema(f.html, f.post);
  assert.equal(validateStoryPublicationMetadata(f).pending, true);
  assert.throws(() => validateStoryPublicationMetadata({ ...f, published: true }));
  f.post.modifiedAt = '2026-10-20T08:05:00+09:00';
  assert.throws(() => validateStoryPublicationMetadata(f));
});

test('RSS synchronization changes only selected verified publication times and detects omitted or duplicate items', async () => {
  const { synchronizeStoryFeed } = await load();
  assert.equal(typeof synchronizeStoryFeed, 'function');
  const f = fixture();
  const untouched = '<item><link>https://himawari.co.kr/story/older.html</link><pubDate>old declaration</pubDate></item>';
  const feed = `<rss><channel>${untouched}<item><link>${f.record.url}</link><pubDate>Tue, 20 Oct 2026 00:00:00 +0900</pubDate></item></channel></rss>`;
  const result = synchronizeStoryFeed(feed, [f.post]);
  assert.ok(result.includes(untouched));
  assert.ok(result.includes(`<pubDate>${new Date(f.post.publishedAt).toUTCString()}</pubDate>`));
  assert.equal(synchronizeStoryFeed(result, [f.post]), result);
  assert.throws(() => synchronizeStoryFeed('<rss/>', [f.post]));
  assert.throws(() => synchronizeStoryFeed(feed.replace('</channel>', `<item><link>${f.record.url}</link><pubDate>x</pubDate></item></channel>`), [f.post]));
});

test('first publication requires complete provider history and rejects a later deployment or redeploy', async () => {
  const { validateFirstPublicationHistory } = await load();
  assert.equal(typeof validateFirstPublicationHistory, 'function');
  const f = fixture();
  const baselineCommit = 'c'.repeat(40);
  const baseline = { ...f.firstDeployment, id: 'dpl_baseline', ready: Date.parse('2026-10-20T08:00:00+09:00'), meta: { githubCommitSha: baselineCommit } };
  const entry = { uid: f.firstDeployment.id, state: 'READY', target: 'production', created: f.firstDeployment.ready - 1000, meta: f.firstDeployment.meta };
  const input = { post: f.post, firstDeployment: f.firstDeployment, baselineDeployment: baseline, baselineCommit, history: { since: baseline.ready, pages: [{ result: { deployments: { pagination: { next: null }, deployments: [entry] } } }], details: [f.firstDeployment] }, readCommittedPosts: () => [f.post] };
  const cloneInput = () => ({ ...structuredClone({ ...input, readCommittedPosts: undefined }), readCommittedPosts: input.readCommittedPosts });
  assert.doesNotThrow(() => validateFirstPublicationHistory(input));
  for (const differentCommit of [false, true]) {
    const earlier = cloneInput();
    const d = { ...f.firstDeployment, id: 'dpl_earlier', ready: f.firstDeployment.ready - 30000, meta: { githubCommitSha: differentCommit ? 'd'.repeat(40) : f.firstDeployment.meta.githubCommitSha } };
    earlier.history.pages[0].result.deployments.deployments.push({ ...entry, id: d.id, created: d.ready - 1000, meta: d.meta });
    earlier.history.details.push(d);
    assert.throws(() => validateFirstPublicationHistory(earlier), /earliest/);
  }
  const partial = cloneInput(); partial.history.pages[0].result.deployments.pagination.next = entry.created;
  assert.throws(() => validateFirstPublicationHistory(partial), /complete/);
  const missing = cloneInput(); missing.history.details = [];
  assert.throws(() => validateFirstPublicationHistory(missing), /detail/);
});

test('modification time identifies the actual content release, including a later return to previous content', async () => {
  const { validateModificationPublicationHistory } = await load();
  assert.equal(typeof validateModificationPublicationHistory, 'function');
  const f = fixture(), baselineCommit = 'c'.repeat(40);
  const baseline = { ...f.firstDeployment, id: 'dpl_baseline', ready: f.firstDeployment.ready - 300000, meta: { githubCommitSha: baselineCommit } };
  const metadata = { ...f.firstDeployment, id: 'dpl_metadata', ready: f.firstDeployment.ready + 60000, meta: { githubCommitSha: 'b'.repeat(40) } };
  const details = [f.firstDeployment, metadata];
  const history = { since: baseline.ready, pages: [{ deployments: details.map(d => ({ uid: d.id, state: d.state, target: d.target, created: d.ready - 1000, meta: d.meta })), pagination: { next: null } }], details };
  const input = { post: f.post, baselineDeployment: baseline, baselineCommit, history, modificationDeployment: metadata, html: f.html, readCommittedPosts: () => [f.post], readCommittedArticle: () => f.html };
  assert.throws(() => validateModificationPublicationHistory(input), /content release/);
  assert.doesNotThrow(() => validateModificationPublicationHistory({ ...input, modificationDeployment: f.firstDeployment }));
  const changed = f.html.replace('가방 본문', '바뀐 가방 본문');
  const revision = { ...metadata, id: 'dpl_revision', ready: metadata.ready + 60000, meta: { githubCommitSha: 'd'.repeat(40) } };
  const reverted = { ...metadata, id: 'dpl_reverted', ready: revision.ready + 60000, meta: { githubCommitSha: 'e'.repeat(40) } };
  for (const d of [revision, reverted]) {
    history.details.push(d); history.pages[0].deployments.push({ uid: d.id, state: d.state, target: d.target, created: d.ready - 1000, meta: d.meta });
  }
  const revertInput = { ...input, readCommittedArticle: commit => commit === revision.meta.githubCommitSha ? changed : f.html, modificationDeployment: reverted };
  assert.doesNotThrow(() => validateModificationPublicationHistory(revertInput));
  assert.throws(() => validateModificationPublicationHistory({ ...revertInput, modificationDeployment: f.firstDeployment }), /content release/);
});
