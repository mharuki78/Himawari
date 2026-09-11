function initializeSiteInsights() {
  if (window.location.pathname.endsWith('/support.html') || window.location.pathname.startsWith('/npay-review')) return;
  window.va = window.va || function () {
    (window.vaq = window.vaq || []).push(arguments);
  };
  window.himawariTrack = function (name, data = {}) {
    const safeData = Object.fromEntries(Object.entries(data)
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
      .map(([key, value]) => [key.slice(0, 80), typeof value === 'string' ? value.slice(0, 180) : value]));
    window.va('event', { name: String(name).slice(0, 100), data: safeData });
  };

  function appendInsightScript(src, name) {
    if (document.querySelector(`script[data-site-insight="${name}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.dataset.siteInsight = name;
    document.head.append(script);
  }

  appendInsightScript('/_vercel/speed-insights/script.js', 'vercel-speed-insights');
  fetch('/_vercel/insights/script.js', { method: 'HEAD', credentials: 'same-origin' })
    .then((response) => { if (response.ok) appendInsightScript('/_vercel/insights/script.js', 'vercel-analytics'); })
    .catch(() => {});

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('a,button');
    if (!target) return;

    if (target.matches('.direct-buy-link,[data-direct-buy],[data-closing-buy],[data-sticky-buy]')) window.himawariTrack('Begin checkout', { destination: 'internal-order' });
    if (target.closest('.store-product-card,.featured-product') && target.matches('a[href*="product.html"]')) window.himawariTrack('Select product', { href: target.getAttribute('href') || '' });
    if (target.matches('[data-wishlist-toggle]')) window.himawariTrack('Wishlist', { productId: target.dataset.productId || 'unknown' });
  });

  document.addEventListener('himawari:cart-added', event => window.himawariTrack('Add to cart', { productId: event.detail?.productId || 'unknown' }));
  const productId = new URLSearchParams(window.location.search).get('id');
  if (/\/product(?:\.html)?$/.test(window.location.pathname) && productId) window.himawariTrack('View product', { productId });
  if (/\/checkout(?:\.html)?$/.test(window.location.pathname)) window.himawariTrack('View checkout');
}

initializeSiteInsights();

function syncSiteNavigation() {
  const siteNavigation = document.querySelector('.site-nav');
  if (!siteNavigation) return;

  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const navigationItems = [
    { label: '제품', href: '/products.html', active: /\/(?:products|product)(?:\.html|\/|$)/.test(currentPath) || currentPath.includes('/templates/product') },
    { label: '가방 찾기', href: '/finder.html', active: /\/finder(?:\.html|\/|$)/.test(currentPath) },
    { label: '브랜드', href: '/about.html', active: /\/about(?:\.html|\/|$)/.test(currentPath) },
    { label: '이야기', href: '/story/', active: currentPath === '/story' || currentPath.startsWith('/story/') },
    { label: '게임', href: '/game.html', active: /\/game(?:\.html|\/|$)/.test(currentPath) },
    { label: '연락하기', href: '/contact.html', active: /\/contact(?:\.html|\/|$)/.test(currentPath) },
  ];

  const links = navigationItems.map((item) => {
    const link = document.createElement('a');
    link.href = item.href;
    link.textContent = item.label;
    if (item.active) link.setAttribute('aria-current', 'page');
    return link;
  });

  siteNavigation.replaceChildren(...links);
}

syncSiteNavigation();

const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('.site-nav');
const menuLabel = menuButton.querySelector('.sr-only');
const siteHeader = document.querySelector('.site-header');

function closeMenu({ restoreFocus = false } = {}) {
  menuButton.setAttribute('aria-expanded', 'false');
  menuLabel.textContent = '메뉴 열기';
  navigation.classList.remove('is-open');
  navigation.style.removeProperty('--mobile-menu-top');
  document.body.style.overflow = '';
  if (restoreFocus) menuButton.focus();
}

menuButton.addEventListener('click', () => {
  const willOpen = menuButton.getAttribute('aria-expanded') !== 'true';
  if (willOpen && siteHeader) navigation.style.setProperty('--mobile-menu-top', `${Math.round(siteHeader.getBoundingClientRect().bottom)}px`);
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

document.querySelectorAll('[data-ambient-film]').forEach((film) => {
  const video = film.querySelector('[data-ambient-video]');
  const toggle = film.querySelector('[data-ambient-toggle]');
  if (!video || !toggle) return;

  function updateFilmControl() {
    const isPlaying = !video.paused;
    toggle.textContent = isPlaying ? '영상 일시정지' : '영상 재생';
    toggle.setAttribute('aria-pressed', String(isPlaying));
  }

  function respectMotionPreference(event = reducedMotion) {
    if (event.matches) {
      video.pause();
      video.removeAttribute('autoplay');
      updateFilmControl();
      return;
    }

    video.setAttribute('autoplay', '');
    video.play().catch(updateFilmControl);
  }

  toggle.addEventListener('click', () => {
    if (video.paused) video.play().catch(updateFilmControl);
    else video.pause();
  });
  video.addEventListener('play', updateFilmControl);
  video.addEventListener('pause', updateFilmControl);
  reducedMotion.addEventListener?.('change', respectMotionPreference);
  respectMotionPreference();
});

function initializeJournalPencil() {
  const journal = document.querySelector('.journal');
  if (!journal) return;
  const desktopMouse = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 821px)');
  const pencil = document.createElement('span');
  pencil.className = 'journal-pencil';
  pencil.setAttribute('aria-hidden', 'true');
  pencil.innerHTML = '<svg viewBox="0 0 16 56" fill="none" focusable="false" aria-hidden="true"><path d="M3 9h10v33L8 54 3 42V9Z" fill="var(--moss)" stroke="var(--harbor)" stroke-width="1.3" stroke-linejoin="round"/><path d="M3 9V5a5 5 0 0 1 10 0v4" fill="var(--cream)" stroke="var(--harbor)" stroke-width="1.3"/><path d="M3 9h10v5H3z" fill="var(--cream)" stroke="var(--harbor)" stroke-width="1.3"/><path d="M6 15v25M10 15v25" stroke="var(--harbor)" stroke-opacity=".45"/><path d="m3 42 5 12 5-12-3 2-2-2-2 2-3-2Z" fill="var(--cream)" stroke="var(--harbor)" stroke-width="1.3" stroke-linejoin="round"/><path d="m6 49 2 5 2-5H6Z" fill="var(--harbor)"/></svg>';
  const trail = document.createElement('canvas');
  trail.className = 'journal-pencil-trail';
  trail.setAttribute('aria-hidden', 'true');
  document.body.append(trail, pencil);
  const ink = trail.getContext('2d');
  const lifetime = 900;
  let points = [];
  let frame = 0;
  let visible = false;
  let x = 0, y = 0;
  let angle = 30, targetAngle = 30;
  let canvasReady = false;
  let inkColor = '';

  function clearTrail() {
    points = [];
    ink?.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  function hide() {
    visible = false;
    pencil.classList.remove('is-visible', 'is-over-link');
    journal.classList.remove('is-pencil-active');
    clearTrail();
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function prepareCanvas() {
    if (canvasReady || !ink) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const bounds = trail.getBoundingClientRect();
    trail.width = Math.ceil(bounds.width * scale);
    trail.height = Math.ceil(bounds.height * scale);
    ink.setTransform(scale, 0, 0, scale, 0, 0);
    inkColor = getComputedStyle(pencil).getPropertyValue('--moss').trim();
    canvasReady = true;
  }

  function positionPencil() {
    // The SVG graphite tip is (8, 54); rotate about that exact pointer position.
    pencil.style.transform = `translate3d(${x - 8}px, ${y - 54}px, 0) rotate(${angle}deg)`;
  }

  function draw(now) {
    frame = 0;
    angle += (targetAngle - angle) * .2;
    positionPencil();
    points = points.filter((point) => now - point.time < lifetime);
    if (ink) {
      ink.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ink.strokeStyle = inkColor;
      ink.lineWidth = 1.35;
      ink.lineCap = 'round';
      ink.lineJoin = 'round';
      for (let i = 1; i < points.length; i += 1) {
        const previous = points[i - 1];
        const current = points[i];
        ink.globalAlpha = .48 * Math.max(0, 1 - (now - previous.time) / lifetime);
        ink.beginPath();
        ink.moveTo(previous.x, previous.y);
        ink.lineTo(current.x, current.y);
        ink.stroke();
      }
      ink.globalAlpha = 1;
    }
    if (visible && (points.length || Math.abs(targetAngle - angle) > .1)) {
      frame = requestAnimationFrame(draw);
    }
  }

  journal.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || !desktopMouse.matches || reducedMotion.matches || document.hidden) {
      hide();
      return;
    }
    const overLink = Boolean(event.target.closest('a, button, input, textarea, select, [contenteditable="true"]'));
    targetAngle = 30 + (visible ? Math.max(-10, Math.min(10, (event.clientX - x) * .25)) : 0);
    x = event.clientX;
    y = event.clientY;
    if (!visible) angle = targetAngle;
    visible = true;
    // Render the nib and ink together, with no gap between their endpoints.
    pencil.classList.add('is-visible');
    pencil.classList.toggle('is-over-link', overLink);
    journal.classList.toggle('is-pencil-active', !overLink);
    if (overLink) {
      clearTrail();
    } else {
      prepareCanvas();
      const now = performance.now();
      points = points.filter((point) => now - point.time < lifetime);
      points.push({ x, y, time: now });
      if (points.length > 160) points.shift();
    }
    if (!frame) frame = requestAnimationFrame(draw);
  }, { passive: true });
  journal.addEventListener('pointerleave', hide);
  journal.addEventListener('pointerdown', hide);
  window.addEventListener('scroll', hide, { passive: true, capture: true });
  window.addEventListener('resize', () => { hide(); canvasReady = false; }, { passive: true });
  window.addEventListener('blur', hide);
  document.addEventListener('visibilitychange', hide);
  document.addEventListener('keydown', hide);
  reducedMotion.addEventListener('change', hide);
  desktopMouse.addEventListener('change', hide);
}

initializeJournalPencil();

function initializeBagJourney() {
  const journey = document.querySelector('[data-bag-journey]');
  const section = journey?.closest('.intro');
  if (!journey || !section) return;
  let journeyVisible = false;

  const updatePosition = () => {
    if (reducedMotion.matches || window.innerWidth <= 820) {
      journey.style.removeProperty('--bag-shift');
      journey.style.removeProperty('--bag-turn');
      return;
    }
    if (!journeyVisible) return;
    const rect = section.getBoundingClientRect();
    const travel = Math.max(1, rect.height + window.innerHeight);
    const progress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / travel));
    journey.style.setProperty('--bag-shift', `${((progress - 0.5) * 30).toFixed(2)}px`);
    journey.style.setProperty('--bag-turn', `${((progress - 0.5) * 3).toFixed(2)}deg`);
  };

  let frame = 0;
  const requestPositionUpdate = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      updatePosition();
    });
  };
  const visibility = new IntersectionObserver(([entry]) => {
    journeyVisible = entry.isIntersecting;
    journey.classList.toggle('is-in-view', entry.isIntersecting);
    if (entry.isIntersecting) requestPositionUpdate();
  }, { threshold: [0, 0.25] });

  visibility.observe(section);
  window.addEventListener('scroll', requestPositionUpdate, { passive: true });
  window.addEventListener('resize', requestPositionUpdate, { passive: true });
  reducedMotion.addEventListener?.('change', requestPositionUpdate);
  updatePosition();
}

function initializeGamePreview() {
  const preview = document.querySelector('[data-game-preview]');
  const invite = preview?.closest('.game-invite');
  if (!preview || !invite) return;
  const visibility = new IntersectionObserver(([entry]) => {
    invite.classList.toggle('is-previewing', entry.isIntersecting && entry.intersectionRatio >= 0.35);
  }, { threshold: [0, 0.35, 0.7] });
  invite.addEventListener('focusin', () => invite.classList.add('is-previewing'));
  visibility.observe(invite);
}

function initializeCartFlight() {
  document.addEventListener('himawari:cart-added', (event) => {
    const trigger = event.detail?.button;
    const target = document.querySelector('.rdcart-btn');
    if (!(trigger instanceof Element) || !target) return;

    target.classList.remove('rdcart-btn--received');
    requestAnimationFrame(() => target.classList.add('rdcart-btn--received'));
    window.setTimeout(() => target.classList.remove('rdcart-btn--received'), 520);
    if (reducedMotion.matches || !target.animate) return;

    const sourceImage = trigger.closest('.store-product-card, .featured-product, .product-detail-hero')?.querySelector('img:not([hidden])');
    const sourceRect = (sourceImage || trigger).getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const flight = document.createElement('span');
    flight.className = 'rdcart-flight';
    flight.setAttribute('aria-hidden', 'true');
    if (sourceImage?.currentSrc || sourceImage?.src) {
      const image = document.createElement('img');
      image.src = sourceImage.currentSrc || sourceImage.src;
      image.alt = '';
      flight.append(image);
    }
    const size = Math.max(46, Math.min(92, sourceRect.width * 0.24));
    const startX = sourceRect.left + sourceRect.width / 2 - size / 2;
    const startY = sourceRect.top + sourceRect.height / 2 - size / 2;
    const moveX = targetRect.left + targetRect.width / 2 - size / 2 - startX;
    const moveY = targetRect.top + targetRect.height / 2 - size / 2 - startY;
    flight.style.setProperty('--flight-size', `${size}px`);
    flight.style.left = `${startX}px`;
    flight.style.top = `${startY}px`;
    document.body.append(flight);
    const animation = flight.animate([
      { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 0 },
      { transform: 'translate3d(0, -18px, 0) scale(1)', opacity: 1, offset: 0.18 },
      { transform: `translate3d(${moveX * 0.62}px, ${moveY * 0.32 - 34}px, 0) scale(.72)`, opacity: 1, offset: 0.62 },
      { transform: `translate3d(${moveX}px, ${moveY}px, 0) scale(.18)`, opacity: 0.28 }
    ], { duration: 680, easing: 'cubic-bezier(.22,.78,.28,1)', fill: 'forwards' });
    animation.finished.catch(() => {}).finally(() => flight.remove());
  });
}

initializeBagJourney();
initializeGamePreview();
initializeCartFlight();

function renderManagedReels(rail, items) {
  if (!Array.isArray(items) || !items.length) return;
  const cards = items.map((item, index) => {
    const card = document.createElement('article');
    card.className = `reel-card${index === Math.min(2, items.length - 1) ? ' is-active' : ''}`;
    card.dataset.reelCard = '';
    card.dataset.reelName = String(item.name || item.label || 'Himawari 영상');
    if (index === Math.min(2, items.length - 1)) { card.dataset.reelInitial = ''; card.setAttribute('aria-current', 'true'); }
    const media = document.createElement('div'); media.className = 'reel-card__media';
    if (item.posterUrl) media.style.backgroundImage = `url(${JSON.stringify(String(item.posterUrl)).slice(1, -1)})`;
    const video = document.createElement('video'); video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'none'; video.dataset.reelVideo = ''; video.dataset.reelSrc = String(item.videoUrl || ''); video.poster = String(item.posterUrl || ''); video.setAttribute('aria-label', `${card.dataset.reelName} 재생`);
    const playing = document.createElement('span'); playing.className = 'reel-card__playing'; playing.setAttribute('aria-hidden', 'true'); playing.textContent = 'Now playing';
    const select = document.createElement('button'); select.className = 'reel-card__select'; select.type = 'button'; select.dataset.reelSelect = ''; select.setAttribute('aria-label', `${card.dataset.reelName}을 가운데에서 재생`);
    const selectText = document.createElement('span'); selectText.textContent = '이 영상 보기'; const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '→'; select.append(selectText, arrow); media.append(video, playing, select);
    const caption = document.createElement('div'); caption.className = 'reel-card__caption'; const label = document.createElement('p'); label.textContent = String(item.label || 'Himawari'); const title = document.createElement('h3'); title.textContent = String(item.caption || 'Himawari의 디테일.'); caption.append(label, title); card.append(media, caption); return card;
  });
  rail.replaceChildren(...cards);
}

async function initReelShowcase() {
  const reelShowcase = document.querySelector('[data-reel-showcase]');
  if (!reelShowcase) return;
  const reelRail = reelShowcase.querySelector('[data-reel-rail]');
  try {
    const response = await fetch('/api/reels', { headers: { Accept: 'application/json' } });
    if (response.ok) renderManagedReels(reelRail, (await response.json()).items);
  } catch {
    // 배포 전 기본 영상 마크업을 그대로 사용합니다.
  }
  const reelCards = [...reelShowcase.querySelectorAll('[data-reel-card]')];
  const reelVideos = reelCards.map((card) => card.querySelector('[data-reel-video]'));
  const previousReel = reelShowcase.querySelector('[data-reel-prev]');
  const nextReel = reelShowcase.querySelector('[data-reel-next]');
  const playReel = reelShowcase.querySelector('[data-reel-play]');
  const soundReel = reelShowcase.querySelector('[data-reel-sound]');
  const reelStatus = reelShowcase.querySelector('[data-reel-status]');
  const reelProgress = reelShowcase.querySelector('[data-reel-progress]');
  const reelProgressBar = reelShowcase.querySelector('[data-reel-progress-bar]');
  const initialReelIndex = Math.max(0, reelCards.findIndex((card) => card.hasAttribute('data-reel-initial')));
  let activeReelIndex = initialReelIndex;
  let reelSectionVisible = false;
  let reelSoundEnabled = false;
  let reelUserPaused = false;
  let reelScrollFrame = 0;

  function updateReelProgress() {
    const activeVideo = reelVideos[activeReelIndex];
    const duration = Number.isFinite(activeVideo?.duration) && activeVideo.duration > 0 ? activeVideo.duration : 0;
    const progress = duration ? Math.max(0, Math.min(100, (activeVideo.currentTime / duration) * 100)) : 0;
    reelProgress?.setAttribute('aria-valuenow', String(Math.round(progress)));
    reelProgressBar?.style.setProperty('--reel-progress', String(progress / 100));
  }

  function updateReelControls() {
    const activeVideo = reelVideos[activeReelIndex];
    const isPaused = activeVideo.paused;
    playReel.textContent = isPaused ? '영상 재생' : '영상 일시정지';
    playReel.setAttribute('aria-pressed', String(!isPaused));
    soundReel.textContent = reelSoundEnabled ? '소리 끄기' : '소리 켜기';
    soundReel.setAttribute('aria-pressed', String(reelSoundEnabled));
    updateReelProgress();
  }

  function playActiveReel() {
    reelVideos.forEach((video, index) => {
      if (index !== activeReelIndex) releaseReel(video);
    });

    const activeVideo = reelVideos[activeReelIndex];
    activeVideo.muted = !reelSoundEnabled;
    if (!reelSectionVisible || reelUserPaused || reducedMotion.matches || document.hidden) {
      activeVideo.pause();
      updateReelControls();
      return;
    }

    ensureReelLoaded(activeVideo);
    activeVideo.play().catch(() => {
      reelSoundEnabled = false;
      activeVideo.muted = true;
      activeVideo.play().catch(updateReelControls);
    });
    updateReelControls();
  }

  function ensureReelLoaded(video) {
    if (video.dataset.reelLoaded === 'true' || !video.dataset.reelSrc) return;
    const source = document.createElement('source');
    source.src = video.dataset.reelSrc;
    source.type = 'video/mp4';
    video.append(source);
    video.dataset.reelLoaded = 'true';
    video.load();
  }

  function releaseReel(video) {
    video.pause();
    if (video.dataset.reelLoaded !== 'true') return;
    video.replaceChildren();
    delete video.dataset.reelLoaded;
    video.load();
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
  reelCards.forEach((card, index) => {
    card.querySelector('[data-reel-select]')?.addEventListener('click', () => scrollToReel(index));
  });

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
    video.addEventListener('timeupdate', () => {
      if (index === activeReelIndex) updateReelProgress();
    });
    video.addEventListener('durationchange', updateReelProgress);
  });

  const reelVisibility = new IntersectionObserver((entries) => {
    const entry = entries[0];
    reelSectionVisible = entry.isIntersecting && entry.intersectionRatio >= 0.25;
    if (reelSectionVisible) playActiveReel();
    else reelVideos.forEach(releaseReel);
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

initReelShowcase();

const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

const footerNavigation = document.querySelector('.site-footer nav[aria-label="푸터 메뉴"]');
if (footerNavigation && !footerNavigation.querySelector('a[href$="terms.html"]')) {
  const termsLink = document.createElement('a');
  termsLink.href = '/terms.html';
  termsLink.textContent = '이용약관';
  const privacyLink = document.createElement('a');
  privacyLink.href = '/privacy.html';
  privacyLink.textContent = '개인정보';
  footerNavigation.append(termsLink, privacyLink);
}

const footerBusiness = document.querySelector('.footer-business');
if (footerBusiness && !footerBusiness.querySelector('a[href^="tel:"]')) {
  const item = document.createElement('div');
  const term = document.createElement('dt');
  const detail = document.createElement('dd');
  const phone = document.createElement('a');
  term.textContent = '고객센터';
  phone.href = 'tel:+821084476271';
  phone.textContent = '010-8447-6271';
  detail.append(phone);
  item.append(term, detail);
  footerBusiness.append(item);
}

if (footerBusiness && !footerBusiness.querySelector('[data-business-email]')) {
  const item = document.createElement('div');
  item.dataset.businessEmail = '';
  const term = document.createElement('dt');
  const detail = document.createElement('dd');
  term.textContent = '고객센터 이메일';
  detail.textContent = 'golf4484@naver.com';
  item.append(term, detail);
  footerBusiness.append(item);
}
