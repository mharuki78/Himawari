import { Round, VERSION, BEAT, DURATION, APPROACH, WINDOW } from './rhythm-core.mjs';

const $ = selector => document.querySelector(selector);
const dialog = $('#rhythm-game'), settings = $('#rhythm-settings'), stage = $('[data-stage]');
const AudioType = window.AudioContext || window.webkitAudioContext;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PREF = 'himawari-rhythm-v1', REWARD = 'himawari-game-coupon-v1', WALLET = 'himawari-coupon-wallet-v1';
const labels = {book:'책',laptop:'노트북',headphones:'이어폰',bottle:'물병',camera:'카메라',glasses:'선글라스',passport:'여권',zip:'지퍼'};
const scenes = [{name:'출근 준비',word:'WORK',line:'오늘의 출근 준비',color:'블랙'},{name:'주말 산책',word:'WALK',line:'가벼운 주말 산책',color:'카키'},{name:'여행 출발',word:'WANDER',line:'새로운 곳으로 출발',color:'그레이'}];
const rank = {'shipping-free':1,'discount-10':2,'discount-15':3,'discount-20':4};
function read(key, fallback=null) { try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;} }
function write(key,value) {try {localStorage.setItem(key,JSON.stringify(value));return true;} catch {return false;} }
const pref = read(PREF, {});
let offset = Number.isInteger(pref.offset)&&Math.abs(pref.offset)<=150 ? pref.offset : 0;
let sound = pref.sound !== false, context, music, gain, source, ready = false;
let phase='lobby', round, events=[], session, practice=false, epoch=0, anchor=0, elapsed=0, frame=0;
let physicalDown=false, pointer=null, noteElements=new Map(), feedbackUntil=0, previousBeat=-1, previousScene=-1;
let finishInput=null, finishPending=false, calibration=null, calibrationTimer=0;
const tap = $('[data-tap]');

function announce(text) { $('[data-announcer]').textContent = text; }
function soundControl() { $('[data-sound]').textContent=sound?'♫':'♪';$('[data-sound]').setAttribute('aria-label',sound?'게임 소리 끄기':'게임 소리 켜기');$('[data-sound]').setAttribute('aria-pressed',String(sound));if(gain)gain.gain.setValueAtTime(sound?.85:0,context.currentTime);write(PREF,{sound,offset}); }
function wallet() {const stored=read(REWARD);$('[data-wallet]').textContent=stored?.token ? `${stored.label}이 이 브라우저에 저장되어 있습니다. 주문서에서 사용 조건을 확인해 주세요.`:'';}
async function request(url,body,timeout=10000) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try {const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal,credentials:'same-origin'});const data=await response.json();if(!response.ok)throw new Error(data.message||'연결을 확인한 뒤 다시 시도해 주세요.');return data;}
  finally{clearTimeout(timer);}
}
function loading(progress, message) { $('[data-load-bar]').style.transform=`scaleX(${progress/100})`;$('[data-load-percent]').textContent=`${Math.round(progress)}%`;$('[data-load-bar]').parentElement.setAttribute('aria-valuenow',String(Math.round(progress)));if($('[data-load-label]').textContent!==message)$('[data-load-label]').textContent=message; }
function loadingFocus(active){for(const node of document.querySelectorAll('.site-header,.announcement-bar,#main,.rhythm-footer,[data-settings],.skip-link'))node.inert=active;}
async function decodeScene(image) {
  if(image.complete&&!image.naturalWidth)image.src=image.getAttribute('src');
  let timer;
  try {await Promise.race([image.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('제품 사진을 불러오지 못했어요. 다시 시도해 주세요.')),15000);})]);}
  finally{clearTimeout(timer);}
}
async function load() {
  ready=false;$('[data-ready]').hidden=true;$('[data-loader]').hidden=false;$('[data-loader]').classList.remove('is-ready','has-error');$('[data-load-retry]').hidden=true;
  loading(0,'가방과 음악을 불러옵니다.');
  loadingFocus(true);
  try {
    if(!AudioType)throw new Error('이 브라우저는 게임 소리를 지원하지 않습니다. 최신 Chrome 또는 Safari로 열어 주세요.');
    context ||= new AudioType();if(!gain){gain=context.createGain();gain.connect(context.destination);}soundControl();
    const images=[$('.rhythm-display__bag'),...document.querySelectorAll('.rhythm-photos img')];let loaded=0;
    const imageResults=await Promise.allSettled(images.map(async image=>{await decodeScene(image);loaded++;loading(loaded/images.length*25,`가방과 제품 장면을 준비합니다. ${loaded} / ${images.length}`);}));
    if(imageResults.some(result=>result.status==='rejected'))throw new Error('제품 사진을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
    loading(25,'가방 준비 완료. 오늘의 음악을 불러옵니다.');
    const response=await fetch('assets/rhythm-pocket-day.mp3',{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error('음악을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');
    const total=Number(response.headers.get('content-length'))||0;let received=0;const chunks=[];
    if(response.body){const reader=response.body.getReader();while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.length;loading(25+(total?Math.min(55,received/total*55):25),'오늘의 음악을 불러옵니다.');}}
    else {const value=new Uint8Array(await response.arrayBuffer());chunks.push(value);received=value.length;}
    const bytes=new Uint8Array(received);let position=0;for(const chunk of chunks){bytes.set(chunk,position);position+=chunk.length;}
    music=await context.decodeAudioData(bytes.buffer);if(music.duration<DURATION/1000-.3)throw new Error('음악 파일을 확인하지 못했습니다. 다시 불러와 주세요.');loading(90,'박자와 쿠폰을 준비합니다.');
    try {const promoResponse=await fetch('/api/promotions',{signal:AbortSignal.timeout(5000),cache:'no-store'});if(!promoResponse.ok)throw Error();const promo=await promoResponse.json();$('[data-service]').textContent=promo.coupons?.length?'활성 쿠폰에 도전할 수 있어요. 헤드폰을 착용하면 박자를 듣기 좋아요.':'현재 쿠폰 이벤트 준비 중입니다. 게임과 연습은 즐길 수 있어요.';$('[data-coupon-status]').textContent=promo.coupons?.length?'최고 10,000점. 점수에 해당하는 활성 쿠폰 중 가장 좋은 한 장을 받아요.':'쿠폰 이벤트 준비 중입니다. 아래는 예정된 점수별 혜택입니다.';}catch{$('[data-service]').textContent='쿠폰 연결은 게임 시작 시 다시 확인합니다. 연습은 바로 할 수 있어요.';}
    loading(100,'준비됐어요. 오늘의 박자를 시작하세요.');ready=true;$('[data-ready]').hidden=false;$('[data-loader]').classList.add('is-ready');setTimeout(()=>{$('[data-loader]').hidden=true;loadingFocus(false);},250);
  } catch(error) {const message=error instanceof TypeError||['AbortError','TimeoutError'].includes(error.name)?'연결이 지연되고 있어요. 다시 불러와 주세요.':error.message;loading(0,message);$('[data-loader]').classList.add('has-error');$('[data-load-retry]').hidden=false;$('[data-load-retry]').focus();}
}
function currentTime() {return source?Math.max(0,elapsed+(context.currentTime-anchor)*1000):elapsed;}
function stopMusic() {if(source){try{source.stop();}catch{}source.disconnect();source=null;}}
function playMusic() {stopMusic();source=context.createBufferSource();source.buffer=music;source.connect(gain);anchor=context.currentTime+.12;source.start(anchor,elapsed/1000);}
function resetVisuals() {
  for(const node of noteElements.values())node.remove();noteElements.clear();$('[data-notes]').replaceChildren();
  stage.classList.remove('is-pressed','is-holding','on-beat');$('[data-feedback]').classList.remove('is-visible');$('[data-combo]').parentElement.classList.remove('is-active');$('[data-zip-progress]').style.transform='scaleX(0)';previousBeat=-1;previousScene=-1;physicalDown=false;pointer=null;feedbackUntil=0;
  $('[data-track-progress]').style.transform='scaleX(0)';$('[data-track-progress]').parentElement.setAttribute('aria-valuenow','0');$('[data-countdown]').textContent='';
}
async function start(isPractice=false) {
  if(!ready||phase==='starting'||finishPending)return;
  const own=++epoch;phase='starting';const buttons=[$('[data-start]'),$('[data-again]'),$('[data-practice]')];buttons.forEach(b=>b.disabled=true);$('[data-service]').textContent='박자를 준비하고 있습니다…';
  try {
    await context.resume();if(context.state!=='running')throw new Error('소리를 시작하지 못했습니다. 화면을 다시 눌러 주세요.');
    session=isPractice?null:await request('/api/games/rhythm/start',{});
    if(session&&session.version!==VERSION)throw new Error('게임이 업데이트됐어요. 페이지를 새로고침한 뒤 다시 시작해 주세요.');
    if(own!==epoch)return;
    practice=isPractice;round=new Round(session?.seed??1884);events=[];elapsed=0;finishInput=null;resetVisuals();
    if(practice){round.notes=round.notes.filter(n=>n.at+n.duration+WINDOW<12_000);round.units=round.notes.reduce((sum,n)=>sum+(n.duration?2:1),0);}
    $('[data-result]').hidden=true;$('[data-pause-panel]').hidden=true;$('[data-practice-label]').hidden=!practice;
    $('[data-pause]').disabled=false;$('[data-sound]').disabled=false;tap.disabled=false;
    if(!dialog.open)dialog.showModal();tap.focus({preventScroll:true});phase='playing';playMusic();frame=requestAnimationFrame(tick);
    announce(practice?'12초 연습을 시작합니다. 물건이 표시선에 닿을 때 눌러 주세요.':'게임을 시작합니다. 네 번의 박자 뒤에 물건이 내려옵니다.');
  }catch(error){phase=dialog.open?'result':'lobby';$('[data-service]').textContent=`${error.message} 연습하기는 쿠폰 연결 없이 할 수 있어요.`;if(dialog.open){$('[data-reward] strong').textContent='시작하지 못했습니다.';$('[data-reward] p').textContent=error.message;}}
  finally{buttons.forEach(b=>b.disabled=false);}
}
function sprite(item){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 80 80');const use=document.createElementNS(svg.namespaceURI,'use');use.setAttribute('href',`#item-${item}`);svg.append(use);return svg;}
function noteElement(note) {const node=document.createElement('div');node.className='rhythm-note'+(note.duration?' is-zip':'');node.append(sprite(note.item));if(note.duration){const tail=document.createElement('span');tail.className='rhythm-note__tail';node.prepend(tail);}$('[data-notes]').append(node);noteElements.set(note.id,node);return node;}
function inputDown() {
  if(phase!=='playing'||physicalDown)return;physicalDown=true;const at=Math.min(DURATION,currentTime());
  if(round.press(at+offset))events.push({type:'down',at:Math.round(at*10)/10});
  stage.classList.add('is-pressed');tap.classList.add('is-down');showFeedback(at);
}
function inputUp() {
  if(!physicalDown)return;physicalDown=false;stage.classList.remove('is-pressed');tap.classList.remove('is-down');
  if(phase!=='playing')return;const at=Math.min(DURATION,currentTime());if(round.release(at+offset))events.push({type:'up',at:Math.round(at*10)/10});showFeedback(at);
}
function showFeedback(time) {
  const feedback=round.feedback.splice(0);
  for(const hit of feedback){
    if(hit.grade!=='miss'&&hit.part==='head'&&hit.item!=='zip'){
      const node=noteElements.get(hit.id);if(node){noteElements.delete(hit.id);const y=stage.clientHeight*.58-node.clientHeight/2;if(reduced){node.remove();}else{node.animate([{transform:`translateY(${y}px) scale(1)`,opacity:1},{transform:`translateY(${y+80}px) scale(.35)`,opacity:0}],{duration:220,easing:'cubic-bezier(.23,1,.32,1)'}).finished.then(()=>node.remove()).catch(()=>node.remove());}}
    }
    const panel=$('[data-feedback]');panel.dataset.grade=hit.grade;panel.querySelector('strong').textContent=hit.grade.toUpperCase();panel.querySelector('span').textContent=hit.part==='empty'?'빈 박자는 쉬어가요 · 점수 차감':hit.grade==='miss'?'다음 박자를 잡아요':hit.grade==='perfect'?'딱 맞는 박자!':hit.delta<0?'조금 빨라요':'조금 늦어요';panel.classList.add('is-visible');feedbackUntil=time+420;
  }
  $('[data-score]').textContent=String(round.score).padStart(5,'0');$('[data-combo]').textContent=String(round.combo);$('[data-combo]').parentElement.classList.toggle('is-active',round.combo>=3);
}
function tick() {
  if(phase!=='playing')return;const raw=currentTime(),time=raw+offset,limit=practice?12_000:DURATION;
  round.advance(time);showFeedback(raw);
  const beat=Math.floor(raw/BEAT);if(beat!==previousBeat){previousBeat=beat;stage.classList.add('on-beat');}if(raw%BEAT>180)stage.classList.remove('on-beat');
  const scene=Math.min(2,Math.max(0,Math.floor((raw/BEAT-4)/32)));if(scene!==previousScene){previousScene=scene;stage.dataset.scene=String(scene);$('[data-scene-label]').textContent=scenes[scene].name;$('[data-chapter] span').textContent=scenes[scene].word;$('[data-chapter] strong').textContent=scenes[scene].line;$('[data-scene-credit]').textContent=`No.1884 · ${scenes[scene].color} · 제품 착용 연출 / AI 이미지 포함`;}
  const progress=Math.min(100,raw/limit*100);$('[data-track-progress]').style.transform=`scaleX(${progress/100})`;$('[data-track-progress]').parentElement.setAttribute('aria-valuenow',progress.toFixed(2));$('[data-time]').textContent=`${Math.max(0,Math.ceil((limit-raw)/1000))}초`;
  $('[data-countdown]').textContent=raw<4*BEAT?String(Math.max(1,4-Math.floor(raw/BEAT))):'';
  const h=stage.clientHeight,target=h*.58,speed=(target+90)/APPROACH;
  for(const note of round.notes){
    const settled=note.duration?note.tail!==null:note.head!==null;
    if(settled||note.at-time>APPROACH){if(settled&&noteElements.has(note.id)){noteElements.get(note.id).remove();noteElements.delete(note.id);}continue;}
    const node=noteElements.get(note.id)||noteElement(note);const holding=note.head!==null;
    const y=target-node.clientHeight/2-(holding?0:(note.at-time)*speed);node.style.transform=`translateY(${y}px)`;
    if(note.duration){node.style.setProperty('--hold-height',`${Math.max(0,(holding?note.at+note.duration-time:note.duration)*speed)}px`);node.classList.toggle('has-hit',holding);}
  }
  stage.classList.toggle('is-holding',Boolean(round.holding));$('[data-cue]').textContent=round.holding?'꼬리가 닿을 때 손을 떼세요!':'물건이 표시선에 닿을 때 톡!';
  if(round.holding){const progress=(time-round.holding.at)/round.holding.duration;$('[data-zip-progress]').style.transform=`scaleX(${Math.max(0,Math.min(1,progress))})`;}
  if(raw>feedbackUntil)$('[data-feedback]').classList.remove('is-visible');
  if(raw>=limit){finish();return;}frame=requestAnimationFrame(tick);
}
function pause() {
  if(phase!=='playing')return;if(!round.holding)inputUp();elapsed=currentTime();stopMusic();cancelAnimationFrame(frame);phase='paused';physicalDown=false;pointer=null;tap.classList.remove('is-down');stage.classList.remove('is-pressed');tap.disabled=true;
  $('[data-pause-panel]').hidden=false;$('[data-resume]').focus();announce('게임을 잠시 멈췄습니다.');
}
async function resume() {if(phase!=='paused')return;try{await context.resume();$('[data-pause-panel]').hidden=true;tap.disabled=false;phase='playing';playMusic();tap.focus();frame=requestAnimationFrame(tick);}catch{announce('소리를 다시 시작하지 못했습니다. 다시 눌러 주세요.');}}
function leave() {++epoch;finishPending=false;cancelAnimationFrame(frame);stopMusic();phase='lobby';resetVisuals();dialog.close();$('[data-start]').focus({preventScroll:true});$('[data-service]').textContent='준비됐어요. 내 박자에 맞춰 다시 도전하세요.';wallet();}
function renderResult(result) {
  $('[data-final-score]').textContent=String(result.score).padStart(5,'0');$('[data-rank]').textContent=result.score>=9200?'S':result.score>=8000?'A':result.score>=6500?'B':result.score>=5000?'C':'D';
  $('[data-empty-taps]').textContent=`박자 밖 탭 ${result.empty}회 · 헛박은 점수가 줄어요`;
  for(const name of ['perfect','good','miss'])$(`[data-${name}]`).textContent=String(result[name]);$('[data-max-combo]').textContent=String(result.maxCombo);
}
function saveCoupon(payload) {
  const tokens=read(WALLET,{});tokens[payload.coupon.id]=payload.token;const walletSaved=write(WALLET,tokens);
  const current=read(REWARD),value={couponId:payload.coupon.id,label:payload.coupon.label,token:payload.token,earnedAt:new Date().toISOString(),expiresAt:payload.expiresAt};
  const currentActive=current?.token&&(!current.expiresAt||new Date(current.expiresAt)>new Date());
  const preferredSaved=currentActive&&rank[current.couponId]>rank[value.couponId]?true:write(REWARD,value);wallet();return walletSaved&&preferredSaved;
}
async function claim() {
  if(!finishInput||finishPending)return;finishPending=true;const own=epoch;$('[data-claim-retry]').hidden=true;$('[data-again]').disabled=true;
  $('[data-reward] strong').textContent='쿠폰을 확인하고 있습니다.';$('[data-reward] p').textContent='완주 기록과 활성 혜택을 확인하는 중이에요.';
  try {
    const payload=await request('/api/games/rhythm/finish',finishInput,12000);if(own!==epoch)return;renderResult(payload.result);
    if(payload.coupon&&payload.token){const saved=saveCoupon(payload);$('[data-reward] strong').textContent=`${payload.coupon.label} ${payload.retained?'유지':'획득'}`;const terms=[];if(payload.coupon.minimumSubtotal)terms.push(`${payload.coupon.minimumSubtotal.toLocaleString('ko-KR')}원 이상 주문`);if(payload.coupon.maximumDiscount)terms.push(`최대 ${payload.coupon.maximumDiscount.toLocaleString('ko-KR')}원 할인`);terms.push(`${new Date(payload.expiresAt).toLocaleDateString('ko-KR')}까지`);$('[data-reward] p').textContent=(saved?'이 브라우저에 저장됐어요. 자사몰 무통장 주문에서 사용하세요. ':'쿠폰은 발급됐지만 브라우저 저장이 차단됐어요. 저장 설정을 확인하고 다시 시도해 주세요. ')+terms.join(' · ');if(!saved)$('[data-claim-retry]').hidden=false;window.himawariTrack?.('Rhythm coupon earned',{score:payload.result.score,couponId:payload.coupon.id});}
    else{$('[data-reward] strong').textContent=payload.result.score<5000?'다음 판에서 쿠폰에 도전해요.':'쿠폰 이벤트 준비 중';$('[data-reward] p').textContent=payload.message;}
  }catch(error){if(own!==epoch)return;$('[data-reward] strong').textContent='쿠폰 발급을 확인하지 못했습니다.';$('[data-reward] p').textContent=error.message;$('[data-claim-retry]').hidden=false;}
  finally{if(own===epoch){finishPending=false;$('[data-again]').disabled=false;announce($('[data-reward]').textContent);}}
}
function finish() {
  if(phase!=='playing')return;inputUp();elapsed=currentTime();stopMusic();cancelAnimationFrame(frame);phase='result';tap.disabled=true;$('[data-pause]').disabled=true;$('[data-result]').hidden=false;$('[data-countdown]').textContent='';$('[data-claim-retry]').hidden=true;
  if(!practice)round.advance(DURATION+WINDOW+1);renderResult(round.result());
  $('[data-result-eyebrow]').textContent=practice?'PRACTICE MAKES RHYTHM.':'YOUR DAY, WELL PACKED.';$('#result-title').textContent=practice?'박자를 익혔어요. 이제 실전!':'오늘의 리듬을 담았어요.';$('#result-title').focus();
  if(practice){$('[data-reward] strong').textContent='연습 완료';$('[data-reward] p').textContent='본 게임에서 5,000점부터 쿠폰에 도전하세요. 지퍼는 꾹 누르고 끝에서 놓으면 됩니다.';$('[data-again]').textContent='본 게임 시작하기 ↗';}
  else{$('[data-again]').textContent='한 번 더 플레이 ↗';finishInput={session:session.session,events,offset};claim();}
}
function stopCalibration(){clearTimeout(calibrationTimer);if(calibration)for(const node of calibration.nodes)try{node.stop();}catch{}calibration=null;$('[data-calibrate]').textContent='박자 듣고 8번 탭하기 ♫';}
function calibrationTap() {
  if(!calibration)return;const now=context.currentTime;if(now<calibration.start-.2)return;
  const delta=(now-(calibration.start+calibration.values.length*BEAT/1000))*1000;
  if(Math.abs(delta)>BEAT/2)return;calibration.values.push(delta);$('[data-calibration-status]').textContent=`${calibration.values.length} / 8 박자 · 같은 버튼을 계속 탭하세요.`;
  if(calibration.values.length===8){const values=calibration.values.sort((a,b)=>a-b);offset=Math.max(-150,Math.min(150,Math.round(-(values[3]+values[4])/10)*5));$('#rhythm-offset').value=String(offset);$('[data-offset-value]').textContent=`${offset} ms`;stopCalibration();$('[data-calibration-status]').textContent=`${offset} ms로 맞췄어요. 연습에서 확인해 보세요.`;}
}
async function calibrate() {
  if(calibration){calibrationTap();return;}if(!context)return;
  await context.resume();const start=context.currentTime+.7;calibration={start,values:[],nodes:[]};$('[data-calibrate]').textContent='박자에 맞춰 여기 탭!';$('[data-calibration-status]').textContent='소리를 듣고 같은 버튼을 8번 탭하세요.';
  for(let i=0;i<8;i++){const oscillator=context.createOscillator(),volume=context.createGain(),at=start+i*BEAT/1000;oscillator.frequency.value=880;volume.gain.setValueAtTime(0,at);volume.gain.linearRampToValueAtTime(.18,at+.003);volume.gain.exponentialRampToValueAtTime(.001,at+.1);oscillator.connect(volume);volume.connect(context.destination);oscillator.start(at);oscillator.stop(at+.12);calibration.nodes.push(oscillator);}
  calibrationTimer=setTimeout(()=>{if(calibration){stopCalibration();$('[data-calibration-status]').textContent='박자를 놓쳤어요. 다시 듣거나 슬라이더로 맞춰 주세요.';}},5500);
}
$('[data-start]').addEventListener('click',()=>start());$('[data-practice]').addEventListener('click',()=>start(true));$('[data-again]').addEventListener('click',()=>start());$('[data-load-retry]').addEventListener('click',load);
$('[data-claim-retry]').addEventListener('click',claim);$('[data-pause]').addEventListener('click',pause);$('[data-resume]').addEventListener('click',resume);document.querySelectorAll('[data-leave]').forEach(button=>button.addEventListener('click',leave));
$('[data-sound]').addEventListener('click',()=>{sound=!sound;soundControl();});
for(const surface of [stage,tap]){
  surface.addEventListener('pointerdown',event=>{if(pointer!==null||event.button>0||phase!=='playing')return;event.preventDefault();pointer=event.pointerId;surface.setPointerCapture(pointer);inputDown();});
  surface.addEventListener('pointerup',event=>{if(event.pointerId!==pointer)return;inputUp();pointer=null;});
  surface.addEventListener('pointercancel',event=>{if(event.pointerId!==pointer)return;inputUp();pointer=null;});
}
document.addEventListener('keydown',event=>{if(!dialog.open)return;if(event.code==='Escape'&&phase==='playing'){event.preventDefault();pause();return;}if(['Space','Enter'].includes(event.code)&&phase==='playing'){event.preventDefault();if(!event.repeat)inputDown();}});
document.addEventListener('keyup',event=>{if(['Space','Enter'].includes(event.code)&&phase==='playing'){event.preventDefault();inputUp();}});
dialog.addEventListener('cancel',event=>{event.preventDefault();if(phase==='playing')pause();else if(phase==='paused'||phase==='result')leave();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',pause);
$('[data-settings]').addEventListener('click',()=>{settings.showModal();$('#rhythm-offset').value=String(offset);$('[data-offset-value]').textContent=`${offset} ms`;});
$('#rhythm-offset').addEventListener('input',event=>{offset=Number(event.target.value);$('[data-offset-value]').textContent=`${offset} ms`;});
$('[data-calibrate]').addEventListener('click',calibrate);$('[data-settings-close]').addEventListener('click',()=>{write(PREF,{sound,offset});settings.close();});settings.addEventListener('close',()=>{stopCalibration();write(PREF,{sound,offset});$('[data-settings]').focus();});
wallet();load();
