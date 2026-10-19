import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifiedTime } from './story-schema.mjs';

const ORIGIN = 'https://himawari.co.kr';
export const requiresStoryPublicationMetadata = date => date >= '2026-10-19';
export const articleHtml = html => {
  const article = html.match(/<article\b[^>]*>[\s\S]*?<\/article>/)?.[0];
  assert.ok(article, 'Missing visible article');
  return article;
};
export const articleHash = html => crypto.createHash('sha256').update(articleHtml(html)).digest('hex');

export function productionRelease(raw) {
  const d = raw?.result?.deployment || raw?.deployment || raw;
  assert.equal(d?.readyState || d?.state, 'READY', 'Timestamp evidence must be a READY deployment');
  assert.equal(d.target, 'production', 'Timestamp evidence must be production');
  assert.match(d.id || '', /^dpl_[a-zA-Z0-9]+$/, 'Missing provider deployment ID');
  const commit = d.meta?.githubCommitSha;
  assert.match(commit || '', /^[a-f0-9]{40}$/, 'Missing provider Git commit');
  const ready = d.ready ?? d.readyAt;
  assert.ok(Number.isSafeInteger(ready) && ready > 0, 'Missing actual provider READY time');
  return { id: d.id, commit, ready };
}

function publicationHistory({ post, baselineDeployment, baselineCommit, history, readCommittedPosts }) {
  const baseline = productionRelease(baselineDeployment);
  assert.equal(baseline.commit, baselineCommit, 'Baseline deployment must match the prepublication commit');
  assert.equal(history?.since, baseline.ready, 'Deployment history must start at the original baseline READY');
  assert.ok(history.pages?.length, 'Missing complete deployment history');
  const pages = history.pages.map(raw => raw?.result?.deployments || raw);
  assert.equal(pages.at(-1).pagination?.next, null, 'Deployment history must be complete');
  for (let i = 0; i < pages.length; i++) {
    assert.ok(Array.isArray(pages[i].deployments), 'Missing provider deployment listing');
    if (i > 0) {
      assert.ok(Number.isFinite(pages[i - 1].pagination?.next), 'Unexpected page after complete history');
      for (const entry of pages[i].deployments) assert.ok(entry.created <= pages[i - 1].pagination.next, 'Deployment history pagination differs');
    }
  }
  const candidates = [];
  for (const entry of pages.flatMap(p => p.deployments)) {
    assert.ok(entry.created >= history.since, 'Deployment listing falls outside the recorded baseline query');
    if ((entry.readyState || entry.state) !== 'READY' || entry.target !== 'production') continue;
    const commit = entry.meta?.githubCommitSha;
    assert.match(commit || '', /^[a-f0-9]{40}$/, 'Missing history commit');
    if (!readCommittedPosts(commit).some(p => p.id === post.id && p.url === post.url && p.date === post.date)) continue;
    const entryId = entry.id || entry.uid;
    const rawDetail = (history.details || []).find(raw => (raw?.result?.deployment || raw?.deployment || raw)?.id === entryId);
    assert.ok(rawDetail, `Missing actual deployment detail: ${entryId}`);
    const detail = productionRelease(rawDetail);
    assert.equal(detail.commit, commit, 'Deployment history detail commit differs');
    candidates.push(detail);
  }
  assert.ok(candidates.length, 'No production deployment containing this story');
  return { baseline, candidates: candidates.sort((a, b) => a.ready - b.ready) };
}

export function validateFirstPublicationHistory(input) {
  const { baseline, candidates } = publicationHistory(input);
  const earliest = candidates[0];
  const first = productionRelease(input.firstDeployment);
  assert.deepEqual(first, earliest, 'Use the earliest successful production release, not a later deployment or redeploy');
  return baseline;
}

export function validateModificationPublicationHistory(input) {
  const { candidates } = publicationHistory(input);
  let lastHash, contentRelease;
  for (const candidate of candidates) {
    const hash = articleHash(input.readCommittedArticle(candidate.commit));
    if (hash !== lastHash) contentRelease = candidate;
    lastHash = hash;
  }
  assert.equal(lastHash, articleHash(input.html), 'Latest recorded production content differs from the article');
  assert.deepEqual(productionRelease(input.modificationDeployment), contentRelease, 'Use the actual content release, not a metadata-only deployment or redeploy');
}

export function validateStoryPublicationMetadata({ post, record, html, published = false, firstDeployment, modificationDeployment }) {
  const url = `${ORIGIN}/story/${post.url}`;
  assert.equal(record.url, url);
  assert.ok(html.includes(`rel="canonical" href="${url}"`), 'Missing canonical article URL');
  const graph = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap(m => { const d = JSON.parse(m[1]); return d['@graph'] || [d]; });
  const articles = graph.filter(d => d['@type'] === 'BlogPosting');
  assert.equal(articles.length, 1, 'Exactly one BlogPosting required');
  const article = articles[0];
  assert.equal(article.headline, post.title);
  assert.equal(article.url, url);
  assert.equal(article['@id'], `${url}#article`);
  assert.equal(article.datePublished, post.publishedAt || post.date);
  assert.equal(article.dateModified, post.modifiedAt || post.dateModified || post.date);
  assert.equal(article.publisher?.url, ORIGIN + '/');
  assert.equal(article.publisher?.logo?.url, ORIGIN + '/assets/himawari-logo-hq.png', 'Missing publisher logo');
  assert.ok(article.author?.url?.startsWith('https://'), 'Missing author URL');
  assert.equal(article.inLanguage, 'ko-KR');
  assert.equal(article.isPartOf?.url, ORIGIN + '/story/');
  assert.ok(graph.some(d => d['@type'] === 'BreadcrumbList' && d.itemListElement?.at(-1)?.item === url), 'Missing canonical breadcrumb');
  const images = [...new Set([...articleHtml(html).matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(m => new URL(m[1].replaceAll('&amp;', '&'), url).href))];
  assert.ok(images.length, 'Missing visible article images');
  assert.deepEqual(article.image, images, 'Schema images must match visible article images');
  if (!requiresStoryPublicationMetadata(post.date)) return { pending: false, historical: true };

  const evidence = record.publication;
  if (!evidence) {
    assert.equal(published, false, 'Publication timestamp evidence required for completion');
    assert.equal(record.publicationStatus, 'awaiting-first-deployment', 'Declare the pending first deployment explicitly');
    assert.equal(post.publishedAt, undefined, 'Do not invent a time before first deployment evidence');
    assert.equal(post.modifiedAt, undefined, 'Do not invent a modification time before deployment evidence');
    return { pending: true };
  }
  assert.ok(verifiedTime(post.publishedAt, post.date, 'publishedAt'), 'Missing publishedAt');
  assert.equal(evidence.publishedAt, post.publishedAt, 'Manifest publication time differs');
  const first = productionRelease(firstDeployment);
  assert.equal(Date.parse(post.publishedAt), first.ready, 'publishedAt must match first production READY');
  if (record.publicationStatus === 'awaiting-content-deployment') {
    assert.equal(published, false, 'A pending content revision cannot be complete');
    assert.equal(post.modifiedAt, undefined, 'Discard the previous modification time for a new revision');
    assert.equal(evidence.modifiedAt, undefined, 'Discard the previous modification timestamp evidence');
    assert.equal(evidence.modificationDeploymentEvidence, undefined, 'A pending revision has no new deployment evidence yet');
    assert.equal(evidence.modificationDeploymentHistoryEvidence, undefined, 'Discard the previous modification history for a new revision');
    return { pending: true, first };
  }
  assert.ok(verifiedTime(post.modifiedAt, post.dateModified || post.date, 'modifiedAt'), 'Missing modifiedAt');
  assert.ok(Date.parse(post.modifiedAt) >= Date.parse(post.publishedAt), 'Modification is before publication');
  assert.equal(evidence.modifiedAt, post.modifiedAt, 'Manifest modification time differs');
  assert.equal(evidence.articleSha256, articleHash(html), 'Timestamp evidence belongs to different article content');
  const modification = productionRelease(modificationDeployment);
  assert.equal(Date.parse(post.modifiedAt), modification.ready, 'modifiedAt must match the content release READY');
  return { pending: false, first, modification };
}

export function synchronizeStoryFeed(feed, posts) {
  let output = feed;
  for (const post of posts.filter(p => p.publishedAt)) {
    verifiedTime(post.publishedAt, post.date, 'publishedAt');
    const url = `${ORIGIN}/story/${post.url}`;
    let count = 0;
    output = output.replace(/<item\b[^>]*>[\s\S]*?<\/item>/g, item => {
      if (item.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.replaceAll('&amp;', '&').trim() !== url) return item;
      count++;
      assert.equal((item.match(/<pubDate>/g) || []).length, 1, 'Exactly one RSS pubDate required');
      return item.replace(/<pubDate>[\s\S]*?<\/pubDate>/, `<pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>`);
    });
    assert.equal(count, 1, `${post.id}: exactly one RSS publication item required`);
  }
  return output;
}
