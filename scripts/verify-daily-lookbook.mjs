import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { root, koreanDate, validateEntries, renderGallery } from './build-lookbook.mjs';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const date = process.argv[2] || koreanDate();
assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
assert.ok(date <= koreanDate(), 'Future publication date');
const all = validateEntries(JSON.parse(read('lookbook/entries.json')));
const entries = all.filter(e => e.date === date);
const manifestPath = `docs/lookbook-runs/${date}.json`;
const run = JSON.parse(read(manifestPath));
assert.equal(run.date, date);
assert.ok(run.expectedCount === 2 || run.expectedCount === 3);
assert.equal(entries.length, run.expectedCount);
assert.equal(run.entries.length, entries.length);
assert.equal(new Set(entries.map(e => e.model)).size, entries.length, 'Use distinct products each day');
const html = read('lookbook/index.html');
assert.ok(html.includes(renderGallery(all)), 'Gallery is stale; rebuild');
assert.ok(html.includes('AI 착용 연출'));
assert.ok(html.includes('https://himawari.co.kr/lookbook/'));
assert.ok(read('sitemap.xml').includes('<loc>https://himawari.co.kr/lookbook/</loc>'));
const files = ['lookbook/entries.json', 'lookbook/index.html', 'lookbook/lookbook.css', 'lookbook/lookbook.js', manifestPath];
for (const entry of entries) {
  const record = run.entries.find(e => e.id === entry.id);
  assert.ok(record, `Missing record: ${entry.id}`);
  assert.equal(record.imageKind, 'generated');
  assert.equal(record.model, entry.model);
  assert.equal(record.productId, entry.productId);
  assert.equal(record.image, entry.image);
  assert.equal(record.fidelityReviewed, true);
  assert.equal(record.dimensionsCm.length, 3);
  assert.ok(record.dimensionsCm.every(n => Number.isFinite(n) && n > 0));
  assert.ok(record.dimensionsSource && record.prompt);
  for (const local of [record.reference, record.generatedSource]) {
    assert.ok(local.startsWith(`backups/lookbook-${date}/`) && !local.includes('..'));
    assert.ok(fs.statSync(path.join(root, local)).size > 1000, `Missing source: ${local}`);
  }
  files.push(entry.image.slice(1), entry.thumbnail.slice(1));
}
if (process.argv.includes('--published')) {
  const receipt = JSON.parse(read(run.completionReceipt));
  assert.equal(receipt.date, date);
  assert.equal(receipt.state, 'READY');
  assert.equal(receipt.target, 'production');
  assert.match(receipt.commit, /^[a-f0-9]{40}$/);
  assert.match(receipt.deploymentUrl, /^https:\/\/[^/]+\.vercel\.app\/?$/);
  assert.equal(receipt.url, 'https://himawari.co.kr/lookbook/');
  for (const key of ['desktopVerified', 'mobileVerified', 'viewerVerified', 'productLinksVerified']) assert.equal(receipt[key], true, `Missing ${key}`);
  assert.deepEqual([...receipt.entryIds].sort(), entries.map(e => e.id).sort());
  for (const file of files) {
    const committed = execFileSync('git', ['show', `${receipt.commit}:${file}`], {cwd:root});
    assert.ok(committed.equals(fs.readFileSync(path.join(root,file))), `Receipt differs: ${file}`);
  }
  execFileSync('git', ['merge-base', '--is-ancestor', receipt.commit, 'origin/main'], {cwd:root});
  const live = await fetch(receipt.url, {cache:'no-store'});
  assert.equal(live.status, 200);
  const liveHtml = await live.text();
  const liveSitemap = await fetch('https://himawari.co.kr/sitemap.xml', {cache:'no-store'});
  assert.equal(liveSitemap.status, 200);
  assert.ok((await liveSitemap.text()).includes('<loc>https://himawari.co.kr/lookbook/</loc>'), 'Missing live sitemap entry');
  for (const entry of entries) {
    assert.ok(liveHtml.includes(`id="${entry.id}"`), 'Missing live entry');
    for (const asset of [entry.image, entry.thumbnail]) {
      const response = await fetch(new URL(asset, receipt.url));
      assert.equal(response.status, 200);
      assert.ok(Buffer.from(await response.arrayBuffer()).equals(fs.readFileSync(path.join(root,asset))), `Live image differs: ${asset}`);
    }
  }
}
console.log(JSON.stringify({date,photos:entries.length,generated:entries.length,stage:process.argv.includes('--published')?'published':'prepared',url:'https://himawari.co.kr/lookbook/'}));
