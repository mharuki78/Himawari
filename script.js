const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('.site-nav');
const menuLabel = menuButton.querySelector('.sr-only');

function closeMenu({ restoreFocus = false } = {}) {
  menuButton.setAttribute('aria-expanded', 'false');
  menuLabel.textContent = '메뉴 열기';
  navigation.classList.remove('is-open');
  document.body.style.overflow = '';
  if (restoreFocus) menuButton.focus();
}

menuButton.addEventListener('click', () => {
  const willOpen = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(willOpen));
  menuLabel.textContent = willOpen ? '메뉴 닫기' : '메뉴 열기';
  navigation.classList.toggle('is-open', willOpen);
  document.body.style.overflow = willOpen ? 'hidden' : '';
});

navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => closeMenu()));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navigation.classList.contains('is-open')) closeMenu({ restoreFocus: true });
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
function setupReveals(root = document) {
  const revealItems = root.querySelectorAll('.reveal:not([data-reveal-ready])');
  revealItems.forEach((item) => item.setAttribute('data-reveal-ready', 'true'));

  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  revealItems.forEach((item) => observer.observe(item));
}

window.himawariReveal = setupReveals;
setupReveals();

const featureFilm = document.querySelector('.feature-film__video');
const featureFilmToggle = document.querySelector('[data-film-toggle]');

if (featureFilm && featureFilmToggle) {
  function updateFilmControl() {
    const isPaused = featureFilm.paused;
    featureFilmToggle.textContent = isPaused ? '영상 재생' : '영상 일시정지';
    featureFilmToggle.setAttribute('aria-pressed', String(isPaused));
  }

  function respectMotionPreference(event = reducedMotion) {
    if (event.matches) {
      featureFilm.pause();
      featureFilm.removeAttribute('autoplay');
      updateFilmControl();
      return;
    }

    featureFilm.setAttribute('autoplay', '');
    featureFilm.play().catch(updateFilmControl);
  }

  window.himawariToggleFilm = () => {
    if (featureFilm.paused) featureFilm.play().catch(updateFilmControl);
    else featureFilm.pause();
  };
  featureFilm.addEventListener('play', updateFilmControl);
  featureFilm.addEventListener('pause', updateFilmControl);
  reducedMotion.addEventListener?.('change', respectMotionPreference);
  respectMotionPreference();
}

const reelShowcase = document.querySelector('[data-reel-showcase]');

if (reelShowcase) {
  const reelRail = reelShowcase.querySelector('[data-reel-rail]');
  const reelCards = [...reelShowcase.querySelectorAll('[data-reel-card]')];
  const reelVideos = reelCards.map((card) => card.querySelector('[data-reel-video]'));
  const previousReel = reelShowcase.querySelector('[data-reel-prev]');
  const nextReel = reelShowcase.querySelector('[data-reel-next]');
  const playReel = reelShowcase.querySelector('[data-reel-play]');
  const soundReel = reelShowcase.querySelector('[data-reel-sound]');
  const reelStatus = reelShowcase.querySelector('[data-reel-status]');
  const initialReelIndex = Math.max(0, reelCards.findIndex((card) => card.hasAttribute('data-reel-initial')));
  let activeReelIndex = initialReelIndex;
  let reelSectionVisible = false;
  let reelSoundEnabled = false;
  let reelUserPaused = false;
  let reelScrollFrame = 0;

  function updateReelControls() {
    const activeVideo = reelVideos[activeReelIndex];
    const isPaused = activeVideo.paused;
    playReel.textContent = isPaused ? '영상 재생' : '영상 일시정지';
    playReel.setAttribute('aria-pressed', String(!isPaused));
    soundReel.textContent = reelSoundEnabled ? '소리 끄기' : '소리 켜기';
    soundReel.setAttribute('aria-pressed', String(reelSoundEnabled));
  }

  function playActiveReel() {
    reelVideos.forEach((video, index) => {
      if (index !== activeReelIndex) video.pause();
    });

    const activeVideo = reelVideos[activeReelIndex];
    activeVideo.muted = !reelSoundEnabled;
    if (!reelSectionVisible || reelUserPaused || reducedMotion.matches || document.hidden) {
      activeVideo.pause();
      updateReelControls();
      return;
    }

    activeVideo.play().catch(() => {
      reelSoundEnabled = false;
      activeVideo.muted = true;
      activeVideo.play().catch(updateReelControls);
    });
    updateReelControls();
  }

  function setActiveReel(nextIndex) {
    const boundedIndex = Math.max(0, Math.min(reelCards.length - 1, nextIndex));
    if (boundedIndex === activeReelIndex) {
      playActiveReel();
      return;
    }

    activeReelIndex = boundedIndex;
    reelUserPaused = false;
    reelCards.forEach((card, index) => {
      const isActive = index === activeReelIndex;
      card.classList.toggle('is-active', isActive);
      if (isActive) card.setAttribute('aria-current', 'true');
      else card.removeAttribute('aria-current');
    });
    reelStatus.textContent = `${activeReelIndex + 1} / ${reelCards.length} · ${reelCards[activeReelIndex].dataset.reelName}`;
    playActiveReel();
  }

  function findCenteredReel() {
    const railCenter = reelRail.getBoundingClientRect().left + reelRail.clientWidth / 2;
    return reelCards.reduce((closest, card, index) => {
      const rect = card.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - railCenter);
      return distance < closest.distance ? { index, distance } : closest;
    }, { index: 0, distance: Number.POSITIVE_INFINITY }).index;
  }

  function scrollToReel(index) {
    const nextIndex = (index + reelCards.length) % reelCards.length;
    reelCards[nextIndex].scrollIntoView({
      behavior: reducedMotion.matches ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center'
    });
    setActiveReel(nextIndex);
  }

  function centerReelImmediately(index) {
    const card = reelCards[index];
    reelRail.scrollLeft = card.offsetLeft - (reelRail.clientWidth - card.offsetWidth) / 2;
  }

  reelRail.addEventListener('scroll', () => {
    if (reelScrollFrame) return;
    reelScrollFrame = requestAnimationFrame(() => {
      reelScrollFrame = 0;
      setActiveReel(findCenteredReel());
    });
  }, { passive: true });

  reelRail.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    scrollToReel(activeReelIndex + (event.key === 'ArrowRight' ? 1 : -1));
  });

  previousReel.addEventListener('click', () => scrollToReel(activeReelIndex - 1));
  nextReel.addEventListener('click', () => scrollToReel(activeReelIndex + 1));
  window.himawariSelectReel = scrollToReel;

  playReel.addEventListener('click', () => {
    const activeVideo = reelVideos[activeReelIndex];
    if (activeVideo.paused) {
      reelUserPaused = false;
      playActiveReel();
    } else {
      reelUserPaused = true;
      activeVideo.pause();
    }
    updateReelControls();
  });

  soundReel.addEventListener('click', () => {
    reelSoundEnabled = !reelSoundEnabled;
    reelVideos[activeReelIndex].muted = !reelSoundEnabled;
    playActiveReel();
  });

  reelVideos.forEach((video, index) => {
    video.addEventListener('play', () => {
      reelCards[index].classList.add('is-playing');
      updateReelControls();
    });
    video.addEventListener('pause', () => {
      reelCards[index].classList.remove('is-playing');
      updateReelControls();
    });
  });

  const reelVisibility = new IntersectionObserver((entries) => {
    const entry = entries[0];
    reelSectionVisible = entry.isIntersecting && entry.intersectionRatio >= 0.25;
    if (reelSectionVisible) playActiveReel();
    else reelVideos.forEach((video) => video.pause());
    updateReelControls();
  }, { threshold: [0, 0.25, 0.6] });

  reducedMotion.addEventListener?.('change', playActiveReel);
  document.addEventListener('visibilitychange', playActiveReel);
  reelVisibility.observe(reelShowcase);
  requestAnimationFrame(() => {
    centerReelImmediately(initialReelIndex);
    setActiveReel(initialReelIndex);
  });
}

const form = document.querySelector('.contact-form');
if (form) {
  const status = form.querySelector('.form-status');
  const fields = [...form.querySelectorAll('input, textarea')];

  function validate(field) {
    const error = document.querySelector(`#${field.id}-error`);
    let message = '';
    if (!field.value.trim()) message = `${field.labels[0].textContent}을(를) 입력해 주세요.`;
    if (field.type === 'email' && field.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) message = '올바른 이메일 주소를 입력해 주세요.';
    error.textContent = message;
    field.setAttribute('aria-invalid', String(Boolean(message)));
    field.setAttribute('aria-describedby', error.id);
    return !message;
  }

  fields.forEach((field) => field.addEventListener('blur', () => validate(field)));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const valid = fields.map(validate).every(Boolean);
    if (!valid) {
      fields.find((field) => field.getAttribute('aria-invalid') === 'true')?.focus();
      status.textContent = '입력 내용을 확인해 주세요.';
      return;
    }
    status.textContent = '문의 접수 예시입니다. 실제 발송 기능은 이후 연결할 수 있어요.';
    form.reset();
    fields.forEach((field) => field.removeAttribute('aria-invalid'));
  });
}

const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();
