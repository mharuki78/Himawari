import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { validateStoryCount, usesMagazineStandard, validateStoryEditorial } from './lib/publication-schedule.mjs';
import { requiresStoryPublicationMetadata, validateStoryPublicationMetadata, validateFirstPublicationHistory, validateModificationPublicationHistory, productionRelease, articleHtml, synchronizeStoryFeed } from './lib/story-publication-metadata.mjs';

// Run from any directory. A failed or partial publication must exit nonzero.
const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const date = process.argv[2] || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
const all = JSON.parse(read('story/posts.json'));
const posts = all.filter(post => post.date === date);
assert.equal(new Set(all.map(p => p.id)).size, all.length, 'Duplicate post IDs');
const manifestPath = `docs/story-runs/${date}.json`;
const run = JSON.parse(read(manifestPath));
assert.equal(run.date, date);
const published = process.argv.includes('--published');
const metadataRequired = requiresStoryPublicationMetadata(date);
let metadataPending = false;
const committedPostCache = new Map();
const readCommittedPosts = commit => {
  if (!committedPostCache.has(commit)) committedPostCache.set(commit, JSON.parse(execFileSync('git', ['show', `${commit}:story/posts.json`], { cwd: root, encoding: 'utf8' })));
  return committedPostCache.get(commit);
};
if (metadataRequired) {
  assert.match(run.publicationBaselineCommit || '', /^[a-f0-9]{40}$/, 'Record publicationBaselineCommit before adding new stories');
  const baseline = readCommittedPosts(run.publicationBaselineCommit);
  for (const post of posts) assert.ok(!baseline.some(p => p.id === post.id || p.url === post.url), 'The publication baseline must precede these new stories');
}
const readDeploymentEvidence = file => {
  const folder = path.resolve(root, `backups/story-${date}`) + path.sep;
  const resolved = path.resolve(root, file || '');
  assert.ok(resolved.startsWith(folder), 'Deployment evidence must belong to this publication backup');
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
};
const baselineDeployment = metadataRequired ? readDeploymentEvidence(run.publicationBaselineEvidence) : null;
if (baselineDeployment) assert.equal(productionRelease(baselineDeployment).commit, run.publicationBaselineCommit, 'Baseline must be the original production READY commit');
const expectedCount = run.expectedCount ?? 3;
validateStoryCount(date, posts.length, expectedCount);
assert.equal(run.posts.length, expectedCount);
assert.equal(new Set(run.posts.map(p => p.image)).size, expectedCount, 'Images must differ');
assert.equal(new Set(run.posts.map(p => p.model)).size, expectedCount, 'Product models must differ');
const expectedGeneratedImages = usesMagazineStandard(date) ? expectedCount * 2 : date >= '2026-09-20' ? expectedCount : 1;
const generatedImages = run.posts.flatMap(p => usesMagazineStandard(date) ? (p.images || []).filter(i => i.imageKind === 'generated').map(i => i.image) : p.imageKind === 'generated' ? [p.image] : []);
const generated = generatedImages.length;
assert.equal(new Set(generatedImages).size, generated, 'Generated images must differ across posts');
if (usesMagazineStandard(date)) {
  assert.ok(generated >= expectedGeneratedImages, `Expected at least ${expectedGeneratedImages} new generated images`);
  assert.equal(run.expectedGeneratedImages, generated, 'Manifest generated image total differs');
  assert.equal(new Set(run.posts.map(p=>p.editorialForm)).size, expectedCount, 'Use different editorial forms for the daily articles');
  assert.equal(new Set(run.posts.map(p=>p.coreQuestion)).size, expectedCount, 'Use different core questions for the daily articles');
} else assert.equal(generated, expectedGeneratedImages, `Expected ${expectedGeneratedImages} new generated images`);
const files = ['story/posts.json', 'sitemap.xml', 'feed.xml', manifestPath];
const rewrites = JSON.parse(read('vercel.json')).rewrites || [];
for (const post of posts) {
  const record = run.posts.find(p => p.id === post.id);
  assert.ok(record, `Missing manifest: ${post.id}`);
  const file = `story/${post.url}`;
  const html = read(file);
  const illustrations = validateStoryEditorial(date, record, html);
  for (const illustration of illustrations) {
    assert.ok(fs.statSync(path.join(root, illustration)).size > 1000, `Missing image: ${illustration}`);
    files.push(illustration);
  }
  if (usesMagazineStandard(date)) for (const photo of record.images) {
    for (const source of [photo.reference, photo.generatedSource].filter(Boolean)) {
      assert.ok(source.startsWith(`backups/story-${date}/`) && !source.includes('..'), 'Source must belong to this publication backup');
      assert.ok(fs.statSync(path.join(root, source)).size > 1000, `Missing source: ${source}`);
    }
  }
  const asset = path.posix.normalize(`story/${post.image}`);
  assert.equal(record.image, asset);
  assert.ok(fs.statSync(path.join(root, asset)).size > 1000, `Missing image: ${asset}`);
  assert.ok(html.includes(`<h1>${post.title}</h1>`));
  assert.ok(html.includes(`datetime="${date}"`));
  assert.ok(html.includes(`rel="canonical" href="${record.url}"`));
  assert.ok(read('sitemap.xml').includes(`<loc>${record.url}</loc><lastmod>${post.dateModified || date}</lastmod>`));
  assert.ok(read('feed.xml').includes(record.url), 'Missing RSS item');
  const structured = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m => JSON.parse(m[1]));
  const article = structured.find(data => data['@type'] === 'BlogPosting');
  assert.equal(article?.datePublished, post.publishedAt || date);
  assert.equal(article?.headline, post.title);
  assert.equal(article?.url, record.url, 'Article URL must match the visible page');
  assert.equal(article?.publisher?.url, 'https://himawari.co.kr/', 'Missing article publisher');
  assert.ok(article?.author?.url?.startsWith('https://'), 'Missing author identity URL');
  assert.equal(article?.inLanguage, 'ko-KR', 'Missing article language');
  const deployments = metadataRequired && record.publication ? {
    firstDeployment: readDeploymentEvidence(record.publication.firstDeploymentEvidence),
    ...(record.publication.modificationDeploymentEvidence ? { modificationDeployment: readDeploymentEvidence(record.publication.modificationDeploymentEvidence) } : {}),
  } : {};
  const metadata = validateStoryPublicationMetadata({ post, record, html, published, ...deployments });
  metadataPending ||= metadata.pending;
  if (metadata.first) {
    execFileSync('git', ['merge-base', '--is-ancestor', run.publicationBaselineCommit, metadata.first.commit], { cwd: root });
    const baseline = validateFirstPublicationHistory({ post, firstDeployment: deployments.firstDeployment, baselineDeployment, baselineCommit: run.publicationBaselineCommit, history: readDeploymentEvidence(record.publication.firstDeploymentHistoryEvidence), readCommittedPosts });
    const introducedAt = Number(execFileSync('git', ['log', '--diff-filter=A', '--format=%ct', '--', file], { cwd: root, encoding: 'utf8' }).trim().split(/\s+/).at(-1)) * 1000;
    assert.ok(Number.isFinite(introducedAt) && baseline.ready <= introducedAt + 999, 'Baseline READY must precede initial story creation');
    const firstPosts = readCommittedPosts(metadata.first.commit);
    const firstPost = firstPosts.find(p => p.id === post.id && p.url === post.url && p.date === post.date);
    assert.ok(firstPost, 'First deployment must contain this original story');
    assert.ok(!firstPost.publishedAt && !firstPost.modifiedAt, 'Use the original content deployment, not a later metadata deployment');
    if (metadata.modification) {
      validateModificationPublicationHistory({ post, baselineDeployment, baselineCommit: run.publicationBaselineCommit, modificationDeployment: deployments.modificationDeployment, history: readDeploymentEvidence(record.publication.modificationDeploymentHistoryEvidence), readCommittedPosts, readCommittedArticle: commit => execFileSync('git', ['show', `${commit}:${file}`], { cwd: root, encoding: 'utf8' }), html });
      const releasedHtml = execFileSync('git', ['show', `${metadata.modification.commit}:${file}`], { cwd: root, encoding: 'utf8' });
      assert.equal(articleHtml(releasedHtml), articleHtml(html), 'Modification time must describe the exact released article content');
    }
    if (published) {
      const response = await fetch(record.url, { signal: AbortSignal.timeout(25000), cache: 'no-store' });
      assert.equal(response.status, 200, 'Published story must be accessible');
      validateStoryPublicationMetadata({ post, record, html: await response.text(), published: true, ...deployments });
    }
  }
  for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const href = match[1];
    if (/^(https?:|\/\/|mailto:|tel:|data:)/.test(href)) continue;
    const local = href.split(/[?#]/)[0];
    const resolved = path.resolve(root, local.startsWith('/') ? `.${local}` : path.join('story', local));
    const route = '/' + path.relative(root, resolved).replaceAll('\\', '/');
    const rewrite = rewrites.find(r => r.source === route);
    const destination = rewrite?.destination.split('?')[0];
    assert.ok(fs.existsSync(resolved) || (destination && fs.existsSync(path.join(root, `${destination}.js`))), `Broken local link: ${href}`);
  }
  files.push(file, asset);
}
if (metadataRequired && !metadataPending) assert.equal(synchronizeStoryFeed(read('feed.xml'), posts), read('feed.xml'), 'RSS must use verified original publication times');
if (published) {
  const receipt = JSON.parse(read(run.completionReceipt));
  assert.equal(receipt.date, date);
  assert.equal(receipt.state, 'READY');
  assert.equal(receipt.target, 'production');
  assert.match(receipt.deploymentUrl, /^https:\/\/[^/]+\.vercel\.app\/?$/);
  assert.match(receipt.commit, /^[a-f0-9]{40}$/);
  assert.equal(receipt.verifiedUrls.length, expectedCount);
  for (const post of run.posts) assert.ok(receipt.verifiedUrls.includes(post.url));
  assert.equal(receipt.homepageVerified, true);
  assert.equal(receipt.mobileVerified, true);
  for (const file of files) {
    const committed = execFileSync('git', ['show', `${receipt.commit}:${file}`], { cwd: root });
    assert.ok(committed.equals(fs.readFileSync(path.join(root, file))), `Receipt does not match file: ${file}`);
  }
  execFileSync('git', ['merge-base', '--is-ancestor', receipt.commit, 'origin/main'], { cwd: root });
  if (metadataRequired) {
    const feedResponse = await fetch('https://himawari.co.kr/feed.xml', { signal: AbortSignal.timeout(25000), cache: 'no-store' });
    assert.equal(feedResponse.status, 200);
    const feed = await feedResponse.text();
    assert.equal(synchronizeStoryFeed(feed, posts), feed, 'Live RSS must preserve the verified publication times');
  }
}
console.log(JSON.stringify({ date, posts: posts.map(p => p.url), images: run.posts.reduce((n,p)=>n+(p.images?.length || 1),0), generated, metadata: metadataPending ? 'awaiting-first-deployment' : metadataRequired ? 'verified' : 'historical', stage: published ? 'published' : 'prepared' }, null, 2));
