(function () {
  'use strict';

  var root = document.querySelector('[data-game-root]');
  if (!root) return;

  var REWARD_STORAGE_KEY = 'himawari-game-coupon-v1';
  var CATCH_SECONDS = 24;
  var PACK_SECONDS = 18;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var panels = Array.from(root.querySelectorAll('[data-game-panel]'));
  var phaseOutput = root.querySelector('[data-game-phase]');
  var scoreOutput = root.querySelector('[data-game-score]');
  var timeOutput = root.querySelector('[data-game-time]');
  var announcer = root.querySelector('[data-game-announcer]');
  var catchStage = root.querySelector('[data-catch-stage]');
  var catchLayer = root.querySelector('[data-catch-layer]');
  var catchBag = root.querySelector('[data-catch-bag]');
  var pauseButton = root.querySelector('[data-game-pause]');
  var packingItems = root.querySelector('[data-packing-items]');
  var packingZones = root.querySelector('[data-packing-zones]');
  var finalScore = root.querySelector('[data-final-score]');
  var rewardOutput = root.querySelector('[data-game-reward]');
  var walletOutput = root.querySelector('[data-game-wallet]');

  var goodItems = [
    { id: 'book', label: '책', tile: '책', code: 'BOOK', zone: 'main' },
    { id: 'laptop', label: '노트북', tile: 'PC', code: 'LAPTOP', zone: 'laptop' },
    { id: 'bottle', label: '물병', tile: '물', code: 'BOTTLE', zone: 'side' },
    { id: 'pencil', label: '필통', tile: '필통', code: 'PENCIL', zone: 'front' }
  ];
  var hazards = [
    { id: 'weight', label: '무거운 아령', tile: '아령', code: 'AVOID', hazard: true },
    { id: 'ink', label: '열린 잉크병', tile: '잉크', code: 'AVOID', hazard: true }
  ];
  var zones = [
    { id: 'main', label: '메인 수납', detail: '책과 큰 소지품' },
    { id: 'laptop', label: '노트북 수납', detail: '전자기기 보호' },
    { id: 'front', label: '앞 수납', detail: '작은 소지품' },
    { id: 'side', label: '옆 포켓', detail: '세워 두는 물병' }
  ];
  var rewardRank = { 'shipping-free': 1, 'discount-10': 2, 'discount-15': 3, 'discount-20': 4 };
  var state = {
    phase: 'intro',
    score: 0,
    time: CATCH_SECONDS,
    lane: 2,
    caught: [],
    packItems: [],
    packed: new Set(),
    selectedItem: '',
    paused: false,
    spawnTimer: 0,
    clockTimer: 0,
    activeCoupons: [],
    couponLoadFailed: false
  };

  function announce(message) {
    announcer.textContent = '';
    window.setTimeout(function () { announcer.textContent = message; }, 20);
  }

  function padScore(value) {
    return String(Math.max(0, Math.round(value))).padStart(4, '0');
  }

  function renderHud() {
    var phaseLabels = { intro: 'READY', catch: '01 / CATCH', pack: '02 / PACK', result: 'COMPLETE' };
    phaseOutput.textContent = phaseLabels[state.phase] || 'READY';
    scoreOutput.textContent = padScore(state.score);
    timeOutput.textContent = state.phase === 'intro' ? String(CATCH_SECONDS) : String(Math.max(0, state.time)).padStart(2, '0');
  }

  function showPanel(name) {
    panels.forEach(function (panel) { panel.hidden = panel.dataset.gamePanel !== name; });
    state.phase = name;
    renderHud();
  }

  function updateBagPosition() {
    catchBag.style.left = ((state.lane + .5) * 20) + '%';
    var laneNames = ['맨 왼쪽', '왼쪽 두 번째', '가운데', '오른쪽 두 번째', '맨 오른쪽'];
    catchBag.alt = '현재 받기 위치: ' + laneNames[state.lane] + ' 칸';
  }

  function moveBag(amount) {
    if (state.phase !== 'catch' || state.paused) return;
    state.lane = Math.max(0, Math.min(4, state.lane + amount));
    updateBagPosition();
  }

  function clearRoundTimers() {
    window.clearInterval(state.spawnTimer);
    window.clearInterval(state.clockTimer);
    state.spawnTimer = 0;
    state.clockTimer = 0;
  }

  function setScore(amount) {
    state.score = Math.max(0, state.score + amount);
    scoreOutput.textContent = padScore(state.score);
  }

  function setPause(paused, message) {
    if (state.phase !== 'catch') return;
    state.paused = paused;
    catchStage.classList.toggle('is-paused', paused);
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.textContent = paused ? '계속 하기' : '잠시 멈춤';
    if (message) announce(message);
  }

  function resolveFallingItem(element, item, lane) {
    if (!element.isConnected || state.phase !== 'catch') return;
    element.remove();
    if (lane !== state.lane) return;
    if (item.hazard) {
      setScore(-80);
      announce(item.label + '을 받아 80점이 줄었습니다.');
      return;
    }
    state.caught.push(item);
    setScore(100);
    announce(item.label + '을 받았습니다. 100점 추가.');
  }

  function resolveReducedItem(element, item, lane) {
    if (!element.isConnected || state.phase !== 'catch') return;
    if (state.paused || document.hidden) {
      window.setTimeout(function () { resolveReducedItem(element, item, lane); }, 200);
      return;
    }
    resolveFallingItem(element, item, lane);
  }

  function spawnItem() {
    if (state.phase !== 'catch' || state.paused || document.hidden) return;
    var pool = Math.random() < .76 ? goodItems : hazards;
    var item = pool[Math.floor(Math.random() * pool.length)];
    var lane = Math.floor(Math.random() * 5);
    var element = document.createElement('div');
    var strong = document.createElement('strong');
    var detail = document.createElement('span');
    element.className = 'falling-item' + (item.hazard ? ' falling-item--hazard' : '') + (reducedMotion ? ' is-reduced' : '');
    element.style.left = ((lane + .5) * 20) + '%';
    element.style.setProperty('--fall-duration', Math.max(1.55, 2.35 - (CATCH_SECONDS - state.time) * .018) + 's');
    strong.textContent = item.tile;
    detail.textContent = item.code;
    element.append(strong, detail);
    catchLayer.append(element);
    var laneNames = ['맨 왼쪽', '왼쪽 두 번째', '가운데', '오른쪽 두 번째', '맨 오른쪽'];
    announce(item.label + ', ' + laneNames[lane] + ' 칸.');
    if (reducedMotion) {
      window.setTimeout(function () { resolveReducedItem(element, item, lane); }, 1350);
    } else {
      element.addEventListener('animationend', function () { resolveFallingItem(element, item, lane); }, { once: true });
    }
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
    clearRoundTimers();
    catchLayer.replaceChildren();
    state.score = 0;
    state.lane = 2;
    state.caught = [];
    state.packItems = [];
    state.packed = new Set();
    state.selectedItem = '';
    state.paused = false;
    updateBagPosition();
    pauseButton.setAttribute('aria-pressed', 'false');
    pauseButton.textContent = '잠시 멈춤';
    catchStage.classList.remove('is-paused');
    showPanel('catch');
    announce('1단계 시작. 필요한 물건을 받고 주의 물건을 피하세요.');
    spawnItem();
    state.spawnTimer = window.setInterval(spawnItem, reducedMotion ? 1650 : 850);
    runClock(CATCH_SECONDS, finishCatch);
  }

  function finishCatch() {
    clearRoundTimers();
    catchLayer.replaceChildren();
    var uniqueIds = Array.from(new Set(state.caught.map(function (item) { return item.id; })));
    goodItems.forEach(function (item) {
      if (uniqueIds.length < 2 && !uniqueIds.includes(item.id)) uniqueIds.push(item.id);
    });
    state.packItems = uniqueIds.slice(0, 4).map(function (id) { return goodItems.find(function (item) { return item.id === id; }); });
    state.packed = new Set();
    state.selectedItem = '';
    renderPackingBoard();
    showPanel('pack');
    announce('2단계 시작. 물건을 선택한 뒤 알맞은 수납칸을 누르세요.');
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
      button.setAttribute('aria-pressed', String(state.selectedItem === item.id));
      button.disabled = state.packed.has(item.id);
      name.textContent = item.label;
      hint.textContent = state.packed.has(item.id) ? '정리 완료' : item.code;
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
      name.textContent = zone.label;
      detail.textContent = zone.detail;
      button.append(name, detail);
      button.addEventListener('click', function () { placeSelectedItem(zone); });
      packingZones.append(button);
    });
  }

  function placeSelectedItem(zone) {
    if (state.phase !== 'pack') return;
    if (!state.selectedItem) {
      announce('먼저 왼쪽에서 정리할 물건을 선택해 주세요.');
      return;
    }
    var item = state.packItems.find(function (entry) { return entry.id === state.selectedItem; });
    if (!item || state.packed.has(item.id)) return;
    if (item.zone === zone.id) {
      state.packed.add(item.id);
      state.selectedItem = '';
      setScore(120);
      announce(item.label + '을 ' + zone.label + '에 정리했습니다. 120점 추가.');
      renderPackingBoard();
      if (state.packed.size === state.packItems.length) finishGame();
      return;
    }
    setScore(-30);
    announce(item.label + '은 ' + zone.label + '이 아닙니다. 다시 골라 보세요.');
  }

  function readStoredReward() {
    try {
      var stored = JSON.parse(localStorage.getItem(REWARD_STORAGE_KEY));
      return stored && typeof stored.couponId === 'string' ? stored : null;
    } catch (error) {
      return null;
    }
  }

  function saveReward(coupon) {
    try {
      localStorage.setItem(REWARD_STORAGE_KEY, JSON.stringify({
        couponId: coupon.id,
        label: coupon.label,
        earnedAt: new Date().toISOString(),
        expiresAt: coupon.expiresAt || null
      }));
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
      walletOutput.textContent = stored ? stored.label + ' 쿠폰이 저장되어 있습니다. 현재 활성 여부는 주문서에서 다시 확인합니다.' : '쿠폰 정보를 불러오지 못했습니다. 게임은 계속할 수 있습니다.';
      return;
    }
    var active = stored && state.activeCoupons.find(function (coupon) { return coupon.id === stored.couponId; });
    if (active) {
      walletOutput.textContent = active.label + ' 쿠폰이 저장되어 있습니다. 주문 금액 조건을 충족하면 주문서에서 자동 선택됩니다.';
      return;
    }
    if (stored) removeStoredReward();
    walletOutput.textContent = state.activeCoupons.length ? '아직 획득한 쿠폰이 없습니다. 게임을 완주해 보세요.' : '현재 관리자가 활성화한 쿠폰이 없습니다. 게임 결과는 기록되며 이벤트가 열리면 다시 도전할 수 있습니다.';
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
    clearRoundTimers();
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
      var saved = saveReward(result.coupon);
      strong.textContent = result.retained ? result.coupon.label + ' 쿠폰 유지' : result.coupon.label + ' 쿠폰 획득';
      copy.textContent = saved
        ? (result.retained ? '새 점수보다 더 좋은 기존 쿠폰을 그대로 보관했습니다.' : '이 브라우저에 저장했습니다. 주문 금액 조건을 충족하면 주문서에서 자동 선택됩니다.')
        : '쿠폰을 획득했지만 브라우저 저장이 제한되어 주문서 자동 선택은 지원되지 않습니다.';
      announce(strong.textContent + '. ' + copy.textContent);
    } else if (state.couponLoadFailed) {
      strong.textContent = '쿠폰 정보를 확인하지 못했습니다.';
      copy.textContent = '네트워크 연결을 확인한 뒤 다시 도전해 주세요. 점수는 이 화면에서 확인할 수 있습니다.';
      announce(strong.textContent);
    } else {
      strong.textContent = '쿠폰 이벤트 준비 중';
      copy.textContent = '현재 관리자가 활성화한 쿠폰이 없습니다. 게임은 언제든 다시 도전할 수 있습니다.';
      announce(strong.textContent);
    }
    renderWallet();
    root.querySelector('#result-title')?.focus();
  }

  root.querySelector('[data-game-start]').addEventListener('click', startCatch);
  root.querySelector('[data-game-restart]').addEventListener('click', startCatch);
  root.querySelector('[data-game-left]').addEventListener('click', function () { moveBag(-1); });
  root.querySelector('[data-game-right]').addEventListener('click', function () { moveBag(1); });
  pauseButton.addEventListener('click', function () { setPause(!state.paused, state.paused ? '게임을 계속합니다.' : '게임을 잠시 멈췄습니다.'); });
  document.addEventListener('keydown', function (event) {
    if (state.phase !== 'catch' || event.isComposing) return;
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') { event.preventDefault(); moveBag(-1); }
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') { event.preventDefault(); moveBag(1); }
    if (event.key === ' ' && event.target === document.body) { event.preventDefault(); setPause(!state.paused, state.paused ? '게임을 계속합니다.' : '게임을 잠시 멈췄습니다.'); }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state.phase === 'catch' && !state.paused) setPause(true, '화면을 벗어나 게임이 자동으로 멈췄습니다.');
  });

  renderHud();
  updateBagPosition();
  loadCoupons();
})();
