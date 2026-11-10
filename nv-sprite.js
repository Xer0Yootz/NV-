/* Symbiont sprite — PLACEHOLDER.
   The real Symbiont sprite comes later. This is a temporary hexagon stand-in
   so the roaming / drag / spin / tap behaviour can be tried on the hub pages.
   Placeholder purple (#7c3aed, lavender #a78bfa accent) is the single
   placeholder default. The Hexa/Cyphr per-base colour split is still
   Jasmine's call — do NOT invent per-base colours here.
   Silent: no sound attached anywhere. No words or text on the hexagon. */

(function () {
  'use strict';
  if (window.NVSprite) return; /* already loaded */
  window.NVSprite = { refresh: checkGate };

  var SIZE = 120; /* container is 120x120, transparent, no background/border */
  var TAP_MOVE = 8; /* px — under this + under 400ms counts as a tap, not a drag */
  var TAP_MS = 400;
  var HOP_MS = 1000; /* 1s hop-bob, same timing as Baby Pigek's locked hop-bob */
  var ROAM_SPEED = 55; /* px per second while roaming */
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
    vx = Math.cos(a) * ROAM_SPEED;
    vy = Math.sin(a) * ROAM_SPEED;
  }

  function render() {
    if (!container) return;
    container.style.left = x + 'px';
    container.style.top = y + 'px';
    if (hex) hex.style.transform = 'rotate(' + angle + 'deg)';
  }

  /* Roams / bounces all around the screen, like a screensaver. Pauses while
     dragging; resumes from wherever it was dropped. A throw
     (fling on release) keeps its velocity and decays with friction, bouncing
     off the walls with a little energy lost per bounce, until it settles
     back to roaming speed. */
  function tick(t) {
    raf = null;
    if (!container || dragging) return;
    var dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (!reduced) {
      /* Throw friction: a flung symbiont sheds speed until it is back to
         roaming pace. Below roaming speed, hold roaming speed so it never
         stalls out mid-screen. */
      var speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > ROAM_SPEED) {
        var keep = Math.pow(THROW_FRICTION, dt);
        vx *= keep; vy *= keep;
        speed = Math.sqrt(vx * vx + vy * vy);
        if (speed <= ROAM_SPEED && speed > 0) {
          vx = vx / speed * ROAM_SPEED;
          vy = vy / speed * ROAM_SPEED;
        }
      }
      x += vx * dt;
      y += vy * dt;
      var maxX = window.innerWidth - SIZE, maxY = window.innerHeight - SIZE;
      if (x <= 0) { x = 0; vx = Math.abs(vx) * (speed > ROAM_SPEED ? BOUNCE_KEEP : 1); }
      if (x >= maxX) { x = maxX; vx = -Math.abs(vx) * (speed > ROAM_SPEED ? BOUNCE_KEEP : 1); }
      if (y <= 0) { y = 0; vy = Math.abs(vy) * (speed > ROAM_SPEED ? BOUNCE_KEEP : 1); }
      if (y >= maxY) { y = maxY; vy = -Math.abs(vy) * (speed > ROAM_SPEED ? BOUNCE_KEEP : 1); }
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

  function onTap(clientX, clientY) {
    /* A click is petting it: it hops and wiggles where it is. It does NOT
       run away — the toss (fling on release) is what sends it flying. */
    hop();
    wiggle();
  }

  function bindDrag() {
    var downX = 0, downY = 0, downT = 0, grabDX = 0, grabDY = 0;
    var lastMoveX = 0, lastMoveY = 0, lastMoveT = 0, moved = 0;

    hex.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try { hex.setPointerCapture(e.pointerId); } catch (err) {}
      dragging = true;
      if (raf != null) { cancelAnimationFrame(raf); raf = null; }
      downX = e.clientX; downY = e.clientY; downT = Date.now();
      grabDX = e.clientX - x; grabDY = e.clientY - y;
      lastMoveX = e.clientX; lastMoveY = e.clientY; lastMoveT = Date.now();
      moved = 0;
      angVel = 0;
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
           the screen, decaying with friction until it settles to roaming. */
        vx = throwVX; vy = throwVY;
      }
      kick(); /* roaming / throw resumes from the drop point */
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
    hex.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill="rgba(124,58,237,.35)" stroke="#7c3aed" stroke-width="3"/><polygon points="50,22 76,37 76,63 50,78 24,63 24,37" fill="none" stroke="#a78bfa" stroke-width="2"/></svg>';
    container.appendChild(hex);
    document.body.appendChild(container);

    randomStart();
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
