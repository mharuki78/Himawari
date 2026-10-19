import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { updateStorySchema } from '../scripts/lib/story-schema.mjs';
import { articleHash, synchronizeStoryFeed } from '../scripts/lib/story-publication-metadata.mjs';

test('daily CLI permits preparation but completes only after release evidence, synchronized metadata and live verification', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'himawari-publication-test-'));
  const date = '2026-10-20', base = `backups/story-${date}`, origin = 'https://himawari.co.kr';
  const write = (file, data) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), data); };
  const json = (file, data) => write(file, JSON.stringify(data));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = time => {
    git('add', '.');
    execFileSync('git', ['commit', '-qm', 'Isolated publication fixture'], { cwd: root, env: { ...process.env, GIT_AUTHOR_DATE: time, GIT_COMMITTER_DATE: time }, stdio: 'pipe' });
    return git('rev-parse', 'HEAD');
  };
  const release = (id, commit, time) => ({ id, state: 'READY', target: 'production', meta: { githubCommitSha: commit }, ready: Date.parse(time) });
  const run = (...args) => execFileSync(process.execPath, ['--import', pathToFileURL(path.join(root, 'mock-fetch.mjs')).href, path.join(root, 'scripts/verify-daily-story.mjs'), date, ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    for (const file of ['verify-daily-story.mjs', 'lib/publication-schedule.mjs', 'lib/story-schema.mjs', 'lib/story-publication-metadata.mjs']) write('scripts/' + file, fs.readFileSync(new URL('../scripts/' + file, import.meta.url)));
    write('.gitignore', 'backups/\n');
    // All HTTP is intercepted; this fixture never publishes or requests a real site.
    write('mock-fetch.mjs', "import fs from 'node:fs'; import path from 'node:path'; globalThis.fetch=async input=>{const url=new URL(input);if(url.origin!=='https://himawari.co.kr'||!(url.pathname==='/feed.xml'||/^\\/story\\/fixture-\\d\\.html$/.test(url.pathname)))throw Error('Unexpected fixture request');return new Response(fs.readFileSync(path.join(process.cwd(),url.pathname.slice(1))),{status:200});};");
    json('story/posts.json', []); json('vercel.json', { rewrites: [] });
    git('init', '-q'); git('config', 'user.name', 'Publication Test'); git('config', 'user.email', 'fixture@example.invalid');
    const baselineCommit = commit('2026-10-20T07:59:00+09:00');
    const baseline = release('dpl_baseline', baselineCommit, '2026-10-20T08:00:00+09:00');
    json(base + '/baseline.json', baseline);
    const posts = [], records = [];
    for (let i = 0; i < 3; i++) {
      const id = `fixture-${i}`, title = `가방 입구 비교 ${i}`;
      const images = ['hero', 'detail', 'product'].map((role, n) => {
        const image = `assets/story/${id}-${role}.webp`, reference = `${base}/${id}-${role}.jpg`, generatedSource = `${base}/${id}-${role}.png`;
        for (const file of [image, reference, generatedSource]) write(file, Buffer.alloc(1100));
        return { image, reference, generatedSource, imageKind: n < 2 ? 'generated' : 'reference', role, prompt: 'Isolated test fixture', fidelityReviewed: true, sourceUrl: 'https://example.invalid/reference.jpg' };
      });
      const post = { id, title, date, url: id + '.html', image: '../' + images[0].image };
      const url = `${origin}/story/${post.url}`;
      const schema = { '@type': 'BlogPosting', headline: title, datePublished: date, dateModified: date };
      const breadcrumb = { '@type': 'BreadcrumbList', itemListElement: [{ item: url }] };
      const html = `<link rel="canonical" href="${url}"><script type="application/ld+json">${JSON.stringify(schema)}</script><script type="application/ld+json">${JSON.stringify(breadcrumb)}</script><article><h1>${title}</h1><time datetime="${date}">${date}</time><div class="story-body"><p>${'가방 입구를 비교합니다. '.repeat(250)}</p>${images.map(p => `<img src="../${p.image}" alt="${p.imageKind === 'generated' ? 'AI 연출' : '제품 사진'}">`).join('')}</div></article>`;
      write('story/' + post.url, updateStorySchema(html, post));
      posts.push(post); records.push({ id, url, image: images[0].image, model: `No.${i}`, editorialForm: `형식${i}`, coreQuestion: `질문${i}`, images, publicationStatus: 'awaiting-first-deployment' });
    }
    const manifest = { date, publicationBaselineCommit: baselineCommit, publicationBaselineEvidence: base + '/baseline.json', expectedCount: 3, expectedGeneratedImages: 6, posts: records, completionReceipt: base + '/receipt.json' };
    json('story/posts.json', posts); json(`docs/story-runs/${date}.json`, manifest);
    write('sitemap.xml', posts.map(p => `<loc>${origin}/story/${p.url}</loc><lastmod>${date}</lastmod>`).join(''));
    write('feed.xml', `<rss>${posts.map(p => `<item><link>${origin}/story/${p.url}</link><pubDate>Tue, 20 Oct 2026 00:00:00 +0900</pubDate></item>`).join('')}</rss>`);
    assert.equal(JSON.parse(run()).metadata, 'awaiting-first-deployment');
    assert.throws(() => run('--published'));
    const contentCommit = commit('2026-10-20T08:03:00+09:00');
    const first = release('dpl_first', contentCommit, '2026-10-20T08:05:00+09:00');
    json(base + '/first.json', first);
    const history = { since: baseline.ready, pages: [{ result: { deployments: { pagination: { next: null }, deployments: [{ ...first, created: first.ready - 1000 }] } } }], details: [first] };
    json(base + '/history.json', history);
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i], record = records[i];
      post.publishedAt = post.modifiedAt = new Date(first.ready).toISOString(); post.dateModified = date;
      record.publicationStatus = 'verified';
      record.publication = { publishedAt: post.publishedAt, modifiedAt: post.modifiedAt, articleSha256: articleHash(fs.readFileSync(path.join(root, 'story', post.url), 'utf8')), firstDeploymentEvidence: base + '/first.json', modificationDeploymentEvidence: base + '/first.json', firstDeploymentHistoryEvidence: base + '/history.json', modificationDeploymentHistoryEvidence: base + '/history.json' };
      write('story/' + post.url, updateStorySchema(fs.readFileSync(path.join(root, 'story', post.url), 'utf8'), post));
    }
    json('story/posts.json', posts); json(`docs/story-runs/${date}.json`, manifest);
    write('feed.xml', synchronizeStoryFeed(fs.readFileSync(path.join(root, 'feed.xml'), 'utf8'), posts));
    assert.equal(JSON.parse(run()).metadata, 'verified');
    const finalCommit = commit('2026-10-20T08:06:00+09:00');
    git('update-ref', 'refs/remotes/origin/main', finalCommit);
    json(base + '/receipt.json', { date, state: 'READY', target: 'production', deploymentUrl: 'https://fixture.vercel.app', commit: finalCommit, verifiedUrls: records.map(p => p.url), homepageVerified: true, mobileVerified: true });
    assert.equal(JSON.parse(run('--published')).stage, 'published');
    json(base + '/history.json', { ...history, pages: [{ result: { deployments: { pagination: { next: first.ready }, deployments: [] } } }] });
    assert.throws(() => run('--published'));
    json(base + '/history.json', history);
    json(base + '/first.json', { ...first, ready: first.ready + 1000 });
    assert.throws(() => run('--published'));
    json(base + '/first.json', first);
    write('feed.xml', '<rss/>');
    assert.throws(() => run('--published'));
  } finally {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + 'himawari-publication-test-'), 'Cleanup must remain inside the isolated fixture directory');
    fs.rmSync(root, { recursive: true, force: true });
  }
});
