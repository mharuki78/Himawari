// Bound image transfers and temporary-media cleanup; product saves keep their existing lifecycle.
function withDeadline(operation, { signal, idleMs, maxMs, message }) {
  const controller = new AbortController();
  return new Promise((resolve, reject) => {
    let idleTimer, totalTimer, settled = false, loaded = 0;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(idleTimer); clearTimeout(totalTimer);
      signal?.removeEventListener('abort', cancel);
      callback(value);
    };
    const abort = error => {
      if (settled) return;
      controller.abort(error);
      finish(reject, error);
    };
    const cancel = () => abort(new DOMException('이미지 업로드를 취소했습니다.', 'AbortError'));
    const timeout = () => abort(new DOMException(message, 'TimeoutError'));
    const resetIdle = () => { clearTimeout(idleTimer); idleTimer = setTimeout(timeout, idleMs); };
    const progress = bytes => {
      if (settled || !Number.isFinite(bytes) || bytes <= 0 || bytes === loaded) return;
      loaded = bytes;
      resetIdle();
    };
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) { cancel(); return; }
    resetIdle();
    totalTimer = setTimeout(timeout, maxMs);
    try {
      Promise.resolve(operation(controller.signal, progress)).then(
        value => finish(resolve, value), error => finish(reject, error),
      );
    } catch (error) { finish(reject, error); }
  });
}

export function uploadProductImage(upload, pathname, file, options, { idleMs = 60_000, maxMs = 300_000 } = {}) {
  return withDeadline((signal, progress) => upload(pathname, file, {
    ...options,
    abortSignal: signal,
    onUploadProgress: event => { if (signal.aborted) return; progress(event.loaded); options.onUploadProgress?.(event); },
  }), { signal: options.abortSignal, idleMs, maxMs,
    message: '이미지 업로드 응답이 지연되어 중단했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.' });
}

export function runProductRequest(operation, { timeoutMs = 15_000 } = {}) {
  return withDeadline(signal => operation(signal), { idleMs: timeoutMs, maxMs: timeoutMs,
    message: '이미지 정리 서버의 응답이 지연되어 요청을 중단했습니다. 잠시 후 다시 시도해 주세요.' });
}
