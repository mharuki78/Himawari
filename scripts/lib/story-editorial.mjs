import assert from 'node:assert/strict';
export const escapeHtml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const schemaTag = data => `<script type="application/ld+json">${JSON.stringify(data).replaceAll('<','\\u003c')}</script>`;

export function renderRevision(original, revision, photo, modifiedDate) {
  assert.equal(revision.id, original.id, 'Revision ID differs');
  assert.equal((revision.bodyHtml.match(/<!-- editorial-reference -->/g) || []).length, 1, 'One reference marker required');
  assert.ok(!/<\/?(?:div|script|style|iframe|img|h1)\b|\bon\w+\s*=|javascript:/i.test(revision.bodyHtml), 'Unsafe revision HTML');
  const title = escapeHtml(revision.title), summary = escapeHtml(revision.summary);
  const productUrl = `../product.html?id=${encodeURIComponent(original.product.id)}`;
  const generated=photo.kind==='generated';
  const figure = `<figure class="story-inline-figure"><img src="../${photo.asset}" width="${photo.width}" height="${photo.height}" loading="lazy" decoding="async" alt="Himawari ${escapeHtml(original.product.model)} ${generated?'AI 연출 제품 사진':'공식 제품 사진'}"><figcaption><a href="${productUrl}">${escapeHtml(original.product.model)} 제품 사진</a>. ${generated?'제품 원본을 참고한 AI 연출 사진입니다. 소품은 연출을 위해 함께 배치했습니다.':'공식 카탈로그에 실린 사진입니다.'} <a href="${escapeHtml(photo.sourceUrl)}" target="_blank" rel="noopener noreferrer">${generated?'참조한 제품 원본':'원본 사진'}</a></figcaption></figure>`;
  const related=original.html.match(/<p class="story-related">[\s\S]*?<\/p>/)?.[0] || '';
  const body=revision.bodyHtml.replace('<!-- editorial-reference -->',figure)+(revision.bodyHtml.includes('class="story-related"')?'':related);
  let html = original.html.replace(/<div class="story-body">[\s\S]*?<\/div>/, `<div class="story-body">${body}</div>`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title} | Himawari</title>`).replace(/<h1>[\s\S]*?<\/h1>/, `<h1>${title}</h1>`);
  for (const [key,value] of [['description',summary],['og:title',title],['og:description',summary]]) {
    const re = new RegExp(`(<meta (?:name|property)="${key}" content=")[^"]*(">)`);
    html = html.replace(re, `$1${value}$2`);
  }
  html = html.replace(/(<meta name="author" content=")[^"]*(">)/, '$1히마와리 편집팀$2');
  html = html.replace(/<div class="story-post-meta">[\s\S]*?<\/div>/, '<div class="story-post-meta"><span>히마와리 편집팀</span></div>');
  if (['first-story-20260829','behind-package-20260829'].includes(original.id)) {
    html=html.replace(/(<figure class="story-post-visual">[\s\S]*?alt=")([^"]*)(")/,(_,start,alt,end)=>`${start}${alt} (AI 연출)${end}`);
    html=html.replace(/(<figure class="story-post-visual">[\s\S]*?)(<\/figure>)/,'$1<figcaption>AI로 연출한 이미지입니다. 실제 제작 현장이나 배송 과정을 촬영한 사진이 아닙니다.</figcaption>$2');
  }
  const faqs = revision.faqs || [];
  html = html.replace(/<section class="story-faq"[\s\S]*?<\/section>/, '');
  if (faqs.length) html = html.replace('</article>', `<section class="story-faq" aria-labelledby="faq-title"><h2 id="faq-title">더 궁금한 점</h2>${faqs.map(f=>`<details><summary>${escapeHtml(f.question)}</summary><p>${escapeHtml(f.answer)}</p></details>`).join('')}</section></article>`);
  let hadFaq = false;
  html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (_,json)=>{
    const data = JSON.parse(json);
    if (data['@type']==='BlogPosting') return schemaTag({...data,headline:revision.title,description:revision.summary,datePublished:original.date,dateModified:modifiedDate,image:[new URL(original.image,'https://himawari.co.kr/story/').href,`https://himawari.co.kr/${photo.asset}`],author:{'@type':'Organization',name:'히마와리 편집팀'}});
    if (data['@type']==='FAQPage') {hadFaq=true;return faqs.length ? schemaTag({'@context':'https://schema.org','@type':'FAQPage',mainEntity:faqs.map(f=>({'@type':'Question',name:f.question,acceptedAnswer:{'@type':'Answer',text:f.answer}}))}) : '';}
    if (data['@type']==='BreadcrumbList') {data.itemListElement.at(-1).name=revision.title;return schemaTag(data);}
    return schemaTag(data);
  });
  if(faqs.length && !hadFaq) html=html.replace('</head>',`${schemaTag({'@context':'https://schema.org','@type':'FAQPage',mainEntity:faqs.map(f=>({'@type':'Question',name:f.question,acceptedAnswer:{'@type':'Answer',text:f.answer}}))})}</head>`);
  const sourceLinks = [...revision.bodyHtml.matchAll(/<a\b[^>]*href="(https:\/\/[^"<>]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  const sources = `<section class="story-sources" aria-labelledby="sources-title"><h2 id="sources-title">참고 자료</h2><ol><li><a href="${productUrl}">Himawari ${escapeHtml(original.product.model)} 제품 정보</a></li>${[...new Map(sourceLinks.map(m=>[m[1],m])).values()].map(m=>`<li><a href="${escapeHtml(m[1])}">${m[2].replace(/<[^>]+>/g,'')}</a></li>`).join('')}</ol></section>`;
  if(/<section class="story-sources"/.test(html)) html=html.replace(/<section class="story-sources"[\s\S]*?<\/section>/,sources);
  else html=html.replace('<p class="story-cta">',sources+'<p class="story-cta">');
  return html.replace(/[\t ]+$/gm,'');
}
