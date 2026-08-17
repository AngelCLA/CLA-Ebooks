(() => {
  'use strict';
  const cfg = window.BOOK_CONFIG;
  if (!cfg || !Array.isArray(cfg.pages) || !cfg.pages.length) return;

  const params = new URLSearchParams(window.location.search);
  const embedded = params.get('embed') === '1' || window.self !== window.top;
  const hideControls = params.get('controls') === '0';
  const hideBackground = params.get('background') === '0';
  const initialZoomParam = Number.parseFloat(params.get('zoom') || '');
  document.documentElement.classList.toggle('embed-mode', embedded);
  document.documentElement.classList.toggle('controls-hidden', hideControls);
  document.documentElement.classList.toggle('background-hidden', hideBackground);

  function postToParent(type, payload = {}) {
    if (!embedded || window.parent === window) return;
    try { window.parent.postMessage({ source: 'ebook-reader', type, ...payload }, '*'); } catch (_) {}
  }

  const $ = id => document.getElementById(id);
  const els = {
    loading:$('loading'), loadingText:$('loading-text'), title:$('book-title'), label:$('page-label'),
    left:$('left-page'), right:$('right-page'), flip:$('flip-page'), shell:$('book-shell'), book:$('book'),
    slider:$('page-slider'), counter:$('counter'), sound:$('turn-sound'), soundBtn:$('sound-btn'), zoomLabel:$('zoom-label')
  };
  const leftImg = els.left.querySelector('img');
  const rightImg = els.right.querySelector('img');
  const flipFront = els.flip.querySelector('.flip-front img');
  const flipBack = els.flip.querySelector('.flip-back img');

  let stateIndex = 0;
  let turning = false;
  let zoom = Number.isFinite(initialZoomParam) ? Math.max(.65, Math.min(2.2, initialZoomParam)) : 1;
  let soundEnabled = params.get('sound') === '0' ? false : cfg.settings?.sound !== false;
  let pointer = null;
  const cache = new Map();
  const maxCache = Math.max(6, (cfg.settings?.preloadRadius || 3) * 2 + 4);
  const duration = cfg.settings?.turnDuration || 720;
  document.documentElement.style.setProperty('--turn-ms', `${duration}ms`);
  document.documentElement.style.setProperty('--page-ratio', String(cfg.averagePageRatio || .707));

  const isMobile = () => matchMedia('(max-width:800px)').matches;
  const src = i => cfg.pages[i]?.src || '';

  function buildStates() {
    if (isMobile()) return cfg.pages.map((_, i) => [i]);
    if (cfg.pages.length === 1) return [[0]];
    const states = [[0]];
    let i = 1;
    while (i < cfg.pages.length - 1) {
      states.push(i + 1 < cfg.pages.length ? [i, i + 1] : [i]);
      i += 2;
    }
    if (i < cfg.pages.length) states.push([i]);
    return states;
  }

  let states = buildStates();
  const currentState = () => states[stateIndex] || states[0];

  function touchCache(i, image) {
    if (cache.has(i)) cache.delete(i);
    cache.set(i, image);
    while (cache.size > maxCache) cache.delete(cache.keys().next().value);
  }

  function loadImage(i) {
    if (i < 0 || i >= cfg.pages.length) return Promise.resolve(null);
    const cached = cache.get(i);
    if (cached?.complete) { touchCache(i, cached); return Promise.resolve(cached); }
    return new Promise((resolve, reject) => {
      const img = cached || new Image();
      img.decoding = 'async';
      img.onload = () => { touchCache(i, img); resolve(img); };
      img.onerror = reject;
      if (!cached) img.src = src(i);
      cache.set(i, img);
    });
  }

  function assign(imgEl, i) {
    if (i == null || i < 0 || i >= cfg.pages.length) {
      imgEl.removeAttribute('src');
      imgEl.style.visibility = 'hidden';
      return;
    }
    imgEl.style.visibility = 'visible';
    imgEl.src = src(i);
    imgEl.alt = `Página ${i + 1}`;
  }

  function pageStateType() {
    if (isMobile()) return 'single';
    if (stateIndex === 0) return 'cover';
    if (stateIndex === states.length - 1 && currentState().length === 1) return 'back';
    return 'spread';
  }

  function applyBookMode() {
    const type = pageStateType();
    els.book.classList.toggle('cover-mode', type === 'cover');
    els.book.classList.toggle('back-cover-mode', type === 'back');
    els.shell.classList.toggle('closed-front', type === 'cover');
    els.shell.classList.toggle('closed-back', type === 'back');
  }

  function renderStatic() {
    stateIndex = Math.max(0, Math.min(states.length - 1, stateIndex));
    const state = currentState();
    const type = pageStateType();
    els.left.classList.remove('turn-source');
    els.right.classList.remove('turn-source');

    if (isMobile()) {
      assign(rightImg, state[0]);
      assign(leftImg, null);
    } else if (type === 'cover') {
      assign(leftImg, null);
      assign(rightImg, state[0]);
    } else if (type === 'back') {
      assign(leftImg, state[0]);
      assign(rightImg, null);
    } else {
      assign(leftImg, state[0]);
      assign(rightImg, state[1]);
    }
    applyBookMode();
    updateUI();
    preloadAround();
    postToParent('ebook-pagechange', {
      stateIndex,
      pages: currentState().map(i => i + 1),
      pageCount: cfg.pages.length,
      label: els.label?.textContent || ''
    });
  }

  function updateUI() {
    const state = currentState();
    const first = state[0] + 1;
    const last = state[state.length - 1] + 1;
    els.slider.max = String(cfg.pages.length);
    els.slider.value = String(first);

    if (!isMobile() && stateIndex === 0) {
      els.label.textContent = 'Portada';
      els.counter.textContent = `Página 1 de ${cfg.pages.length}`;
    } else if (!isMobile() && stateIndex === states.length - 1 && state.length === 1) {
      els.label.textContent = 'Contraportada';
      els.counter.textContent = `Página ${first} de ${cfg.pages.length}`;
    } else if (state.length === 1) {
      els.label.textContent = `Página ${first}`;
      els.counter.textContent = `Página ${first} de ${cfg.pages.length}`;
    } else {
      els.label.textContent = `Páginas ${first}–${last}`;
      els.counter.textContent = `Páginas ${first}–${last} de ${cfg.pages.length}`;
    }
  }

  function preloadAround() {
    const radius = cfg.settings?.preloadRadius || 3;
    const center = currentState()[0];
    for (let d = -radius; d <= radius + 2; d++) loadImage(center + d).catch(() => {});
  }

  function playSound() {
    if (!soundEnabled || !els.sound) return;
    try { els.sound.currentTime = 0; els.sound.play().catch(() => {}); } catch (_) {}
  }

  function setFlipProgress(p, direction) {
    const t = Math.max(0, Math.min(1, p));
    const eased = 1 - Math.pow(1 - t, 2.65);
    const angle = direction > 0 ? -180 * eased : 180 * eased;
    const lift = Math.sin(Math.PI * t);
    const skew = direction > 0 ? -1.25 * lift : 1.25 * lift;
    els.flip.style.transform = `translateZ(${14 * lift}px) rotateY(${angle}deg) skewY(${skew}deg)`;
    els.flip.style.setProperty('--shadow', String(Math.min(.88, lift * .88)));
    els.flip.style.setProperty('--curl', String(lift * .8));
    els.flip.style.setProperty('--curl-x', String(100 * t));
  }

  function stateTypeAt(index) {
    if (isMobile()) return 'single';
    const state = states[index] || states[0];
    if (index === 0) return 'cover';
    if (index === states.length - 1 && state.length === 1) return 'back';
    return 'spread';
  }

  function applyBookModeFor(index) {
    const type = stateTypeAt(index);
    els.book.classList.toggle('cover-mode', type === 'cover');
    els.book.classList.toggle('back-cover-mode', type === 'back');
    els.shell.classList.toggle('closed-front', type === 'cover');
    els.shell.classList.toggle('closed-back', type === 'back');
  }

  function renderFlipUnderlay(direction, targetStateIndex) {
    const from = currentState();
    const to = states[targetStateIndex];

    if (isMobile()) {
      assign(rightImg, to[0]);
      assign(leftImg, null);
      return;
    }

    if (direction > 0) {
      // La hoja derecha gira. Debajo debe estar visible desde el primer frame
      // la página derecha del siguiente pliego (o vacío al cerrar el libro).
      assign(leftImg, from.length > 1 ? from[0] : null);
      assign(rightImg, to.length > 1 ? to[1] : null);
    } else {
      // La hoja izquierda gira hacia la derecha. Debajo aparece de inmediato
      // la página izquierda del pliego anterior (o vacío al cerrar portada).
      assign(leftImg, to.length > 1 ? to[0] : null);
      assign(rightImg, from.length > 1 ? from[from.length - 1] : null);
    }
  }

  async function prepareFlip(direction) {
    const targetStateIndex = stateIndex + direction;
    if (targetStateIndex < 0 || targetStateIndex >= states.length) return false;
    const from = currentState();
    const to = states[targetStateIndex];
    const frontIndex = direction > 0 ? from[from.length - 1] : from[0];
    const backIndex = direction > 0 ? to[0] : to[to.length - 1];
    const underlayIndex = isMobile()
      ? to[0]
      : direction > 0
        ? (to.length > 1 ? to[1] : null)
        : (to.length > 1 ? to[0] : null);

    const needed = [frontIndex, backIndex, underlayIndex].filter(i => i != null);
    await Promise.all(needed.map(loadImage)).catch(() => {});

    assign(flipFront, frontIndex);
    assign(flipBack, backIndex);
    renderFlipUnderlay(direction, targetStateIndex);
    applyBookModeFor(targetStateIndex);

    const mobile = isMobile();
    els.flip.style.left = direction < 0 && !mobile ? '0' : '';
    els.flip.style.right = direction < 0 && !mobile ? 'auto' : '0';
    els.flip.style.width = mobile ? '100%' : '50%';
    els.flip.style.transformOrigin = direction > 0 ? 'left center' : 'right center';
    els.flip.classList.toggle('turn-forward', direction > 0);
    els.flip.classList.toggle('turn-backward', direction < 0);
    els.flip.classList.add('active');
    setFlipProgress(0, direction);
    return true;
  }

  function cleanupFlip() {
    els.flip.classList.remove('active', 'turn-forward', 'turn-backward');
    els.flip.removeAttribute('style');
    els.left.classList.remove('turn-source');
    els.right.classList.remove('turn-source');
  }

  async function animateTo(direction, startProgress = 0) {
    if (turning) return;
    if (!(await prepareFlip(direction))) return;
    turning = true;
    playSound();
    const start = performance.now();
    const remaining = Math.max(120, duration * (1 - startProgress));
    await new Promise(resolve => {
      function frame(now) {
        const raw = Math.min(1, (now - start) / remaining);
        setFlipProgress(startProgress + (1 - startProgress) * raw, direction);
        if (raw < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
    stateIndex += direction;
    renderStatic();
    cleanupFlip();
    turning = false;
  }

  function beginDrag(event) {
    if (turning) return;
    const rect = $('stage').getBoundingClientRect();
    const direction = event.clientX - rect.left > rect.width / 2 ? 1 : -1;
    if (stateIndex + direction < 0 || stateIndex + direction >= states.length) return;
    pointer = { id:event.pointerId, startX:event.clientX, direction, progress:0, prepared:false };
    $('stage').setPointerCapture?.(event.pointerId);
  }

  async function moveDrag(event) {
    if (!pointer || pointer.id !== event.pointerId || turning) return;
    const width = Math.max(280, els.book.getBoundingClientRect().width / (isMobile() ? 1 : 2));
    const delta = (event.clientX - pointer.startX) * -pointer.direction;
    pointer.progress = Math.max(0, Math.min(1, delta / width));
    if (pointer.progress < .025) return;
    if (!pointer.prepared) pointer.prepared = await prepareFlip(pointer.direction);
    if (pointer.prepared) setFlipProgress(pointer.progress, pointer.direction);
  }

  async function endDrag(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    const { progress:p, direction, prepared } = pointer;
    pointer = null;
    if (!prepared) return;
    if (p >= .22) {
      turning = true;
      playSound();
      const start = performance.now();
      const remaining = Math.max(120, duration * (1 - p));
      await new Promise(resolve => {
        function frame(now) {
          const raw = Math.min(1, (now - start) / remaining);
          setFlipProgress(p + (1 - p) * raw, direction);
          if (raw < 1) requestAnimationFrame(frame); else resolve();
        }
        requestAnimationFrame(frame);
      });
      stateIndex += direction;
      renderStatic();
      cleanupFlip();
      turning = false;
    } else {
      const start = performance.now();
      await new Promise(resolve => {
        function frame(now) {
          const raw = Math.min(1, (now - start) / 220);
          setFlipProgress(p * (1 - raw), direction);
          if (raw < 1) requestAnimationFrame(frame); else resolve();
        }
        requestAnimationFrame(frame);
      });
      cleanupFlip();
      renderStatic();
    }
  }

  function goToPage(pageIndex) {
    let best = 0;
    states.forEach((state, i) => { if (state.includes(pageIndex)) best = i; });
    stateIndex = best;
    renderStatic();
  }

  function setZoom(value) {
    zoom = Math.max(.65, Math.min(2.2, value));
    document.documentElement.style.setProperty('--zoom', String(zoom));
    els.zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  }

  function bind() {
    $('next-btn').onclick = () => animateTo(1); $('next-zone').onclick = () => animateTo(1);
    $('prev-btn').onclick = () => animateTo(-1); $('prev-zone').onclick = () => animateTo(-1);
    $('first-btn').onclick = () => { stateIndex = 0; renderStatic(); };
    $('last-btn').onclick = () => { stateIndex = states.length - 1; renderStatic(); };
    els.slider.oninput = () => goToPage(Number(els.slider.value) - 1);
    $('zoom-in').onclick = () => setZoom(zoom + .15); $('zoom-out').onclick = () => setZoom(zoom - .15); $('zoom-reset').onclick = () => setZoom(1);
    els.soundBtn.onclick = () => {
      soundEnabled = !soundEnabled;
      els.soundBtn.classList.toggle('is-muted', !soundEnabled);
      els.soundBtn.setAttribute('aria-label', soundEnabled ? 'Silenciar sonido' : 'Activar sonido');
      els.soundBtn.title = soundEnabled ? 'Silenciar sonido' : 'Activar sonido';
    };
    els.soundBtn.classList.toggle('is-muted', !soundEnabled);
    $('fullscreen-btn').onclick = async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        } else {
          postToParent('ebook-fullscreen-request');
        }
      } catch (_) {
        postToParent('ebook-fullscreen-request');
      }
    };

    const keyboardBtn = $('keyboard-help-btn');
    const keyboardWrap = document.querySelector('.keyboard-wrap');
    if (keyboardBtn && keyboardWrap) {
      keyboardBtn.onclick = (e) => {
        e.stopPropagation();
        const open = keyboardWrap.classList.toggle('open');
        keyboardBtn.setAttribute('aria-expanded', String(open));
      };
      document.addEventListener('pointerdown', (e) => {
        if (!keyboardWrap.contains(e.target)) {
          keyboardWrap.classList.remove('open');
          keyboardBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') animateTo(1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') animateTo(-1);
      if (e.key === '+') setZoom(zoom + .15); if (e.key === '-') setZoom(zoom - .15); if (e.key === '0') setZoom(1);
      if (e.key.toLowerCase() === 'f') $('fullscreen-btn').click();
      if (e.key.toLowerCase() === 'm') els.soundBtn.click();
    });
    const stage = $('stage');
    const app = $('app');
    if (app) {
      app.addEventListener('pointerdown', () => { try { app.focus({ preventScroll:true }); } catch (_) { app.focus(); } }, { passive:true });
    }
    stage.addEventListener('pointerdown', beginDrag);
    stage.addEventListener('pointermove', moveDrag);
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      const type = msg.type;
      if (type === 'ebook-next') animateTo(1);
      else if (type === 'ebook-prev') animateTo(-1);
      else if (type === 'ebook-first') { stateIndex = 0; renderStatic(); }
      else if (type === 'ebook-last') { stateIndex = states.length - 1; renderStatic(); }
      else if (type === 'ebook-goto' && Number.isFinite(Number(msg.page))) goToPage(Math.max(0, Number(msg.page) - 1));
      else if (type === 'ebook-zoom' && Number.isFinite(Number(msg.zoom))) setZoom(Number(msg.zoom));
      else if (type === 'ebook-sound') {
        soundEnabled = !!msg.enabled;
        els.soundBtn.classList.toggle('is-muted', !soundEnabled);
      }
      else if (type === 'ebook-fullscreen') $('fullscreen-btn').click();
    });

    window.addEventListener('resize', () => {
      const visiblePage = currentState()[0];
      states = buildStates();
      goToPage(visiblePage);
    });
  }

  async function init() {
    els.title.textContent = cfg.title || document.title;
    els.loadingText.textContent = `Preparando ${cfg.pages.length} páginas…`;
    await Promise.all([loadImage(0), loadImage(1), loadImage(2)]).catch(() => {});
    setZoom(zoom);
    renderStatic();
    bind();
    requestAnimationFrame(() => {
      els.loading.classList.add('hidden');
      postToParent('ebook-ready', { title: cfg.title || document.title, pageCount: cfg.pages.length });
    });
  }
  init();
})();

/* Bloqueo del menú contextual (clic derecho) en el ebook exportado. */
document.addEventListener('contextmenu', (event) => {
  event.preventDefault();
}, { capture: true });
