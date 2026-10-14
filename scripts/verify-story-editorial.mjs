import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { bodyText } from './lib/publication-schedule.mjs';
import { escapeHtml } from './lib/story-editorial.mjs';
const root=path.resolve(import.meta.dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const date=process.argv[2];assert.match(date,/^\d{4}-\d{2}-\d{2}$/);
const manifestPath=`docs/story-editorial-runs/${date}.json`;
const run=JSON.parse(read(manifestPath));const posts=JSON.parse(read('story/posts.json'));
assert.equal(run.stage,'prepared');assert.equal(run.posts.length,run.expectedPosts);assert.equal(run.completedPosts,run.expectedPosts);
assert.equal(new Set(run.posts.map(p=>p.id)).size,run.expectedPosts);
const sitemap=read('sitemap.xml'),feed=read('feed.xml');const paragraphs=new Map();
const rewrites=JSON.parse(read('vercel.json')).rewrites||[];
const files=new Set(['story/posts.json','story/index.html','story/story.css','sitemap.xml','feed.xml',manifestPath]);
for(const record of run.posts){
 const post=posts.find(x=>x.id===record.id);assert.ok(post,`Missing post ${record.id}`);
 const file=`story/${post.url}`;const html=read(file);files.add(file);files.add(record.referenceAsset);
 assert.equal(post.date,record.publishedDate);assert.equal(post.dateModified,date);assert.equal(post.title,record.title);
 assert.ok(html.includes(`<h1>${escapeHtml(post.title)}</h1>`));assert.ok(html.includes(`rel="canonical" href="${record.url}"`));
 assert.equal(crypto.createHash('sha256').update(html).digest('hex'),record.sha256,`Page differs: ${post.id}`);
 const text=bodyText(html);assert.ok(text.length>=2400,`${post.id}: short body`);assert.equal(text.length,record.bodyChars);
 assert.ok(html.includes('class="story-inline-figure"'));assert.ok(html.includes(`../${record.referenceAsset}`));
 const hero=path.posix.normalize(`story/${post.image}`);files.add(hero);
 assert.ok(sitemap.includes(`<loc>${record.url}</loc><lastmod>${date}</lastmod>`));assert.ok(feed.includes(`<title>${escapeHtml(post.title)}</title>`));
 const schema=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));const article=schema.find(x=>x['@type']==='BlogPosting');
 assert.equal(article.headline,post.title);assert.equal(article.datePublished,post.date);assert.equal(article.dateModified,date);assert.ok(article.image.length>=2);
 const body=html.match(/<div class="story-body">([\s\S]*?)<\/div>/)[1].replace(/<figure\b[\s\S]*?<\/figure>/g,'');
 for(const match of body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)){const p=match[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();if(p.length<120)continue;assert.ok(!paragraphs.has(p),`Repeated paragraph: ${post.id} and ${paragraphs.get(p)}`);paragraphs.set(p,post.id);}
 for(const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)){
  const href=match[1];if(/^(https?:|\/\/|mailto:|tel:|data:)/.test(href))continue;
  const local=href.split(/[?#]/)[0];const resolved=path.resolve(root,local.startsWith('/')?`.${local}`:path.join('story',local));
  const route='/'+path.relative(root,resolved).replaceAll('\\','/');const destination=rewrites.find(r=>r.source===route)?.destination.split('?')[0];
  assert.ok(fs.existsSync(resolved)||(destination&&fs.existsSync(path.join(root,`${destination}.js`))),`Broken local link ${post.id}: ${href}`);
 }
}
if(process.argv.includes('--published')){
 const receipt=JSON.parse(read(run.completionReceipt));assert.equal(receipt.state,'READY');assert.equal(receipt.target,'production');assert.match(receipt.commit,/^[a-f0-9]{40}$/);assert.equal(receipt.date,date);assert.equal(receipt.verifiedUrls.length,run.expectedPosts);
 for(const key of ['desktopVerified','mobileVerified','homepageVerified','referenceImagesVerified'])assert.equal(receipt[key],true,`Missing browser evidence ${key}`);
 for(const file of files){assert.ok(execFileSync('git',['show',`${receipt.commit}:${file}`],{cwd:root}).equals(fs.readFileSync(path.join(root,file))),`Receipt differs ${file}`);}
 execFileSync('git',['merge-base','--is-ancestor',receipt.commit,'origin/main'],{cwd:root});
 for(let i=0;i<run.posts.length;i+=6)await Promise.all(run.posts.slice(i,i+6).map(async p=>{assert.ok(receipt.verifiedUrls.includes(p.url));const response=await fetch(p.url,{cache:'no-store'});assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),p.sha256,`Live page differs ${p.id}`);}));
 const assets=[...files].filter(f=>f.startsWith('assets/'));
 for(let i=0;i<assets.length;i+=6)await Promise.all(assets.slice(i,i+6).map(async f=>{const response=await fetch(`https://himawari.co.kr/${f}`,{cache:'no-store'});assert.equal(response.status,200);assert.ok(Buffer.from(await response.arrayBuffer()).equals(fs.readFileSync(path.join(root,f))),`Live image differs ${f}`);}));
}
console.log(JSON.stringify({date,posts:run.posts.length,minChars:Math.min(...run.posts.map(p=>p.bodyChars)),maxChars:Math.max(...run.posts.map(p=>p.bodyChars)),stage:process.argv.includes('--published')?'published':'prepared'}));
