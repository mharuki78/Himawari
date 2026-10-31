import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderCatalogPage } from '../api/_lib/storefront.js';
const origin='https://himawari.co.kr';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const parse=html=>[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const data=JSON.parse(m[1]);return data['@graph']||[data];});

test('homepage does not publish an unmaintained fixed modification date',()=>{
 const graph=parse(read('index.html'));
 for(const type of ['WebPage','FAQPage'])assert.equal(graph.find(n=>n['@type']===type).dateModified,undefined);
 const faq=graph.find(n=>n['@type']==='FAQPage');
 const visible=[...read('index.html').matchAll(/<summary>(.*?)<\/summary>\s*<div class="home-faq__answer"><p>(.*?)<\/p>/g)].map(m=>({question:m[1],answer:m[2]}));
 assert.deepEqual(faq.mainEntity.map(q=>({question:q.name,answer:q.acceptedAnswer.text})),visible);
});

test('story collection defines the Blog identity referenced by all published articles',()=>{
 const graph=parse(read('story/index.html')),page=graph.find(n=>n['@type']==='CollectionPage'),blog=graph.find(n=>n['@type']==='Blog');
 assert.ok(page,'Missing story CollectionPage');assert.ok(blog,'Missing Blog');
 assert.equal(page.url,origin+'/story/');assert.equal(page.mainEntity['@id'],blog['@id']);
 assert.equal(blog['@id'],origin+'/story/#blog');assert.equal(blog.publisher['@id'],origin+'/#organization');
 const crumbs=graph.find(n=>n['@type']==='BreadcrumbList');assert.equal(page.breadcrumb['@id'],crumbs['@id']);
 for(const post of JSON.parse(read('story/posts.json')))assert.equal(parse(read('story/'+post.url)).find(n=>n['@type']==='BlogPosting').isPartOf['@id'],blog['@id']);
});

test('collection structured data describes the current category and canonical page',()=>{
 const collection={key:'travel',title:'여행 백팩',description:'여행에 쓸 백팩을 살펴보세요.',line1:'여행에 쓸',line2:'백팩'};
 const product={id:'test-bag',model:'No.1000',name:'히마와리 여행 백팩',price:45000,soldOut:false,image:'https://example.com/bag.jpg',gallery:[],highlights:[]};
 const html=renderCatalogPage(read('templates/products.html'),[product],origin,collection);
 const graph=parse(html),list=graph.find(n=>n['@type']==='ItemList'),page=graph.find(n=>n['@type']==='CollectionPage');
 assert.equal(list.name,collection.title);assert.equal(list.url,origin+'/collections/travel');
 assert.equal(list.itemListElement[0].item.url,origin+'/product.html?id=test-bag');
 assert.ok(page,'Missing catalog CollectionPage');assert.equal(page.url,list.url);assert.equal(page.mainEntity['@id'],list['@id']);
 assert.equal(graph.find(n=>n['@type']==='BreadcrumbList').itemListElement.at(-1).item,page.url);
 const all=parse(renderCatalogPage(read('templates/products.html'),[product],origin));
 assert.equal(all.find(n=>n['@type']==='CollectionPage').url,origin+'/products.html');
});
