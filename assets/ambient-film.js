// Posters remain available before a film enters the viewport or a visitor opts in.
export function initializeAmbientFilm(film, {
  motion = window.matchMedia('(prefers-reduced-motion: reduce)'),
  mobile = window.matchMedia('(max-width: 820px)'),
  visibility = document,
  Observer = window.IntersectionObserver,
} = {}) {
  const video = film.querySelector('[data-ambient-video]');
  const toggle = film.querySelector('[data-ambient-toggle]');
  const sound = film.querySelector('[data-ambient-sound]');
  if (!video || !toggle) return () => {};

  let visible = false;
  let userPaused = false;
  let manualPlayback = false;
  let awaitingSoundGesture = false;
  let loaded = false;
  let disposed = false;
  let observer;

  const canPlay = () => !disposed && visible && !visibility.hidden && !userPaused && (!motion.matches || manualPlayback);
  function updateControls() {
    toggle.textContent = video.paused ? '영상 재생' : '영상 일시정지';
    toggle.setAttribute('aria-pressed', String(!video.paused));
    if (sound) {
      sound.textContent = video.muted ? '소리 켜기' : '소리 끄기';
      sound.setAttribute('aria-pressed', String(!video.muted));
    }
  }
  function loadFilm() {
    if (loaded) return;
    const source = video.querySelector('source[data-src]');
    if (source) source.src = mobile.matches && video.dataset.ambientMobileSrc ? video.dataset.ambientMobileSrc : source.dataset.src;
    loaded = true;
    video.dataset.ambientLoaded = 'true';
    video.load();
  }
  async function startFilm() {
    loadFilm();
    try {
      await video.play();
    } catch (error) {
      if (sound && !video.muted && error.name === 'NotAllowedError' && canPlay()) {
        video.muted = true;
        awaitingSoundGesture = true;
        updateControls();
        try { await video.play(); } catch { /* Poster and play control remain available. */ }
      }
    }
    // A pending play() may settle after scroll, preference or tab state changed.
    if (!canPlay()) video.pause();
    updateControls();
  }
  function syncPlayback() {
    if (canPlay()) startFilm();
    else { video.pause(); updateControls(); }
  }
  function togglePlayback() {
    awaitingSoundGesture = false;
    if (video.paused) {
      userPaused = false;
      manualPlayback = true;
      syncPlayback();
    } else {
      userPaused = true;
      manualPlayback = false;
      video.pause();
    }
  }
  function toggleSound() {
    awaitingSoundGesture = false;
    video.muted = !video.muted;
    updateControls();
    if (!video.muted) { userPaused = false; manualPlayback = true; syncPlayback(); }
  }
  function enableSoundOnGesture(event) {
    if (!awaitingSoundGesture || !canPlay() || event.target.closest?.('button, a, input, select, textarea')) return;
    awaitingSoundGesture = false;
    video.muted = false;
    updateControls();
    syncPlayback();
  }
  function changeMotion() {
    manualPlayback = false;
    syncPlayback();
  }
  function onPlay() {
    if (!canPlay()) video.pause();
    updateControls();
  }

  toggle.addEventListener('click', togglePlayback);
  sound?.addEventListener('click', toggleSound);
  video.addEventListener('play', onPlay);
  video.addEventListener('pause', updateControls);
  video.addEventListener('volumechange', updateControls);
  motion.addEventListener?.('change', changeMotion);
  visibility.addEventListener('visibilitychange', syncPlayback);
  if (sound) visibility.addEventListener('click', enableSoundOnGesture);
  updateControls();

  if (Observer) {
    observer = new Observer(entries => {
      visible = entries[0].isIntersecting;
      syncPlayback();
    }, { threshold: 0.08 });
    observer.observe(film);
  } else {
    // Browsers without IntersectionObserver keep the poster until explicit play.
    visible = true;
    userPaused = true;
  }

  return () => {
    disposed = true;
    observer?.disconnect();
    video.pause();
    toggle.removeEventListener('click', togglePlayback);
    sound?.removeEventListener('click', toggleSound);
    video.removeEventListener('play', onPlay);
    video.removeEventListener('pause', updateControls);
    video.removeEventListener('volumechange', updateControls);
    motion.removeEventListener?.('change', changeMotion);
    visibility.removeEventListener('visibilitychange', syncPlayback);
    visibility.removeEventListener('click', enableSoundOnGesture);
  };
}

export function initializeAmbientFilms(root = document) {
  root.querySelectorAll('[data-ambient-film]').forEach(film => initializeAmbientFilm(film));
}
