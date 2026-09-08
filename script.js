function initializeSiteInsights() {
  window.va = window.va || function () {
    (window.vaq = window.vaq || []).push(arguments);
  };
  window.himawariTrack = function (name, data = {}) {
    const safeData = Object.fromEntries(Object.entries(data)
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
      .map(([key, value]) => [key.slice(0, 80), typeof value === 'string' ? value.slice(0, 180) : value]));
    window.va('event', { name: String(name).slice(0, 100), data: safeData });
  };

  [
    { src: '/_vercel/insights/script.js', name: 'vercel-analytics' },
    { src: '/_vercel/speed-insights/script.js', name: 'vercel-speed-insights' },
  ].forEach(({ src, name }) => {
    if (document.querySelector(`script[data-site-insight="${name}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.dataset.siteInsight = name;
    document.head.append(script);
  });

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('a,button');
    if (!target) return;
    if (target.matches('[data-cart-add]')) window.himawariTrack('Add to cart', { productId: target.dataset.productId || 'unknown' });
    if (target.matches('.direct-buy-link,[data-direct-buy],[data-closing-buy],[data-sticky-buy]')) window.himawariTrack('Begin checkout', { destination: 'internal-order' });
    if (target.closest('.store-product-card,.featured-product') && target.matches('a[href*="product.html"]')) window.himawariTrack('Select product', { href: target.getAttribute('href') || '' });
    if (target.matches('[data-wishlist-toggle]')) window.himawariTrack('Wishlist', { productId: target.dataset.productId || 'unknown' });
  });

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
  phone.href = 'tel:+821053373981';
  phone.textContent = '010-5337-3981';
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
