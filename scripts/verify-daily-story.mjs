import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Run from any directory. A failed or partial publication must exit nonzero.
const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const date = process.argv[2] || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
const all = JSON.parse(read('story/posts.json'));
const posts = all.filter(post => post.date === date);
assert.equal(posts.length, 3, `${date}: expected exactly 3 posts, found ${posts.length}`);
assert.equal(new Set(all.map(p => p.id)).size, all.length, 'Duplicate post IDs');
const manifestPath = `docs/story-runs/${date}.json`;
const run = JSON.parse(read(manifestPath));
assert.equal(run.date, date);
assert.equal(run.posts.length, 3);
assert.equal(new Set(run.posts.map(p => p.image)).size, 3, 'Images must differ');
assert.equal(new Set(run.posts.map(p => p.model)).size, 3, 'Product models must differ');
assert.equal(run.posts.filter(p => p.imageKind === 'generated').length, 1, 'Exactly one new generated image');
const files = ['story/posts.json', 'sitemap.xml', 'feed.xml', manifestPath];
const rewrites = JSON.parse(read('vercel.json')).rewrites || [];
for (const post of posts) {
  const record = run.posts.find(p => p.id === post.id);
  assert.ok(record, `Missing manifest: ${post.id}`);
  const file = `story/${post.url}`;
  const html = read(file);
  const asset = path.posix.normalize(`story/${post.image}`);
  assert.equal(record.image, asset);
  assert.ok(fs.statSync(path.join(root, asset)).size > 1000, `Missing image: ${asset}`);
  assert.ok(html.includes(`<h1>${post.title}</h1>`));
  assert.ok(html.includes(`datetime="${date}"`));
  assert.ok(html.includes(`rel="canonical" href="${record.url}"`));
  assert.ok(read('sitemap.xml').includes(`<loc>${record.url}</loc><lastmod>${date}</lastmod>`));
  assert.ok(read('feed.xml').includes(record.url), 'Missing RSS item');
  const structured = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m => JSON.parse(m[1]));
  const article = structured.find(data => data['@type'] === 'BlogPosting');
  assert.equal(article?.datePublished, date);
  assert.equal(article?.headline, post.title);
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
if (process.argv.includes('--published')) {
  const receipt = JSON.parse(read(run.completionReceipt));
  assert.equal(receipt.date, date);
  assert.equal(receipt.state, 'READY');
  assert.equal(receipt.target, 'production');
  assert.match(receipt.deploymentUrl, /^https:\/\/[^/]+\.vercel\.app\/?$/);
  assert.match(receipt.commit, /^[a-f0-9]{40}$/);
  assert.equal(receipt.verifiedUrls.length, 3);
  for (const post of run.posts) assert.ok(receipt.verifiedUrls.includes(post.url));
  assert.equal(receipt.homepageVerified, true);
  assert.equal(receipt.mobileVerified, true);
  for (const file of files) {
    const committed = execFileSync('git', ['show', `${receipt.commit}:${file}`], { cwd: root });
    assert.ok(committed.equals(fs.readFileSync(path.join(root, file))), `Receipt does not match file: ${file}`);
  }
  execFileSync('git', ['merge-base', '--is-ancestor', receipt.commit, 'origin/main'], { cwd: root });
}
console.log(JSON.stringify({ date, posts: posts.map(p => p.url), images: 3, generated: 1, stage: process.argv.includes('--published') ? 'published' : 'prepared' }, null, 2));
