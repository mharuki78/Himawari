import fs from 'node:fs';
import path from 'node:path';
import { updateStorySchema } from './lib/story-schema.mjs';

const root = path.resolve(import.meta.dirname, '..');
const posts = JSON.parse(fs.readFileSync(path.join(root, 'story/posts.json'), 'utf8'));
let updated = 0;
for (const post of posts) {
  const file = path.resolve(root, 'story', post.url);
  if (!file.startsWith(path.join(root, 'story') + path.sep)) throw new Error('Invalid story path');
  const html = fs.readFileSync(file, 'utf8');
  const result = updateStorySchema(html, post);
  if (result !== html) { fs.writeFileSync(file, result); updated++; }
}
console.log(JSON.stringify({ stories: posts.length, updated }));
