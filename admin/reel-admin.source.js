import { upload } from '@vercel/blob/client';
import { HttpError, bindPasswordToggle, fetchJson } from './admin-client.js';

const $ = (selector) => document.querySelector(selector);
const initialView = $('[data-initial-view]');
const loginView = $('[data-login-view]');
const boardView = $('[data-board-view]');
const loginForm = $('[data-login-form]');
const passwordInput = $('#admin-password');
const passwordError = $('#admin-password-error');
const loginStatus = $('[data-login-status]');
const form = $('[data-reel-form]');
const list = $('[data-reel-list]');
const boardStatus = $('[data-board-status]');
const formStatus = $('[data-form-status]');
const submit = form.querySelector('button[type="submit"]');
const submitLabel = $('[data-submit-label]');
let config = { reels: [] };
let etag = null;
let uploadController = null;

function showLogin(message = '') { initialView.hidden = true; boardView.hidden = true; loginView.hidden = false; loginStatus.textContent = message; passwordInput.value = ''; requestAnimationFrame(() => passwordInput.focus()); }
function showBoard() { initialView.hidden = true; loginView.hidden = true; boardView.hidden = false; }
function safeMedia(url) { try { const parsed = new URL(url, location.origin); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : ''; } catch { return ''; } }
function formatBytes(bytes) { return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`; }
function setFileSummary(input, target) { target.textContent = input.files[0] ? `${input.files[0].name} · ${formatBytes(input.files[0].size)}` : '선택된 파일 없음'; }

function render() {
  $('[data-reel-count]').textContent = `${config.reels.length} / 12`;
  if (!config.reels.length) {
    const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = '등록된 영상이 없습니다.'; list.replaceChildren(empty); return;
  }
  list.replaceChildren(...config.reels.map((reel, index) => {
    const article = document.createElement('article'); article.className = 'reel-admin-card'; article.dataset.id = reel.id;
    const media = document.createElement('div'); media.className = 'reel-admin-card__media';
    const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.preload = 'metadata'; video.src = safeMedia(reel.videoUrl); if (reel.posterUrl) video.poster = safeMedia(reel.posterUrl);
    const play = document.createElement('button'); play.type = 'button'; play.className = 'reel-admin-card__preview'; play.textContent = '미리보기'; play.addEventListener('click', () => video.paused ? video.play() : video.pause()); media.append(video, play);
    const body = document.createElement('div'); body.className = 'reel-admin-card__body';
    const title = document.createElement('strong'); title.textContent = reel.name;
    const copy = document.createElement('p'); copy.textContent = `${reel.label} · ${reel.caption}`;
    const state = document.createElement('label'); state.className = 'admin-switch';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = reel.enabled; checkbox.addEventListener('change', () => update(reel.id, { enabled: checkbox.checked }, checkbox));
    const stateText = document.createElement('span'); stateText.textContent = '공개'; state.append(checkbox, stateText);
    const actions = document.createElement('div'); actions.className = 'reel-admin-card__actions';
    [['위로', -1], ['아래로', 1]].forEach(([label, direction]) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.disabled = direction < 0 ? index === 0 : index === config.reels.length - 1; button.addEventListener('click', () => move(index, direction)); actions.append(button); });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger-link'; remove.textContent = '삭제'; remove.addEventListener('click', () => removeReel(reel)); actions.append(remove);
    body.append(title, copy, state, actions); article.append(media, body); return article;
  }));
}

async function load() {
  try { const payload = await fetchJson('/api/admin/reels', { cache: 'no-store' }); config = payload.config; etag = payload.etag || null; render(); showBoard(); boardStatus.textContent = config.updatedAt ? `마지막 저장: ${new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(config.updatedAt))}` : '기본 영상 8개가 표시되고 있습니다.'; }
  catch (error) { if (error instanceof HttpError && error.status === 401) return showLogin(); showBoard(); boardStatus.textContent = error.message || '영상 목록을 불러오지 못했습니다.'; }
}

async function update(id, values, control) {
  control.disabled = true;
  try { const payload = await fetchJson('/api/admin/reels', { method: 'PATCH', body: JSON.stringify({ id, etag, ...values }) }); config = payload.config; etag = payload.etag; render(); boardStatus.textContent = '공개 설정을 저장했습니다.'; }
  catch (error) { boardStatus.textContent = error.message || '변경 내용을 저장하지 못했습니다.'; await load(); }
  finally { control.disabled = false; }
}

async function move(index, direction) {
  const next = index + direction; if (next < 0 || next >= config.reels.length) return;
  const ordered = config.reels.map((item) => item.id); [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
  try { const payload = await fetchJson('/api/admin/reels', { method: 'PATCH', body: JSON.stringify({ id: config.reels[index].id, etag, order: ordered }) }); config = payload.config; etag = payload.etag; render(); boardStatus.textContent = '영상 순서를 저장했습니다.'; }
  catch (error) { boardStatus.textContent = error.message || '순서를 저장하지 못했습니다.'; }
}

async function removeReel(reel) {
  if (!confirm(`“${reel.name}” 영상을 목록과 저장소에서 삭제할까요?`)) return;
  try { const payload = await fetchJson('/api/admin/reels', { method: 'DELETE', body: JSON.stringify({ id: reel.id, etag }) }); config = payload.config; etag = payload.etag; render(); boardStatus.textContent = '영상을 삭제했습니다.'; }
  catch (error) { boardStatus.textContent = error.message || '영상을 삭제하지 못했습니다.'; }
}

loginForm.addEventListener('submit', async (event) => { event.preventDefault(); if (!passwordInput.value) { passwordError.textContent = '관리자 비밀번호를 입력해 주세요.'; return passwordInput.focus(); } const button = loginForm.querySelector('button[type="submit"]'); button.disabled = true; try { await fetchJson('/api/admin/session', { method: 'POST', body: JSON.stringify({ password: passwordInput.value }) }); await load(); } catch (error) { loginStatus.textContent = error.message || '로그인하지 못했습니다.'; } finally { button.disabled = false; } });
bindPasswordToggle(passwordInput, $('[data-password-toggle]'));
$('[data-logout]').addEventListener('click', async () => { await fetchJson('/api/admin/session', { method: 'DELETE', body: '{}' }); showLogin('안전하게 로그아웃했습니다.'); });
$('#reel-video').addEventListener('change', (event) => setFileSummary(event.target, $('[data-video-summary]')));
$('#reel-poster').addEventListener('change', (event) => setFileSummary(event.target, $('[data-poster-summary]')));

form.addEventListener('submit', async (event) => {
  event.preventDefault(); if (submit.disabled) return;
  form.querySelectorAll('[data-error]').forEach((node) => { node.textContent = ''; });
  const video = form.elements.video.files[0]; const poster = form.elements.poster.files[0];
  if (!video) { form.querySelector('[data-error="video"]').textContent = '영상 파일을 선택해 주세요.'; return form.elements.video.focus(); }
  if (video.size > 50 * 1024 * 1024) { form.querySelector('[data-error="video"]').textContent = '영상은 50MB 이하만 올릴 수 있습니다.'; return; }
  if (poster && poster.size > 4 * 1024 * 1024) { form.querySelector('[data-error="poster"]').textContent = '포스터는 4MB 이하만 올릴 수 있습니다.'; return; }
  if (config.reels.length >= 12) { formStatus.textContent = '영상을 더 등록하려면 기존 영상 하나를 삭제해 주세요.'; return; }
  submit.disabled = true; submitLabel.textContent = '업로드 중'; formStatus.textContent = ''; $('[data-progress]').hidden = false; uploadController = new AbortController();
  const requestId = crypto.randomUUID(); const uploaded = [];
  try {
    const send = async (file, kind, prefix, start, span) => {
      const blob = await upload(`reel-media/${requestId}/${prefix}-${file.name}`, file, { access: 'public', handleUploadUrl: '/api/admin/product-upload', clientPayload: JSON.stringify({ requestId, kind }), abortSignal: uploadController.signal, onUploadProgress: ({ percentage }) => { const total = Math.round(start + percentage * span / 100); $('[data-progress-bar]').style.width = `${total}%`; $('[data-progress-label]').textContent = `업로드 ${total}%`; } }); uploaded.push(blob.url); return blob.url;
    };
    const videoUrl = await send(video, 'reel-video', 'video', 0, poster ? 85 : 100);
    const posterUrl = poster ? await send(poster, 'reel-poster', 'poster', 85, 15) : '';
    const payload = await fetchJson('/api/admin/reels', { method: 'POST', body: JSON.stringify({ requestId, etag, videoUrl, posterUrl, name: form.elements.name.value, label: form.elements.label.value, caption: form.elements.caption.value, enabled: form.elements.enabled.checked }) });
    config = payload.config; etag = payload.etag; form.reset(); form.elements.enabled.checked = true; $('[data-video-summary]').textContent = '선택된 파일 없음'; $('[data-poster-summary]').textContent = '선택된 파일 없음'; render(); formStatus.textContent = '영상을 등록했습니다. 홈 하단 영상 영역에 반영됩니다.';
  } catch (error) {
    if (uploaded.length) fetch('/api/admin/product-media', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'reel', requestId, urls: uploaded }) }).catch(() => {});
    if (error.fieldErrors) Object.entries(error.fieldErrors).forEach(([key, message]) => { const node = form.querySelector(`[data-error="${key}"]`); if (node) node.textContent = message; });
    formStatus.textContent = error.name === 'AbortError' ? '업로드를 취소했습니다.' : error.message || '영상을 등록하지 못했습니다.';
  } finally { uploadController = null; submit.disabled = false; submitLabel.textContent = '영상 등록'; $('[data-progress]').hidden = true; }
});

load();
