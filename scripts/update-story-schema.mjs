import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { updateStorySchema } from './lib/story-schema.mjs';
import { synchronizeStoryFeed } from './lib/story-publication-metadata.mjs';

const root = path.resolve(import.meta.dirname, '..');
const dateIndex = process.argv.indexOf('--date');
const date = dateIndex < 0 ? null : process.argv[dateIndex + 1];
if (dateIndex >= 0) assert.match(date || '', /^\d{4}-\d{2}-\d{2}$/, 'Use --date YYYY-MM-DD');
const posts = JSON.parse(fs.readFileSync(path.join(root, 'story/posts.json'), 'utf8')).filter(post => !date || post.date === date);
assert.ok(posts.length, 'No stories selected');
const feedPath = path.join(root, 'feed.xml');
const feed = date ? fs.readFileSync(feedPath, 'utf8') : null;
const updatedFeed = date ? synchronizeStoryFeed(feed, posts) : null;
let updated = 0;
for (const post of posts) {
  const file = path.resolve(root, 'story', post.url);
  if (!file.startsWith(path.join(root, 'story') + path.sep)) throw new Error('Invalid story path');
  const html = fs.readFileSync(file, 'utf8');
  const result = updateStorySchema(html, post);
  if (result !== html) { fs.writeFileSync(file, result); updated++; }
}
if (date && updatedFeed !== feed) fs.writeFileSync(feedPath, updatedFeed);
console.log(JSON.stringify({ stories: posts.length, updated, feedUpdated: date ? updatedFeed !== feed : false }));
