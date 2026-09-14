(function(){
 'use strict';
 if(document.querySelector('.support-assistant'))return;
 var css=document.createElement('link');css.rel='stylesheet';css.href='/assets/assistant.css';document.head.appendChild(css);
 var host=document.createElement('aside');host.className='support-assistant';host.innerHTML='<button class="assistant-launch" type="button" aria-expanded="false" aria-controls="assistant-panel"><span aria-hidden="true">✦</span> 상담</button><section id="assistant-panel" hidden aria-label="히마와리 상담 도우미"><header><div><strong>히마와리 상담 도우미</strong><small>가방과 함께하는 모든 순간</small></div><button type="button" data-close aria-label="상담 닫기">×</button></header><div class="assistant-messages" role="log" aria-live="polite" aria-relevant="additions"></div><div class="assistant-quick"><button type="button">내 배송 조회</button><button type="button">배송 안내</button><button type="button">교환·반품</button><button type="button">수선 문의</button><button type="button">기타 문의</button></div><form><label class="sr-only" for="assistant-question">문의 내용</label><input id="assistant-question" maxlength="800" placeholder="궁금한 내용을 편하게 물어보세요" required autocomplete="off"><button type="submit">보내기</button></form><p class="assistant-note">AI가 답변합니다. 질문은 OpenAI로 전송되니 개인정보는 입력하지 마세요.</p><a class="assistant-contact" href="/contact.html">담당자에게 비공개 문의 남기기 ↗</a></section>';
 document.body.appendChild(host);
 var toggle=host.querySelector('.assistant-launch'),panel=host.querySelector('section'),log=host.querySelector('[role="log"]'),form=host.querySelector('form'),input=host.querySelector('#assistant-question'),send=form.querySelector('button'),busy=false,memberRevision=0;
 function bubble(text,role,link){var item=document.createElement('div');item.className='assistant-message '+role;var p=document.createElement('p');p.textContent=text;item.appendChild(p);if(link&&/^\/[a-z0-9/_.#-]+$/i.test(link)){var a=document.createElement('a');a.href=link;a.textContent='관련 안내 보기 →';item.appendChild(a);}log.appendChild(item);log.scrollTop=log.scrollHeight;return item;}
 bubble('안녕하세요! 히마와리 상담 도우미예요.\n배송, 교환, 가방 관리까지 편하게 물어보세요.','bot');
 function close(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();}
 toggle.onclick=function(){panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)input.focus();};host.querySelector('[data-close]').onclick=close;
 host.addEventListener('keydown',function(e){if(e.key==='Escape'&&!panel.hidden){e.preventDefault();close();}});
 async function ask(message){if(busy||!message.trim())return;var requestRevision=memberRevision;busy=true;send.disabled=true;host.querySelectorAll('.assistant-quick button').forEach(b=>b.disabled=true);bubble(message,'user');input.value='';var pending=bubble('안내를 확인하고 있어요.','pending');var controller=new AbortController();var timeout=setTimeout(()=>controller.abort(),16000);
 try{var response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:message}),signal:controller.signal});var data=await response.json();if(!response.ok)throw new Error(data.message||'답변을 불러오지 못했습니다.');pending.remove();var reply=bubble((data.mode==='ai'?'AI 안내\n':'')+data.answer,'bot',data.link);if(data.mode==='orders'){reply.dataset.privateOrder='true';if(requestRevision!==memberRevision)reply.remove();}}
 catch(error){pending.remove();bubble(error.name==='AbortError'?'응답이 지연됩니다. 다시 보내거나 비공개 문의를 이용해 주세요.':error.message,'bot');input.value=message;}
 finally{clearTimeout(timeout);busy=false;send.disabled=false;host.querySelectorAll('.assistant-quick button').forEach(b=>b.disabled=false);}}
 document.addEventListener('himawari:member-ready',function(){memberRevision++;log.querySelectorAll('[data-private-order]').forEach(function(item){item.remove();});});
 form.onsubmit=function(e){e.preventDefault();ask(input.value.trim());};host.querySelectorAll('.assistant-quick button').forEach(b=>b.onclick=()=>ask(b.textContent));

})();
