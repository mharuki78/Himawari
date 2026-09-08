(function () {
  'use strict';

  var root = document.querySelector('[data-game-root]');
  if (!root) return;

  var REWARD_STORAGE_KEY = 'himawari-game-coupon-v1';
  var SOUND_STORAGE_KEY = 'himawari-game-sound-v1';
  var CATCH_SECONDS = 35;
  var PACK_SECONDS = 22;
  var PACK_TRANSFER_MS = 720;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var panels = Array.from(root.querySelectorAll('[data-game-panel]'));
  var consoleElement = root.querySelector('[data-game-console]');
  var phaseOutput = root.querySelector('[data-game-phase]');
  var scoreOutput = root.querySelector('[data-game-score]');
  var timeOutput = root.querySelector('[data-game-time]');
  var livesOutput = root.querySelector('[data-game-lives]');
  var announcer = root.querySelector('[data-game-announcer]');
  var catchStage = root.querySelector('[data-catch-stage]');
  var catchLayer = root.querySelector('[data-catch-layer]');
  var playerShadow = root.querySelector('[data-player-shadow]');
  var player = root.querySelector('[data-catch-player]');
  var gameToast = root.querySelector('[data-game-toast]');
  var pauseButton = root.querySelector('[data-game-pause]');
  var soundButton = root.querySelector('[data-game-sound]');
  var soundLabel = root.querySelector('[data-game-sound-label]');
  var exitButton = root.querySelector('[data-game-exit]');
  var moveButtons = Array.from(root.querySelectorAll('[data-game-move]'));
  var packingItems = root.querySelector('[data-packing-items]');
  var packingZones = root.querySelector('[data-packing-zones]');
  var finalScore = root.querySelector('[data-final-score]');
  var rewardOutput = root.querySelector('[data-game-reward]');
  var walletOutput = root.querySelector('[data-game-wallet]');
  var AudioContextType = window.AudioContext || window.webkitAudioContext;
  var audioContext = null;
  var musicBus = null;

  var goodItems = [
    { id: 'book', label: '책', code: 'BOOK', zone: 'main', points: 140 },
    { id: 'laptop', label: '노트북', code: 'PC', zone: 'laptop', points: 160 },
    { id: 'bottle', label: '물병', code: 'WATER', zone: 'side', points: 130 },
    { id: 'pencil', label: '필통', code: 'PEN', zone: 'front', points: 130 }
  ];
  var hazards = [
    { id: 'weight', label: '무거운 아령', code: '!', hazard: true },
    { id: 'ink', label: '열린 잉크병', code: '!', hazard: true }
  ];
  var zones = [
    { id: 'main', label: '메인 수납', detail: '책과 큰 소지품' },
    { id: 'laptop', label: '노트북 수납', detail: '전자기기 보호' },
    { id: 'front', label: '앞 수납', detail: '작은 소지품' },
    { id: 'side', label: '옆 포켓', detail: '세워 두는 물병' }
  ];
  var rewardRank = { 'shipping-free': 1, 'discount-10': 2, 'discount-15': 3, 'discount-20': 4 };
  var keyDirections = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right'
  };
  var state = {
    phase: 'intro',
    score: 0,
    time: CATCH_SECONDS,
    lives: 3,
    caught: [],
    packItems: [],
    packed: new Set(),
    selectedItem: '',
    packFinishing: false,
    paused: false,
    directions: new Set(),
    objects: [],
    playerX: 50,
    playerY: 76,
    facing: 'up',
    footstepSide: 1,
    lastFootstep: 0,
    lastFrame: 0,
    invulnerableUntil: 0,
    spawnTimer: 0,
    clockTimer: 0,
    animationFrame: 0,
    toastTimer: 0,
    packCompletionTimer: 0,
    packEffectTimer: 0,
    musicTimer: 0,
    musicStep: 0,
    soundEnabled: readSoundPreference(),
    activeCoupons: [],
    couponLoadFailed: false,
    viewportLocked: false,
    lockedScrollY: 0
  };

  function setGameViewport(active) {
    var mobile = window.matchMedia('(max-width: 620px)').matches;
    if (active && mobile && !state.viewportLocked) {
      state.lockedScrollY = window.scrollY || window.pageYOffset || 0;
      document.body.style.setProperty('--game-scroll-offset', '-' + state.lockedScrollY + 'px');
      state.viewportLocked = true;
    }

    document.documentElement.classList.toggle('game-round-active', active);
    document.body.classList.toggle('game-round-active', active);

    if (!active && state.viewportLocked) {
      var restoreY = state.lockedScrollY;
      state.viewportLocked = false;
      document.body.style.removeProperty('--game-scroll-offset');
      window.requestAnimationFrame(function () { window.scrollTo(0, restoreY); });
    }
  }

  function announce(message) {
    announcer.textContent = '';
    window.setTimeout(function () { announcer.textContent = message; }, 20);
  }

  function showToast(message) {
    window.clearTimeout(state.toastTimer);
    gameToast.textContent = message;
    gameToast.classList.remove('is-visible');
    void gameToast.offsetWidth;
    gameToast.classList.add('is-visible');
    state.toastTimer = window.setTimeout(function () { gameToast.classList.remove('is-visible'); }, 900);
  }

  function readSoundPreference() {
    try { return localStorage.getItem(SOUND_STORAGE_KEY) !== 'off'; } catch (error) { return true; }
  }

  function saveSoundPreference() {
    try { localStorage.setItem(SOUND_STORAGE_KEY, state.soundEnabled ? 'on' : 'off'); } catch (error) {}
  }

  function updateSoundControl() {
    var available = Boolean(AudioContextType);
    soundButton.disabled = !available;
    soundButton.setAttribute('aria-pressed', String(available && state.soundEnabled));
    soundButton.setAttribute('aria-label', !available ? '이 브라우저에서는 배경음악을 지원하지 않습니다.' : (state.soundEnabled ? '배경음악 끄기' : '배경음악 켜기'));
    soundLabel.textContent = available && state.soundEnabled ? 'ON' : 'OFF';
  }

  function ensureAudio() {
    if (!AudioContextType) return false;
    if (!audioContext) {
      try {
        audioContext = new AudioContextType();
        musicBus = audioContext.createGain();
        musicBus.gain.value = .18;
        musicBus.connect(audioContext.destination);
      } catch (error) {
        audioContext = null;
        musicBus = null;
        state.soundEnabled = false;
        updateSoundControl();
        return false;
      }
    }
    return true;
  }

  function playTone(frequency, duration, type, volume, delay) {
    if (!state.soundEnabled || !audioContext || audioContext.state !== 'running') return;
    var startsAt = audioContext.currentTime + (delay || 0);
    var oscillator = audioContext.createOscillator();
    var envelope = audioContext.createGain();
    oscillator.type = type || 'square';
    oscillator.frequency.setValueAtTime(frequency, startsAt);
    envelope.gain.setValueAtTime(.0001, startsAt);
    envelope.gain.exponentialRampToValueAtTime(volume || .07, startsAt + .018);
    envelope.gain.exponentialRampToValueAtTime(.0001, startsAt + duration);
    oscillator.connect(envelope);
    envelope.connect(musicBus);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + duration + .025);
  }

  function playMusicStep() {
    if (!state.soundEnabled || !audioContext || audioContext.state !== 'running') return;
    var melody = [659.25, 783.99, 880, 783.99, 587.33, 659.25, 783.99, 659.25, 523.25, 659.25, 698.46, 659.25, 493.88, 587.33, 659.25, 587.33];
    var bass = [130.81, 146.83, 110, 123.47];
    var step = state.musicStep % melody.length;
    playTone(melody[step], .16, 'square', .055);
    if (step % 4 === 0) playTone(bass[Math.floor(step / 4)], .36, 'triangle', .085);
    if (step % 2 === 0) playTone(1046.5, .025, 'square', .018, .08);
    state.musicStep += 1;
  }

  function startMusic() {
    if (!state.soundEnabled || !ensureAudio()) return;
    audioContext.resume().then(function () {
      if (!state.soundEnabled || state.musicTimer) return;
      musicBus.gain.cancelScheduledValues(audioContext.currentTime);
      musicBus.gain.setTargetAtTime(.18, audioContext.currentTime, .035);
      playMusicStep();
      state.musicTimer = window.setInterval(playMusicStep, 230);
    }).catch(function () {});
  }

  function stopMusic() {
    window.clearInterval(state.musicTimer);
    state.musicTimer = 0;
    if (musicBus && audioContext) musicBus.gain.setTargetAtTime(.0001, audioContext.currentTime, .025);
  }

  function playEffect(kind) {
    if (!state.soundEnabled || !audioContext || audioContext.state !== 'running') return;
    if (kind === 'collect') {
      playTone(987.77, .1, 'square', .11);
      playTone(1318.51, .16, 'square', .09, .07);
    } else if (kind === 'hazard') {
      playTone(146.83, .24, 'sawtooth', .1);
    } else if (kind === 'pack') {
      playTone(783.99, .1, 'square', .09);
      playTone(1046.5, .18, 'square', .08, .08);
    }
  }

  function padScore(value) {
    return String(Math.max(0, Math.round(value))).padStart(4, '0');
  }

  function renderHud() {
    var phaseLabels = { intro: 'READY', catch: 'FIND', pack: 'PACK', result: 'CLEAR' };
    phaseOutput.textContent = phaseLabels[state.phase] || 'READY';
    scoreOutput.textContent = padScore(state.score);
    timeOutput.textContent = String(Math.max(0, state.time)).padStart(2, '0');
    livesOutput.textContent = '♥'.repeat(state.lives) + '♡'.repeat(Math.max(0, 3 - state.lives));
    livesOutput.setAttribute('aria-label', '남은 생명 ' + state.lives + '개');
  }

  function updateControllerState() {
    var active = state.phase === 'catch';
    moveButtons.forEach(function (button) {
      button.disabled = !active;
      button.classList.toggle('is-pressed', active && state.directions.has(button.dataset.gameMove));
    });
    pauseButton.disabled = !active;
    pauseButton.setAttribute('aria-pressed', String(active && state.paused));
    pauseButton.setAttribute('aria-label', state.paused ? '게임 계속하기' : '게임 잠시 멈춤');
    pauseButton.querySelector('span').textContent = state.paused ? '▶' : 'Ⅱ';
  }

  function showPanel(name) {
    panels.forEach(function (panel) { panel.hidden = panel.dataset.gamePanel !== name; });
    state.phase = name;
    consoleElement.dataset.phase = name;
    setGameViewport(name !== 'intro');
    renderHud();
    updateControllerState();
  }

  function renderPlayer() {
    player.style.left = state.playerX + '%';
    player.style.top = state.playerY + '%';
    playerShadow.style.left = state.playerX + '%';
    playerShadow.style.top = (state.playerY + 5.8) + '%';
    if (!reducedMotion) {
      catchStage.style.setProperty('--world-x', ((50 - state.playerX) * .07).toFixed(2) + '%');
      catchStage.style.setProperty('--world-y', ((56 - state.playerY) * .06).toFixed(2) + '%');
    }
  }

  function setPlayerDirection(dx, dy) {
    if (Math.abs(dx) > .1) {
      state.facing = dx < 0 ? 'left' : 'right';
      player.style.setProperty('--player-flip', dx < 0 ? '-1' : '1');
    } else if (Math.abs(dy) > .1) {
      state.facing = dy < 0 ? 'up' : 'down';
    }
    player.style.setProperty('--player-lean', (dx * 4).toFixed(1) + 'deg');
    player.dataset.facing = state.facing;
  }

  function createFootstep(now, dx, dy) {
    if (reducedMotion || now - state.lastFootstep < 155) return;
    state.lastFootstep = now;
    state.footstepSide *= -1;
    var step = document.createElement('span');
    step.className = 'footstep';
    step.style.left = (state.playerX + state.footstepSide * 1.4) + '%';
    step.style.top = (state.playerY + 5.6) + '%';
    step.style.setProperty('--step-angle', (Math.atan2(dy, dx) * 180 / Math.PI + 90).toFixed(1) + 'deg');
    catchLayer.append(step);
    window.setTimeout(function () { step.remove(); }, 950);
  }

  function clearRound() {
    window.clearInterval(state.spawnTimer);
    window.clearInterval(state.clockTimer);
    window.cancelAnimationFrame(state.animationFrame);
    window.clearTimeout(state.toastTimer);
    window.clearTimeout(state.packCompletionTimer);
    window.clearTimeout(state.packEffectTimer);
    state.spawnTimer = 0;
    state.clockTimer = 0;
    state.animationFrame = 0;
    state.toastTimer = 0;
    state.packCompletionTimer = 0;
    state.packEffectTimer = 0;
    state.lastFrame = 0;
    state.lastFootstep = 0;
    state.directions.clear();
    state.packFinishing = false;
    state.objects.forEach(function (object) { object.element.remove(); });
    state.objects = [];
    catchLayer.querySelectorAll('.footstep').forEach(function (step) { step.remove(); });
    document.querySelectorAll('.pack-transfer').forEach(function (transfer) { transfer.remove(); });
    root.querySelector('.packing-bag')?.classList.remove('is-receiving');
    catchStage.classList.remove('is-moving');
    player.classList.remove('is-walking');
    player.style.setProperty('--player-lean', '0deg');
    updateControllerState();
  }

  function setScore(amount) {
    state.score = Math.max(0, state.score + amount);
    scoreOutput.textContent = padScore(state.score);
  }

  function setPause(paused, message) {
    if (state.phase !== 'catch') return;
    state.paused = paused;
    state.directions.clear();
    player.classList.remove('is-walking');
    player.style.setProperty('--player-lean', '0deg');
    catchStage.classList.remove('is-moving');
    updateControllerState();
    if (message) announce(message);
    showToast(paused ? 'PAUSE' : 'GO!');
    if (paused) stopMusic();
    else startMusic();
  }

  function createCollectible(item) {
    var element = document.createElement('div');
    var sprite = document.createElement('span');
    element.className = 'collectible';
    element.dataset.kind = item.id;
    sprite.className = 'collectible__sprite';
    sprite.setAttribute('aria-hidden', 'true');
    element.dataset.label = item.label;
    element.append(sprite);
    catchLayer.append(element);

    var object = {
      item: item,
      element: element,
      x: 16 + Math.random() * 68,
      y: reducedMotion ? 25 + Math.random() * 48 : 12,
      speed: reducedMotion ? 0 : 7.5 + Math.random() * 4.5
    };
    element.style.left = object.x + '%';
    element.style.top = object.y + '%';
    state.objects.push(object);
  }

  function spawnItem() {
    if (state.phase !== 'catch' || state.paused || document.hidden || state.objects.length >= 7) return;
    var pool = Math.random() < .78 ? goodItems : hazards;
    createCollectible(pool[Math.floor(Math.random() * pool.length)]);
  }

  function removeObject(object, collected) {
    state.objects = state.objects.filter(function (entry) { return entry !== object; });
    if (collected) {
      object.element.classList.add('is-collected');
      window.setTimeout(function () { object.element.remove(); }, reducedMotion ? 0 : 260);
    } else {
      object.element.remove();
    }
  }

  function resolveCollision(object, now) {
    if (object.item.hazard) {
      if (now < state.invulnerableUntil) return;
      state.invulnerableUntil = now + 1050;
      state.lives = Math.max(0, state.lives - 1);
      setScore(-120);
      player.classList.remove('is-hit');
      void player.offsetWidth;
      player.classList.add('is-hit');
      showToast('OUCH!  -120');
      playEffect('hazard');
      announce(object.item.label + '을 피해 가지 못했습니다. 생명이 하나 줄었습니다.');
      removeObject(object, true);
      renderHud();
      if (state.lives <= 0) finishCatch();
      return;
    }

    state.caught.push(object.item);
    setScore(object.item.points);
    showToast(object.item.label + '  +' + object.item.points);
    playEffect('collect');
    announce(object.item.label + '을 모았습니다. ' + object.item.points + '점 추가.');
    removeObject(object, true);
  }

  function updateWorld(now) {
    if (state.phase !== 'catch') return;
    var delta = state.lastFrame ? Math.min(.035, (now - state.lastFrame) / 1000) : 0;
    state.lastFrame = now;

    if (!state.paused && !document.hidden) {
      var dx = (state.directions.has('right') ? 1 : 0) - (state.directions.has('left') ? 1 : 0);
      var dy = (state.directions.has('down') ? 1 : 0) - (state.directions.has('up') ? 1 : 0);
      if (dx || dy) {
        var length = Math.sqrt(dx * dx + dy * dy) || 1;
        var moveX = dx / length;
        var moveY = dy / length;
        state.playerX = Math.max(10, Math.min(90, state.playerX + moveX * 39 * delta));
        state.playerY = Math.max(21, Math.min(88, state.playerY + moveY * 39 * delta));
        setPlayerDirection(moveX, moveY);
        createFootstep(now, moveX, moveY);
        player.classList.add('is-walking');
        catchStage.classList.add('is-moving');
        renderPlayer();
      } else {
        player.classList.remove('is-walking');
        catchStage.classList.remove('is-moving');
        player.style.setProperty('--player-lean', '0deg');
      }

      state.objects.slice().forEach(function (object) {
        object.y += object.speed * delta;
        object.element.style.top = object.y + '%';
        if (Math.abs(object.x - state.playerX) < 8 && Math.abs(object.y - state.playerY) < 7.5) {
          resolveCollision(object, now);
        } else if (object.y > 97) {
          removeObject(object, false);
        }
      });
    }

    state.animationFrame = window.requestAnimationFrame(updateWorld);
  }

  function runClock(seconds, onComplete) {
    state.time = seconds;
    renderHud();
    window.clearInterval(state.clockTimer);
    state.clockTimer = window.setInterval(function () {
      if (document.hidden || state.paused) return;
      state.time -= 1;
      renderHud();
      if (state.time <= 0) {
        window.clearInterval(state.clockTimer);
        state.clockTimer = 0;
        onComplete();
      }
    }, 1000);
  }

  function startCatch() {
    clearRound();
    startMusic();
    catchLayer.replaceChildren();
    state.score = 0;
    state.lives = 3;
    state.caught = [];
    state.packItems = [];
    state.packed = new Set();
    state.selectedItem = '';
    state.paused = false;
    state.playerX = 50;
    state.playerY = 76;
    state.facing = 'up';
    state.footstepSide = 1;
    state.invulnerableUntil = 0;
    player.style.setProperty('--player-flip', '1');
    player.style.setProperty('--player-lean', '0deg');
    renderPlayer();
    player.classList.remove('is-hit', 'is-walking');
    showPanel('catch');
    announce('1단계 시작. 상하좌우로 움직여 필요한 물건을 모으고 위험한 물건은 피하세요.');
    showToast('QUEST START!');
    createCollectible(goodItems[0]);
    createCollectible(goodItems[2]);
    state.spawnTimer = window.setInterval(spawnItem, reducedMotion ? 1300 : 680);
    runClock(CATCH_SECONDS, finishCatch);
    state.animationFrame = window.requestAnimationFrame(updateWorld);
  }

  function finishCatch() {
    if (state.phase !== 'catch') return;
    clearRound();
    var uniqueIds = Array.from(new Set(state.caught.map(function (item) { return item.id; })));
    goodItems.forEach(function (item) {
      if (uniqueIds.length < 3 && !uniqueIds.includes(item.id)) uniqueIds.push(item.id);
    });
    state.packItems = uniqueIds.slice(0, 4).map(function (id) {
      return goodItems.find(function (item) { return item.id === id; });
    });
    state.packed = new Set();
    state.selectedItem = '';
    renderPackingBoard();
    showPanel('pack');
    announce('학교에 도착했습니다. 모은 물건을 고른 뒤 알맞은 수납칸을 눌러 주세요.');
    runClock(PACK_SECONDS, finishGame);
  }

  function renderPackingBoard() {
    packingItems.replaceChildren();
    state.packItems.forEach(function (item) {
      var button = document.createElement('button');
      var name = document.createElement('strong');
      var hint = document.createElement('span');
      button.type = 'button';
      button.dataset.packItem = item.id;
      button.dataset.kind = item.id;
      button.setAttribute('aria-pressed', String(state.selectedItem === item.id));
      button.disabled = state.packed.has(item.id);
      name.textContent = item.label;
      hint.textContent = state.packed.has(item.id) ? '정리 완료 ✓' : item.code;
      button.append(name, hint);
      button.addEventListener('click', function () {
        if (button.disabled || state.phase !== 'pack') return;
        state.selectedItem = item.id;
        renderPackingBoard();
        announce(item.label + '을 선택했습니다. 알맞은 수납칸을 고르세요.');
      });
      packingItems.append(button);
    });

    packingZones.replaceChildren();
    zones.forEach(function (zone) {
      var button = document.createElement('button');
      var name = document.createElement('strong');
      var detail = document.createElement('span');
      button.type = 'button';
      button.dataset.packZone = zone.id;
      button.disabled = state.packFinishing;
      name.textContent = zone.label;
      detail.textContent = zone.detail;
      button.append(name, detail);
      button.addEventListener('click', function () { placeSelectedItem(zone, button); });
      packingZones.append(button);
    });
  }

  function animatePackedItem(item, zoneButton) {
    var bag = root.querySelector('.packing-bag');
    if (!bag) return 0;

    bag.classList.remove('is-receiving');
    void bag.offsetWidth;
    bag.classList.add('is-receiving');
    window.clearTimeout(state.packEffectTimer);
    state.packEffectTimer = window.setTimeout(function () {
      bag.classList.remove('is-receiving');
      state.packEffectTimer = 0;
    }, PACK_TRANSFER_MS);
    if (reducedMotion) return 0;

    var itemButton = packingItems.querySelector('[data-pack-item="' + item.id + '"]');
    var itemRect = itemButton?.getBoundingClientRect();
    var itemIsVisible = itemRect && itemRect.bottom > 0 && itemRect.top < window.innerHeight;
    var sourceRect = (itemIsVisible ? itemButton : zoneButton)?.getBoundingClientRect();
    if (!sourceRect) return 0;

    var bagRect = bag.getBoundingClientRect();
    var transfer = document.createElement('span');
    var sprite = document.createElement('span');
    transfer.className = 'collectible pack-transfer';
    transfer.dataset.kind = item.id;
    transfer.setAttribute('aria-hidden', 'true');
    sprite.className = 'collectible__sprite';
    transfer.style.setProperty('--pack-start-x', (sourceRect.left + sourceRect.width / 2) + 'px');
    transfer.style.setProperty('--pack-start-y', (sourceRect.top + sourceRect.height / 2) + 'px');
    transfer.style.setProperty('--pack-end-x', (bagRect.left + bagRect.width * .5) + 'px');
    transfer.style.setProperty('--pack-end-y', (bagRect.top + bagRect.height * .52) + 'px');
    transfer.append(sprite);
    document.body.append(transfer);
    window.setTimeout(function () { transfer.remove(); }, PACK_TRANSFER_MS);
    return PACK_TRANSFER_MS;
  }

  function placeSelectedItem(zone, zoneButton) {
    if (state.phase !== 'pack' || state.packFinishing) return;
    if (!state.selectedItem) {
      announce('먼저 아래에서 정리할 물건을 선택해 주세요.');
      return;
    }
    var item = state.packItems.find(function (entry) { return entry.id === state.selectedItem; });
    if (!item || state.packed.has(item.id)) return;
    if (item.zone === zone.id) {
      var transferDuration = animatePackedItem(item, zoneButton);
      state.packed.add(item.id);
      state.selectedItem = '';
      state.packFinishing = state.packed.size === state.packItems.length;
      setScore(150);
      playEffect('pack');
      announce(item.label + '을 ' + zone.label + '에 정리했습니다. 150점 추가.');
      renderPackingBoard();
      if (state.packFinishing) {
        window.clearInterval(state.clockTimer);
        state.clockTimer = 0;
        if (!transferDuration) {
          finishGame();
          return;
        }
        announce(item.label + '이 가방에 들어갔습니다. 마지막 정리를 확인하고 있습니다.');
        state.packCompletionTimer = window.setTimeout(function () {
          state.packCompletionTimer = 0;
          finishGame();
        }, transferDuration);
      }
      return;
    }
    setScore(-40);
    announce(item.label + '은 ' + zone.label + '이 아닙니다. 다른 수납칸을 골라 보세요.');
  }

  function readStoredReward() {
    try {
      var stored = JSON.parse(localStorage.getItem(REWARD_STORAGE_KEY));
      return stored && typeof stored.couponId === 'string' ? stored : null;
    } catch (error) {
      return null;
    }
  }

  function saveReward(coupon, token) {
    try {
      localStorage.setItem(REWARD_STORAGE_KEY, JSON.stringify({ couponId: coupon.id, label: coupon.label, token: token || '', earnedAt: new Date().toISOString(), expiresAt: coupon.expiresAt || null }));
      return true;
    } catch (error) {
      return false;
    }
  }

  function removeStoredReward() {
    try { localStorage.removeItem(REWARD_STORAGE_KEY); } catch (error) {}
  }

  async function loadCoupons() {
    var controller = new AbortController();
    var timeout = window.setTimeout(function () { controller.abort(); }, 7000);
    try {
      var response = await fetch('/api/promotions', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('coupon load failed');
      var payload = await response.json();
      state.activeCoupons = Array.isArray(payload.coupons) ? payload.coupons : [];
      state.couponLoadFailed = false;
    } catch (error) {
      state.activeCoupons = [];
      state.couponLoadFailed = true;
    } finally {
      window.clearTimeout(timeout);
    }
    renderWallet();
    return state.activeCoupons;
  }

  function renderWallet() {
    var stored = readStoredReward();
    if (state.couponLoadFailed) {
      walletOutput.textContent = stored ? stored.label + ' 쿠폰이 저장되어 있습니다. 활성 여부는 주문서에서 다시 확인합니다.' : '쿠폰 정보를 불러오지 못했습니다. 게임은 계속할 수 있습니다.';
      return;
    }
    var active = stored && state.activeCoupons.find(function (coupon) { return coupon.id === stored.couponId; });
    if (active) {
      walletOutput.textContent = active.label + ' 쿠폰이 저장되어 있습니다. 주문 금액 조건을 충족하면 주문서에서 자동 선택됩니다.';
      return;
    }
    if (stored) removeStoredReward();
    walletOutput.textContent = state.activeCoupons.length ? '아직 획득한 쿠폰이 없습니다. 게임을 완주해 보세요.' : '현재 관리자가 활성화한 쿠폰이 없습니다. 이벤트가 열리면 다시 도전해 주세요.';
  }

  function rewardCandidates(score) {
    if (score >= 2100) return ['discount-20', 'discount-15', 'discount-10', 'shipping-free'];
    if (score >= 1600) return ['discount-15', 'discount-10', 'shipping-free'];
    if (score >= 1000) return ['discount-10', 'shipping-free'];
    return ['shipping-free'];
  }

  function chooseReward() {
    var activeById = new Map(state.activeCoupons.map(function (coupon) { return [coupon.id, coupon]; }));
    var earned = rewardCandidates(state.score).map(function (id) { return activeById.get(id); }).find(Boolean) || null;
    var stored = readStoredReward();
    var current = stored ? activeById.get(stored.couponId) : null;
    if (current && (!earned || rewardRank[current.id] > rewardRank[earned.id])) return { coupon: current, retained: true };
    return earned ? { coupon: earned, retained: false } : { coupon: null, retained: false };
  }

  async function finishGame() {
    if (state.phase === 'result') return;
    clearRound();
    state.paused = false;
    showPanel('result');
    finalScore.textContent = padScore(state.score);
    rewardOutput.replaceChildren();
    var strong = document.createElement('strong');
    var copy = document.createElement('p');
    strong.textContent = '쿠폰을 확인하고 있습니다.';
    copy.textContent = '관리자가 활성화한 혜택과 점수를 비교합니다.';
    rewardOutput.append(strong, copy);

    if (state.couponLoadFailed) await loadCoupons();
    var result = chooseReward();
    if (result.coupon) {
      var issued = null;
      try {
        var issuedResponse = await fetch('/api/coupons/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'game', score: state.score }) });
        if (issuedResponse.ok) issued = await issuedResponse.json();
      } catch (error) {}
      if (issued?.coupon) result.coupon = issued.coupon;
      var saved = Boolean(issued?.token) && saveReward(result.coupon, issued.token);
      if (!result.retained) window.himawariTrack?.('Game coupon earned', { couponId: result.coupon.id, score: state.score, saved: Boolean(saved) });
      strong.textContent = result.retained ? result.coupon.label + ' 쿠폰 유지' : result.coupon.label + ' 쿠폰 획득!';
      copy.textContent = saved
        ? (result.retained ? '더 좋은 기존 쿠폰을 그대로 보관했습니다.' : '이 브라우저에 저장했습니다. 주문 조건을 충족하면 주문서에서 자동 선택됩니다.')
        : '쿠폰 인증을 완료하지 못했습니다. 네트워크를 확인하고 다시 도전해 주세요.';
    } else if (state.couponLoadFailed) {
      strong.textContent = '쿠폰 정보를 확인하지 못했습니다.';
      copy.textContent = '네트워크 연결을 확인한 뒤 다시 도전해 주세요.';
    } else {
      strong.textContent = '쿠폰 이벤트 준비 중';
      copy.textContent = '현재 관리자가 활성화한 쿠폰이 없습니다. 게임은 언제든 다시 할 수 있습니다.';
    }
    announce(strong.textContent + ' ' + copy.textContent);
    renderWallet();
    root.querySelector('#result-title')?.focus();
  }

  function pressDirection(direction, button) {
    if (state.phase !== 'catch' || state.paused) return;
    state.directions.add(direction);
    if (button) button.classList.add('is-pressed');
  }

  function releaseDirection(direction, button) {
    state.directions.delete(direction);
    if (button) button.classList.remove('is-pressed');
  }

  function exitGame() {
    if (state.phase === 'intro') return;
    clearRound();
    stopMusic();
    state.paused = false;
    showPanel('intro');
    announce('게임을 닫았습니다. 준비가 되면 다시 시작하세요.');
    root.querySelector('[data-game-start]')?.focus();
  }

  root.querySelector('[data-game-start]').addEventListener('click', startCatch);
  root.querySelector('[data-game-restart]').addEventListener('click', startCatch);
  exitButton.addEventListener('click', exitGame);
  soundButton.addEventListener('click', function () {
    if (!AudioContextType) return;
    state.soundEnabled = !state.soundEnabled;
    saveSoundPreference();
    updateSoundControl();
    if (state.soundEnabled) startMusic();
    else stopMusic();
    announce(state.soundEnabled ? '배경음악을 켰습니다.' : '배경음악을 껐습니다.');
  });
  moveButtons.forEach(function (button) {
    var direction = button.dataset.gameMove;
    button.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      try {
        button.setPointerCapture?.(event.pointerId);
      } catch (error) {
        // Synthetic and legacy touch events may not own an active pointer.
      }
      pressDirection(direction, button);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (eventName) {
      button.addEventListener(eventName, function () { releaseDirection(direction, button); });
    });
  });
  root.querySelector('.d-pad').addEventListener('touchmove', function (event) {
    event.preventDefault();
  }, { passive: false });
  pauseButton.addEventListener('click', function () {
    setPause(!state.paused, state.paused ? '게임을 계속합니다.' : '게임을 잠시 멈췄습니다.');
  });
  document.addEventListener('keydown', function (event) {
    if (state.phase !== 'catch' || event.isComposing) return;
    var key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    var direction = keyDirections[key];
    if (direction) {
      event.preventDefault();
      pressDirection(direction);
      updateControllerState();
    }
    if (event.key === ' ' && event.target === document.body) {
      event.preventDefault();
      setPause(!state.paused, state.paused ? '게임을 계속합니다.' : '게임을 잠시 멈췄습니다.');
    }
    if (event.key === 'Escape') exitGame();
  });
  document.addEventListener('keyup', function (event) {
    var key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    var direction = keyDirections[key];
    if (!direction) return;
    releaseDirection(direction);
    updateControllerState();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state.phase === 'catch' && !state.paused) setPause(true, '화면을 벗어나 게임이 자동으로 멈췄습니다.');
  });
  window.addEventListener('blur', function () {
    if (state.phase === 'catch' && !state.paused) setPause(true, '게임이 자동으로 멈췄습니다. 계속하려면 가운데 재생 버튼을 누르세요.');
  });
  window.addEventListener('pagehide', stopMusic);

  showPanel('intro');
  renderPlayer();
  updateSoundControl();
  loadCoupons();
})();
