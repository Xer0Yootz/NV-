/* Symbiont sprite — PLACEHOLDER.
   The real Symbiont sprite comes later. This is a temporary hexagon stand-in
   so the roaming / drag / spin / tap behaviour can be tried on the hub pages.
   Placeholder purple (#8a8a99, lavender #c9c9d4 accent) is the single
   placeholder default. The Hexa/Cyphr per-base colour split is still
   Jasmine's call — do NOT invent per-base colours here.
   Chime: touching the sprite plays the shared symbiont chime (window.NVSymbiontChime). No words or text on the hexagon.
   Movement: per-base roam patterns (Jasmine's ruling, Nov 13, 2026) —
   Hexa SWEEP, Cyphr PROWL, Helix DART, Warden STRIDE — keyed off the
   same data-symbiont base signal as the colour. See stepPattern. */

(function () {
  'use strict';
  if (window.NVSprite) return; /* already loaded */
  window.NVSprite = { refresh: checkGate };

  var SIZE = 120; /* container is 120x120, transparent, no background/border */
  var TAP_MOVE = 8; /* px — under this + under 400ms counts as a tap, not a drag */
  var TAP_MS = 400;
  var HOP_MS = 1000; /* 1s hop-bob, same timing as Baby Pigek's locked hop-bob */
  var FALLBACK_SPEED = 55; /* px per second — the pre-pattern roam pace */
  /* Per-pattern cruise pace (px per second). DART's is its burst speed;
     PROWL's caps its descend so a settle into prowl never reads as a throw. */
  var CRUISE = { hexa: 90, cyphr: 46, helix: 175, warden: 65 };
  var THROW_MAX = 2200; /* px per second — the fastest a fling can throw it */
  var THROW_FRICTION = 0.32; /* per-second velocity retention while thrown — decays in ~1-2s */
  var BOUNCE_KEEP = 0.7; /* a throw bounce keeps 70% of its speed (loses 30% per wall) */

  var container = null, hex = null;
  var shown = false, gateTimer = null;
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* Position / motion state. Position lives in left/top on the container;
     rotation lives as a transform on the inner hex element, and the hop-bob
     as an animation on the container — three separate layers, so none of
     them fights the others. */
  var x = 0, y = 0, vx = 0, vy = 0, angle = 0, angVel = 0;
  var throwVX = 0, throwVY = 0; /* latest flick velocity while dragging */
  var dragging = false, hopping = false, wiggling = false;
  var raf = null, lastT = 0;
  var pattern = 'cyphr', P = null, thrown = false, frameNo = 0;

  function localName() {
    try { return localStorage.getItem('nv_display_name') || ''; } catch (e) { return ''; }
  }
  async function accountName() {
    try {
      var c = (typeof getClient === 'function') ? getClient() : null;
      if (!c) return '';
      var d = await c.auth.getSession();
      var u = d && d.data && d.data.session && d.data.session.user;
      return (u && u.user_metadata && u.user_metadata.display_name) || '';
    } catch (e) { return ''; }
  }
  async function hasSession() {
    try {
      var c = (typeof getClient === 'function') ? getClient() : null;
      if (!c) return null; /* no client (not configured) — cannot check, do not block on it */
      var d = await c.auth.getSession();
      return !!(d && d.data && d.data.session);
    } catch (e) { return false; }
  }

  /* CONDITION: the sprite only appears after the user has created a username
     and an account on the hub — signed in AND a username exists. The username
     is the same name the hub saves: localStorage 'nv_display_name' or
     Supabase user_metadata.display_name. No saved name = no sprite at all. */
  async function checkGate() {
    if (shown) return;
    var name = localName() || await accountName();
    if (!name) return;
    var session = await hasSession();
    if (session === false) return; /* a client exists and says: not signed in */
    show();
  }

  function randomStart() {
    var maxX = Math.max(0, window.innerWidth - SIZE);
    var maxY = Math.max(0, window.innerHeight - SIZE);
    x = Math.floor(Math.random() * (maxX + 1));
    y = Math.floor(Math.random() * (maxY + 1));
    var a = Math.random() * Math.PI * 2;
    vx = Math.cos(a) * FALLBACK_SPEED;
    vy = Math.sin(a) * FALLBACK_SPEED;
  }

  function render() {
    if (!container) return;
    container.style.left = x + 'px';
    container.style.top = y + 'px';
    if (hex) hex.style.transform = 'rotate(' + angle + 'deg)';
  }

  /* Roaming is pattern-driven, per symbiont base (Jasmine's ruling,
     Nov 13, 2026). The pattern keys off the SAME base signal the colour
     uses: the theme's data-symbiont attribute on the root element (which
     nv-symbiont-theme.js sets from localStorage 'nv_symbiont_base'), with
     the stored pick itself as a fallback and 'cyphr' — the theme's own
     default — when nothing valid is picked. No new storage, no settings.
       hexa   SWEEP  — wide horizontal arcs; pauses at each edge and
                       pulses once before crossing back.
       cyphr  PROWL  — drops to the bottom edge; short steps with long
                       still pauses, dimmed while it sits still.
       helix  DART   — fast zigzag bursts with a brief hover between.
       warden STRIDE — a steady, even march at full brightness; it
                       never dims and never hides.
     A throw (fling on release) overrides the pattern: it keeps its
     velocity and decays with friction, bouncing off the walls with a
     little energy lost per bounce, until it settles back to pattern
     pace and the pattern takes over again. Pauses while dragging;
     resumes from wherever it was dropped. */
  function patternBase() {
    var a = '';
    try { a = document.documentElement.getAttribute('data-symbiont') || ''; } catch (e) {}
    if (a === 'hexa' || a === 'cyphr' || a === 'helix' || a === 'warden') return a;
    try {
      var b = localStorage.getItem('nv_symbiont_base') || '';
      if (b === 'hexa' || b === 'cyphr' || b === 'helix' || b === 'warden') return b;
    } catch (e) {}
    return 'cyphr'; /* the theme's default when nothing is picked */
  }

  function startPattern(name) {
    pattern = name;
    P = { phase: 'go', t: 0, dir: (vx < 0 ? -1 : 1), zag: 1, wall: null, bob: 0 };
    if (container) container.style.opacity = ''; /* no pattern starts dimmed */
    if (name === 'cyphr') P.phase = 'descend';
    else if (name === 'helix') { P.phase = 'burst'; P.t = 0.38; }
    else if (name === 'hexa') P.phase = 'glide';
    else if (name === 'warden') P.phase = 'march';
  }

  function pulse() {
    /* SWEEP's edge pulse: one soft swell of the hexagon itself (the svg
       layer, so it never fights the hex rotation or the hop). */
    if (!hex || reduced) return;
    hex.classList.remove('nv-sprite-pulse');
    void hex.offsetWidth; /* restart the animation */
    hex.classList.add('nv-sprite-pulse');
    setTimeout(function () { if (hex) hex.classList.remove('nv-sprite-pulse'); }, 900);
  }

  function stepSweep(dt, wall) {
    if (P.phase === 'pause') {
      vx = 0; vy = 0;
      P.t -= dt;
      if (P.t <= 0) { P.dir = -P.dir; P.phase = 'glide'; }
      return;
    }
    vx = P.dir * CRUISE.hexa;
    P.bob += dt;
    vy = Math.sin(P.bob * 0.9) * 14; /* a gentle arc, not a straight rail */
    if (wall === 'top') vy = Math.abs(vy);
    if (wall === 'bottom') vy = -Math.abs(vy);
    if ((wall === 'left' && P.dir < 0) || (wall === 'right' && P.dir > 0)) {
      P.phase = 'pause'; P.t = 1.1; vx = 0; vy = 0; pulse();
    }
  }

  function stepProwl(dt, wall) {
    var fy = Math.max(0, window.innerHeight - SIZE - 6); /* the bottom edge */
    if (P.phase === 'descend') {
      if (container) container.style.opacity = '';
      vx = 0;
      var dy = fy - y;
      if (Math.abs(dy) <= 2) { y = fy; vy = 0; P.phase = 'still'; P.t = 0.8; }
      else vy = (dy > 0 ? 1 : -1) * 46;
      return;
    }
    y = fy; vy = 0;
    if (P.phase === 'step') {
      if (container) container.style.opacity = '';
      vx = P.dir * 42;
      P.t -= dt;
      if (wall === 'left' || wall === 'right') {
        P.dir = -P.dir; vx = 0; P.phase = 'still'; P.t = 1.4 + Math.random() * 1.2;
      } else if (P.t <= 0) {
        vx = 0; P.phase = 'still'; P.t = 1.6 + Math.random() * 1.2;
      }
      return;
    }
    /* still: sit low and dim until the next step */
    vx = 0;
    if (container) container.style.opacity = '0.55';
    P.t -= dt;
    if (P.t <= 0) {
      if (Math.random() < 0.3) P.dir = -P.dir;
      P.phase = 'step'; P.t = 0.55;
    }
  }

  function stepDart(dt, wall) {
    if (wall === 'left' && P.dir < 0) P.dir = 1;
    if (wall === 'right' && P.dir > 0) P.dir = -1;
    if (wall === 'top' || wall === 'bottom') P.zag = -P.zag;
    P.t -= dt;
    if (P.phase === 'burst') {
      var ang = 0.6; /* ~34 degrees — the zigzag angle */
      vx = P.dir * Math.cos(ang) * CRUISE.helix;
      vy = P.zag * Math.sin(ang) * CRUISE.helix;
      if (P.t <= 0) { P.phase = 'hover'; P.t = 0.28; P.zag = -P.zag; }
    } else { /* hover: a brief held breath between darts */
      vx = P.dir * 6; vy = 0;
      if (P.t <= 0) { P.phase = 'burst'; P.t = 0.38; }
    }
  }

  function stepStride(dt, wall) {
    if (wall === 'left') P.dir = 1;
    if (wall === 'right') P.dir = -1;
    vx = P.dir * CRUISE.warden; /* the same pace, the whole way across */
    var H = Math.max(0, window.innerHeight - SIZE);
    if (y < H * 0.15) vy = 22; else if (y > H * 0.75) vy = -22; else vy = 0;
    if (container) container.style.opacity = ''; /* STRIDE never dims */
  }

  function stepPattern(dt, wall) {
    if (!P) startPattern(pattern);
    if (pattern === 'hexa') stepSweep(dt, wall);
    else if (pattern === 'cyphr') stepProwl(dt, wall);
    else if (pattern === 'helix') stepDart(dt, wall);
    else stepStride(dt, wall);
  }

  /* Move one frame. In a throw, walls bounce the velocity back with
     BOUNCE_KEEP of its speed; under a pattern, walls just clamp and are
     reported to the pattern, which decides what happens next. */
  function integrate(dt, bouncy) {
    var speed = Math.sqrt(vx * vx + vy * vy);
    x += vx * dt;
    y += vy * dt;
    var maxX = Math.max(0, window.innerWidth - SIZE), maxY = Math.max(0, window.innerHeight - SIZE);
    var wall = null;
    if (x <= 0) { x = 0; wall = 'left'; vx = bouncy ? Math.abs(vx) * BOUNCE_KEEP : 0; }
    if (x >= maxX) { x = maxX; wall = 'right'; vx = bouncy ? -Math.abs(vx) * BOUNCE_KEEP : 0; }
    if (y <= 0) { y = 0; if (!wall) wall = 'top'; vy = bouncy ? Math.abs(vy) * BOUNCE_KEEP : 0; }
    if (y >= maxY) { y = maxY; if (!wall) wall = 'bottom'; vy = bouncy ? -Math.abs(vy) * BOUNCE_KEEP : 0; }
    if (P) P.wall = wall;
    return speed;
  }

  function tick(t) {
    raf = null;
    if (!container || dragging) return;
    var dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (!reduced) {
      frameNo++;
      if (frameNo % 15 === 0) { /* follow a live base change (~4x a second) */
        var b = patternBase();
        if (b !== pattern) startPattern(b);
      }
      if (thrown) {
        /* Throw friction: a flung symbiont sheds speed until it is back
           to pattern pace, then the pattern takes over again. */
        var keep = Math.pow(THROW_FRICTION, dt);
        vx *= keep; vy *= keep;
        var spd = Math.sqrt(vx * vx + vy * vy);
        integrate(dt, true);
        if (spd <= (CRUISE[pattern] || FALLBACK_SPEED)) thrown = false;
      } else {
        var wallHit = P ? P.wall : null;
        if (P) P.wall = null;
        stepPattern(dt, wallHit);
        integrate(dt, false);
      }
    }
    /* Spin momentum: a flick keeps it turning after release, decaying until
       it settles. Under reduced motion there is no spin. */
    if (!reduced && Math.abs(angVel) > 0.05) {
      angle += angVel * dt;
      angVel *= Math.pow(0.12, dt); /* fast decay — settles in about a second */
      if (Math.abs(angVel) <= 0.05) angVel = 0;
    }
    render();
    raf = requestAnimationFrame(tick);
  }
  function kick() {
    if (raf == null && container) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
  }
  function clampIntoView() {
    x = Math.max(0, Math.min(window.innerWidth - SIZE, x));
    y = Math.max(0, Math.min(window.innerHeight - SIZE, y));
  }

  function hop() {
    /* 1s hop-bob, same timing as Baby Pigek's locked hop-bob. Skipped under
       reduced motion — the run-away below still answers the tap. */
    if (hopping || reduced) return;
    hopping = true;
    container.classList.remove('nv-sprite-hop');
    void container.offsetWidth; /* restart the animation */
    container.classList.add('nv-sprite-hop');
    setTimeout(function () {
      container.classList.remove('nv-sprite-hop');
      hopping = false;
    }, HOP_MS);
  }

  function wiggle() {
    /* A little side-to-side wiggle, like a pet. Skipped under reduced motion. */
    if (wiggling || reduced || !hex) return;
    wiggling = true;
    hex.classList.remove('nv-sprite-wiggle');
    void hex.offsetWidth; /* restart the animation */
    hex.classList.add('nv-sprite-wiggle');
    setTimeout(function () {
      hex.classList.remove('nv-sprite-wiggle');
      wiggling = false;
    }, 600);
  }

  function onTap(clientX, clientY) { if (window.NVSymbiontChime) window.NVSymbiontChime();
    /* A click is petting it: it hops and wiggles where it is. It does NOT
       run away — the toss (fling on release) is what sends it flying. */
    hop();
    wiggle();
  }

  function bindDrag() {
    var downX = 0, downY = 0, downT = 0, grabDX = 0, grabDY = 0;
    var lastMoveX = 0, lastMoveY = 0, lastMoveT = 0, moved = 0;
    /* Trail of recent pointer positions, for the throw velocity on release.
       The old code used only the last pointermove pair — by release time a
       mouse fling has already decelerated, so the recorded speed was near
       zero and the throw did nothing. A trailing ~120ms window catches the
       fast part of the fling even if the pointer slows at the very end. */
    var trail = []; /* {x, y, t} — newest last, capped at 20 */

    hex.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try { hex.setPointerCapture(e.pointerId); } catch (err) {}
      dragging = true;
      if (raf != null) { cancelAnimationFrame(raf); raf = null; }
      downX = e.clientX; downY = e.clientY; downT = Date.now();
      grabDX = e.clientX - x; grabDY = e.clientY - y;
      lastMoveX = e.clientX; lastMoveY = e.clientY; lastMoveT = Date.now();
      moved = 0; trail = [];
      angVel = 0;
      thrown = false;
      if (container) container.style.opacity = ''; /* a grab ends any PROWL dim */
      hex.classList.add('nv-sprite-grabbing');
    });

    hex.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var nx = e.clientX - grabDX, ny = e.clientY - grabDY;
      var dx = nx - x, dy = ny - y;
      moved += Math.abs(dx) + Math.abs(dy);
      x = nx; y = ny;
      clampIntoView();
      /* Rotation follows the drag. */
      if (!reduced) angle += dx * 0.4;
      /* Track flick velocity for the throw on release — both the spin and
         the flight speed come from how fast the pointer is moving. */
      var now = Date.now();
      var dt = Math.max(1, now - lastMoveT);
      var flickX = (e.clientX - lastMoveX) / dt * 1000; /* px per second */
      var flickY = (e.clientY - lastMoveY) / dt * 1000;
      var flick = flickX; /* spin follows the horizontal flick, as before */
      angVel = Math.max(-720, Math.min(720, flick * 0.4));
      /* Keep the latest flick velocity so release can throw with it. */
      throwVX = Math.max(-THROW_MAX, Math.min(THROW_MAX, flickX));
      throwVY = Math.max(-THROW_MAX, Math.min(THROW_MAX, flickY));
      lastMoveX = e.clientX; lastMoveY = e.clientY; lastMoveT = now;
      trail.push({ x: e.clientX, y: e.clientY, t: now });
      if (trail.length > 20) trail.shift();
      render();
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      hex.classList.remove('nv-sprite-grabbing');
      /* A tap, NOT a drag: tiny movement + short press = hop + run away. */
      if (moved < TAP_MOVE && Date.now() - downT < TAP_MS) {
        onTap(e.clientX, e.clientY);
      } else if (reduced) {
        angVel = 0; /* no spin momentum under reduced motion */
        vx = 0; vy = 0;
      } else {
        /* A throw: the symbiont keeps the fling velocity and flies across
           the screen, decaying with friction until it settles to roaming.
           Velocity comes from the trailing ~120ms of pointer movement, not
           just the last move event — a mouse fling decelerates before
           release, so the last pair alone reads near zero. */
        var relT = Date.now();
        var winStart = relT - 120;
        var first = null, last = null;
        for (var i = 0; i < trail.length; i++) {
          if (trail[i].t >= winStart) { if (!first) first = trail[i]; last = trail[i]; }
        }
        if (first && last && last.t > first.t) {
          var wdt = last.t - first.t;
          vx = Math.max(-THROW_MAX, Math.min(THROW_MAX, (last.x - first.x) / wdt * 1000));
          vy = Math.max(-THROW_MAX, Math.min(THROW_MAX, (last.y - first.y) / wdt * 1000));
        } else {
          vx = throwVX; vy = throwVY;
        }
        thrown = Math.sqrt(vx * vx + vy * vy) > (CRUISE[pattern] || FALLBACK_SPEED);
      }
      kick(); /* pattern / throw resumes from the drop point */
    }
    hex.addEventListener('pointerup', endDrag);
    hex.addEventListener('pointercancel', endDrag);

    /* Keyboard: Enter / Space does the tap behaviour. */
    hex.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onTap(x + SIZE / 2, y + SIZE / 2);
      }
    });
  }

  function show() {
    if (shown) return;
    shown = true;
    if (gateTimer) { clearInterval(gateTimer); gateTimer = null; }

    container = document.createElement('div');
    container.className = 'nv-sprite';
    container.setAttribute('aria-hidden', 'false');
    hex = document.createElement('div');
    hex.className = 'nv-sprite-hex';
    hex.setAttribute('role', 'button');
    hex.setAttribute('tabindex', '0');
    hex.setAttribute('aria-label', 'Symbiont (placeholder)');
    /* Inline SVG hexagon — no words, no text on it. */
    /* The hexagon follows the IA Symbiont pick (Hexa cyan, Cyphr indigo,
       Helix pink) through the theme variables, so the IA recolors with
       the rest of the system. */
    hex.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill="var(--nv-accent, #8a8a99)" fill-opacity="0.35" stroke="var(--nv-accent, #8a8a99)" stroke-width="3"/><polygon points="50,22 76,37 76,63 50,78 24,63 24,37" fill="none" stroke="var(--nv-accent-soft, #c9c9d4)" stroke-width="2"/></svg>';
    container.appendChild(hex);
    document.body.appendChild(container);

    randomStart();
    startPattern(patternBase());
    render();
    bindDrag();
    window.addEventListener('resize', function () { clampIntoView(); render(); });
    if (!reduced) kick();
  }

  function hide() {
    if (!shown) return;
    shown = false;
    if (raf != null) { cancelAnimationFrame(raf); raf = null; }
    if (container && container.parentNode) container.parentNode.removeChild(container);
    container = null; hex = null;
    startGateWatch();
  }

  function startGateWatch() {
    /* The username may be created after this page loads (hub save). A
       same-tab localStorage write fires no storage event, so re-check the
       saved name on a light interval until the sprite appears. */
    if (gateTimer || shown) return;
    gateTimer = setInterval(function () {
      if (localName()) checkGate();
    }, 2000);
  }

  /* If the name is deleted (hub / settings), the sprite goes away with it. */
  window.addEventListener('storage', function (e) {
    if (e.key === 'nv_display_name') {
      if (e.newValue) { checkGate(); } else { hide(); }
    }
  });

  function init() {
    checkGate();
    startGateWatch();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
