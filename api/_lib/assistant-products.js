import { readProductCatalog } from './products.js';

export const privateQuestion = /\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d{6}-?\d{7}\b|HMW-|HIM-|주문번호|송장번호|주소는|제 이름|이름은/i;
export const productQuestion = /가방|제품|추천|직장|출근|출장|학생|등교|여행|육아|노트북|수납|소재|세탁|관리|얼룩|보관|방수|백팩|필통|파우치|\b\d{4}[a-z]?\b/i;
export function productHistory(input) {
 return (Array.isArray(input) ? input : []).slice(-3).filter(x => typeof x === 'string' && x.length <= 800 && !privateQuestion.test(x) && !/주문|송장|배송.*조회/.test(x));
}
const groups = [
 [/직장|출근|출장|회사|비즈니스|정장/, /출근|출장|직장|비즈니스/],
 [/학생|학교|등교|교재|책가방/, /학생|책가방|대학생/],
 [/육아|기저귀|유모차|아기/, /기저귀|유모차/],
 [/여행|캠핑|운동|스포츠/, /여행|스포츠/],
 [/작은|작게|작아|미니|작고|작을|작은것/, /미니|Mini|블랙M/i],
 [/가벼|가볍|경량/, /경량/],
 [/노트북|맥북|그램/, /노트북/],
 [/남자|남성/, /남성|남녀공용|남여공용/],
 [/여자|여성/, /여성|남녀공용|남여공용/],
 [/큰|크게|대용량|넉넉/, /대용량|50L|넉넉/],
];
export function chooseCandidates(products, question) {
 const care=/관리|세탁|얼룩|보관/.test(question.split('\n').at(-1));
 const models = question.match(/\b\d{4}[a-z]?\b/gi) || [];
 const max = question.match(/(\d+(?:\.\d+)?)\s*만\s*원?\s*(?:이하|미만|까지|이내)/);
 const budget = max ? Number(max[1])*10000 : Infinity;
 const ranked = products.filter(p=>p.id && p.name && (care || (!p.soldOut && p.stock!==0)) && (p.price<=budget || !p.price)).map((p,index)=>{
  const text = [p.name,p.tagline,p.description,...(p.highlights||[])].join(' ');
  let score=0;
  for(const [intent,match] of groups) if(intent.test(question)&&match.test(text)) score+=10;
  for(const model of models) if(p.name.toLowerCase().includes(model.toLowerCase())) score+=60;
  for(const color of ['블랙','카키','핑크','아이보리','베이지','그레이']) if(question.includes(color)&&p.name.includes(color)) score+=8;
  return {p,score,index};
 }).sort((a,b)=>b.score-a.score||a.index-b.index);
 // Keep alternatives visible rather than filling the context with one model's colors.
 const counts=new Map();return ranked.filter(({p})=>{const key=p.model||p.name.match(/No\.([\w]+)/i)?.[1]||p.id;const n=counts.get(key)||0;counts.set(key,n+1);return n<3;}).slice(0,18).map(({p})=>p);
}
export const careGuidance = '공식 관리 이야기의 일반적인 부분 관리: 먼저 안쪽 취급 표시를 확인한다. 마른 부드러운 천으로 먼지를 털고, 물을 사용할 수 있는 소재일 때만 눈에 띄지 않는 부위에 소량의 물을 묻힌 흰 천으로 시험한 뒤 얼룩을 가볍게 닦는다. 세게 문지르거나 통째로 물에 담그지 않는다. 젖으면 내용물을 비우고 형태를 잡아 통풍되는 그늘에서 충분히 말린다. 열풍·직사광선을 피한다. 소재별 세탁 허용 여부는 등록된 specs.care가 우선이며 없으면 세탁기·건조기·표백제 사용이 가능하다고 단정하지 않는다. 방수라는 상품명만으로 완전 방수나 침수 안전을 보장하지 않는다.';
export async function loadProductContext(question, reader=readProductCatalog, preferredIds=[]) {
 const {catalog,persisted}=await reader();
 let candidates=chooseCandidates(catalog.products,question);
 if(/관리|세탁|얼룩|보관/.test(question.split('\n').at(-1))) {
  const selected=catalog.products.filter(p=>preferredIds.includes(p.id));
  candidates=[...selected,...candidates.filter(p=>!preferredIds.includes(p.id))].slice(0,18);
 }
 return {candidates, current:persisted, facts:candidates.map(p=>({id:p.id,name:p.name,price:persisted?p.price:undefined,description:p.description?.slice(0,900),highlights:p.highlights,specs:p.specs}))};
}
export function productCards(ids, context) {
 return [...new Set(ids.filter(id=>typeof id==='string'))].slice(0,3).map(id=>context.candidates.find(p=>p.id===id)).filter(Boolean).map(p=>({id:p.id,name:p.name,image:p.image,price:context.current?p.price:null,url:'/product.html?id='+encodeURIComponent(p.id)}));
}
