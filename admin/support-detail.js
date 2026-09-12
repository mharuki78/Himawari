import { fetchJson } from './admin-client.js';
export function showSupportDetail(parent, inquiry, onSaved) {
  parent.querySelector('[data-support-detail]')?.remove();
  const section = document.createElement('section'); section.dataset.supportDetail = '';
  const info = document.createElement('p'); info.textContent = `문의 종류: ${{ product:'제품', order:'주문', repair:'수선·A/S', partnership:'도매·입점·협업', other:'기타 문의' }[inquiry.serviceType] || '일반'}${inquiry.orderNumber ? ` · 확인된 주문: ${inquiry.orderNumber}` : ''}${inquiry.productId ? ` · 제품: ${inquiry.productId}` : ''}`;
  const label = document.createElement('label'); label.textContent = '문의 처리 상태';
  const select = document.createElement('select');
  for (const [id, name] of Object.entries({received:'접수', reviewing:'확인 중', waiting_customer:'고객 회신 대기', resolved:'처리 완료'})) select.append(new Option(name,id));
  select.value = inquiry.status || 'received'; label.append(select);
  const save = document.createElement('button'); save.type = 'button'; save.className = 'button button--primary'; save.textContent = '처리 상태 저장';
  const status = document.createElement('p'); status.setAttribute('role','status');
  save.addEventListener('click', async () => { save.disabled = true; try { await fetchJson('/api/admin/inquiries', {method:'PATCH',body:JSON.stringify({pathname:inquiry.pathname,etag:inquiry.etag,status:select.value})}); status.textContent='저장했습니다.'; await onSaved(); } catch(e){status.textContent=e.message;} finally{save.disabled=false;} });
  section.append(info,label,save,status);
  if(inquiry.hasAttachment){const button=document.createElement('button');button.type='button';button.className='button button--quiet';button.textContent='첨부 사진 보기';button.addEventListener('click',async()=>{button.disabled=true;try{const data=await fetchJson(`/api/admin/inquiries?attachment=${encodeURIComponent(inquiry.pathname)}`);if(!section.isConnected)return;if(data.attachment){const img=document.createElement('img');img.alt='고객이 비공개로 첨부한 문의 사진';img.style.maxWidth='100%';img.src=`data:${data.attachment.type};base64,${data.attachment.data}`;section.append(img);button.remove();}else status.textContent='첨부 사진이 없습니다.';}catch(e){status.textContent=e.message;button.disabled=false;}});section.append(button);}
  parent.append(section);
}
