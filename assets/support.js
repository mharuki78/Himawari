const form = document.querySelector('[data-support-form]');
const status = document.querySelector('[data-support-status]');
let requestId = `${String(9_999_999_999_999-Date.now()).padStart(13,'0')}-${crypto.randomUUID()}`;
const params = new URLSearchParams(location.search);
form.elements.productId.value = params.get('product') || '';
form.elements.orderNumber.value = params.get('order') || '';
if (['product','order','repair','partnership'].includes(params.get('type'))) form.elements.serviceType.value = params.get('type');
form.addEventListener('submit', async event => {
  event.preventDefault(); const button=form.querySelector('button[type="submit"]'); if(button.disabled)return;
  for(const input of form.querySelectorAll('[aria-invalid]'))input.removeAttribute('aria-invalid');
  const invalid=[...form.elements].find(e=>e.willValidate&&!e.validity.valid);
  if(invalid){invalid.setAttribute('aria-invalid','true');status.textContent='필수 항목과 이메일 형식을 확인해 주세요.';invalid.focus();return;}
  button.disabled=true;status.textContent='문의 내용을 안전하게 접수하고 있습니다.';
  try{
    const body=Object.fromEntries(new FormData(form));body.consent=form.elements.consent.checked;body.requestId=requestId;delete body.photo;
    const file=form.elements.photo.files[0];
    if(file){if(file.size>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('사진은 JPG·PNG·WebP, 2MB 이하로 선택해 주세요.');const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(Error('사진을 읽지 못했습니다.'));r.readAsDataURL(file);});body.attachment={type:file.type,data};}
    const response=await fetch('/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw Error(result.message||'문의를 접수하지 못했습니다.');
    status.textContent='문의가 접수되었습니다. 남겨주신 이메일로 답변을 안내드립니다. 추가 문의 시 같은 이메일과 제목을 알려주세요.';
    if(result.receipt){location.hash='receipt='+encodeURIComponent(result.receipt);showReceipt();const a=document.createElement('a');a.href=location.href;a.textContent=' 내 문의 처리 상태 확인 링크 (30일)';status.append(a);}
    form.reset();requestId=`${String(9_999_999_999_999-Date.now()).padStart(13,'0')}-${crypto.randomUUID()}`;
  }catch(e){status.textContent=(e instanceof TypeError?'서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.':e.message)+' 입력 내용은 유지했습니다.';}finally{button.disabled=false;}
});

function showReceipt(){document.querySelector('[data-receipt-check]').hidden=!new URLSearchParams(location.hash.slice(1)).get('receipt');}
document.querySelector('[data-receipt-check]').addEventListener('click',async event=>{const button=event.currentTarget;const message=document.querySelector('[data-receipt-status]');button.disabled=true;message.textContent='처리 상태를 확인하고 있습니다.';try{const response=await fetch('/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'status',receipt:new URLSearchParams(location.hash.slice(1)).get('receipt')})});const data=await response.json();if(!response.ok)throw Error(data.message||'조회하지 못했습니다.');message.textContent=({received:'접수되었습니다.',reviewing:'담당자가 확인 중입니다.',waiting_customer:'고객 회신을 기다리고 있습니다. 이메일을 확인해 주세요.',resolved:'처리가 완료되었습니다.'}[data.status]||'확인 중입니다.')+' 최종 변경: '+new Date(data.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});}catch(e){message.textContent=e instanceof TypeError?'서버에 연결하지 못했습니다. 다시 시도해 주세요.':e.message;}finally{button.disabled=false;}});
window.addEventListener('hashchange',showReceipt);showReceipt();
