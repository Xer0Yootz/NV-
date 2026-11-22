/* nv-shell.js — Infinity6Shell: the shared App Shell for the Neon Vigil web app.
   Infinity 6 Terminal / Hex OS. Audit fix, Nov 8, 2026.
   Static pages have no build step, so the shell is a module that pages include:
   nv-terminal-tokens.css + nv-ticker.css + nv-commands.css in <head>, and
   nv-ticker.js + nv-commands.js + this file before </body>. This module:
     1. makes sure the ticker (nv-ticker.js) and the palette (nv-commands.js)
        are loaded, using its own script URL as the base path;
     2. injects the standard bottom dock (Radio + Hexa/Commands button) when
        the page does not already have one — the hub has its own dock inline
        and does NOT include this file.
   The dock radio is the shared implementation: the same stations as
   the hub (Sound Beds 1–3, default Sound Bed 3, plus Atmospheric Haze —
   its audio file ships in /sounds), the same first-tap autoplay, and the same
   cookie-lock guard (no playback while body.cookie-locked). Hex OS port,
   Nov 22, 2026: the radio carries NO label text — at rest it is just the
   merged play/stop button and a small living wave (still when silent,
   moving when playing); the station list appears on hover/focus (the
   select stays as the fallback picker) and scrolling over the radio
   cycles stations. This module also injects the shared wireframe band
   (.nv-wireframe, styled in nv-terminal-tokens.css) — its own layer
   along the bottom of the screen, behind the dock. Safe to include
   once per page; a second include is a no-op. Exposes window.Infinity6Shell. */
(function () {
  if (window.__nvShellLoaded) return;
  window.__nvShellLoaded = true;

  /* Base path for the shared modules, derived from this script's own URL,
     so sub-pages (/nv808/, /gridlog/) resolve ../nv-ticker.js and
     ../nv-commands.js correctly without hardcoding a path per page. */
  var base = './';
  try {
    var src = (document.currentScript && document.currentScript.src) || '';
    if (src) base = src.slice(0, src.lastIndexOf('/') + 1);
  } catch (e) {}
  function ensureScript(url, flag) {
    if (flag && window[flag]) return;
    var s = document.createElement('script');
    s.src = url;
    document.head.appendChild(s);
  }

  var STATIONS = [
    '/sounds/neon-vigil-sound-bed-1-landing-workpage.wav',
    '/sounds/neon-vigil-sound-bed-2-practice-page.wav',
    '/sounds/neon-vigil-sound-bed-3-loop.wav',
    '/sounds/neon-vigil-theme-atmospheric-haze.mp3'
  ];
  var PLAY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
  var STOP_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12"/></svg>';
  /* Hexa sigil / commands mark — the same mark as the hub's commands button. */
  var HEXA_SVG = '<svg width="28" height="28" viewBox="0 0 100 100" fill="none" stroke="#f5f0ff" stroke-width="3" aria-hidden="true"><circle cx="50" cy="50" r="10"/><circle cx="50" cy="50" r="26"/><circle cx="50" cy="50" r="42"/><ellipse cx="50" cy="50" rx="42" ry="16" transform="rotate(60 50 50)"/><ellipse cx="50" cy="50" rx="42" ry="16" transform="rotate(120 50 50)"/><circle cx="50" cy="8" r="4" fill="#f5f0ff" stroke="none"/><circle cx="86" cy="71" r="4" fill="#f5f0ff" stroke="none"/><circle cx="14" cy="71" r="4" fill="#f5f0ff" stroke="none"/><path d="M50 44v12M44 50h12" stroke-width="4"/></svg>';

  function locked() { return document.body.classList.contains('cookie-locked'); }

  function mountDock() {
    if (document.querySelector('.nv-shell-dock, .commands-footer')) return;
    var dock = document.createElement('div');
    dock.className = 'nv-shell-dock';
    dock.setAttribute('role', 'contentinfo');
    dock.innerHTML =
      '<span class="nv-shell-dock-cell"><span class="nv-shell-radio" id="nvShellRadio">' +
      '<button type="button" id="nvShellRadioBtn" class="nv-shell-radio-btn" aria-label="Play Sound Bed 3" title="Play Sound Bed 3">' + PLAY_SVG + '</button>' +
      '<span class="nv-radio-wave" id="nvShellWave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' +
      '<select id="nvShellStationSelect" aria-label="Radio station">' +
      '<option value="0">Sound Bed 1</option>' +
      '<option value="1">Sound Bed 2</option>' +
      '<option value="2" selected>Sound Bed 3</option>' +
      '<option value="3">Atmospheric Haze</option>' +
      '</select></span></span>' +
      '<span class="nv-shell-dock-cell"><button type="button" id="nvShellCommandsBtn" class="nv-shell-commands-btn" aria-label="Commands" title="Commands (⌘K)">' + HEXA_SVG + '</button></span>';
    document.body.appendChild(dock);

    /* The dock's Commands button is wired directly to window.NVCommands.open()
       (the manual opener nv-commands.js exposes for triggers added later).
       It deliberately does NOT use data-nv-commands: nv-commands.js binds
       that attribute once at its own init, before this dock exists, and a
       second binding would toggle the palette twice (open then close). */
    var cmdBtn = document.getElementById('nvShellCommandsBtn');
    cmdBtn.addEventListener('click', function () {
      if (window.NVCommands) window.NVCommands.open();
    });

    var audio = document.createElement('audio');
    audio.id = 'nvShellRadioAudio';
    audio.src = STATIONS[2];
    audio.loop = true;
    audio.preload = 'none';
    document.body.appendChild(audio);

    var btn = document.getElementById('nvShellRadioBtn');
    var sel = document.getElementById('nvShellStationSelect');
    var wave = document.getElementById('nvShellWave');
    var radioWrap = document.getElementById('nvShellRadio');
    function stationName() { return sel.options[sel.selectedIndex].text; }
    function sync() {
      var playing = !audio.paused;
      btn.innerHTML = playing ? STOP_SVG : PLAY_SVG;
      btn.setAttribute('aria-label', (playing ? 'Stop ' : 'Play ') + stationName());
      btn.setAttribute('title', (playing ? 'Stop ' : 'Play ') + stationName());
      if (wave) wave.classList.toggle('playing', playing);
    }
    function setStation(idx) {
      var wasPlaying = !audio.paused;
      sel.value = String(idx);
      audio.src = STATIONS[Number(sel.value)];
      if (wasPlaying) play();
      sync();
    }
    /* Scroll over the radio cycles stations (Hex OS radio lock). */
    if (radioWrap) {
      radioWrap.addEventListener('wheel', function (e) {
        e.preventDefault();
        var dir = e.deltaY > 0 ? 1 : -1;
        var next = (Number(sel.value) + dir + STATIONS.length) % STATIONS.length;
        setStation(next);
      }, { passive: false });
    }
    function play() { if (locked()) return; audio.play().catch(function () {}); }
    function pause() { audio.pause(); }
    btn.addEventListener('click', function () {
      if (locked()) return;
      if (audio.paused) play(); else pause();
    });
    sel.addEventListener('change', function () {
      var wasPlaying = !audio.paused;
      audio.src = STATIONS[Number(sel.value)];
      if (wasPlaying) play();
      sync();
    });
    audio.addEventListener('play', sync);
    audio.addEventListener('pause', sync);
    function onFirstTap(e) {
      if (locked()) return;
      if (btn.contains(e.target)) return;
      play();
      document.removeEventListener('pointerdown', onFirstTap);
    }
    document.addEventListener('pointerdown', onFirstTap);
    sync();
  }

  function mountWireframe() {
    /* The wireframe band: its own layer along the bottom of the screen,
       behind the dock and the content (styled in nv-terminal-tokens.css).
       Never baked into any panel. */
    if (document.querySelector('.nv-wireframe')) return;
    var wf = document.createElement('div');
    wf.className = 'nv-wireframe';
    wf.setAttribute('aria-hidden', 'true');
    document.body.appendChild(wf);
  }


  /* Back control (Nov 22, 2026): one shared animated icon button —
     an exit / go-back sign pictogram (door outline + left arrow),
     no visible text; aria-label and title carry the name. Escape
     triggers this same action (see the keydown listener below):
     back and escape are one control. */
  var BACK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3.5h7v17h-7"/><g class="nv-back-glyph-arrow"><path d="M16.5 12H4"/><path d="M9.5 5.5 3.5 12l6 6.5"/></g></svg>';

  function goBack() {
    if (history.length > 1) { history.back(); }
    else { window.location.href = base + 'hub'; }
  }

  function mountBack() {
    if (document.querySelector('.nv-back-btn')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'nv-back-btn';
    b.setAttribute('aria-label', 'Back');
    b.setAttribute('title', 'Back (Esc)');
    b.innerHTML = BACK_SVG;
    b.addEventListener('click', goBack);
    document.body.appendChild(b);
  }

  /* Toasts (Nov 22, 2026): shared save/confirmation feedback.
     window.NVToast.show(msg) — the message is set via textContent,
     never innerHTML. */
  function mountToastRegion() {
    if (document.querySelector('.nv-toast-region')) return;
    var r = document.createElement('div');
    r.className = 'nv-toast-region';
    r.setAttribute('role', 'status');
    r.setAttribute('aria-live', 'polite');
    document.body.appendChild(r);
  }

  function spawnToast(msg, extraClass) {
    var region = document.querySelector('.nv-toast-region');
    if (!region) return;
    var t = document.createElement('div');
    t.className = 'nv-toast' + (extraClass ? ' ' + extraClass : '');
    t.textContent = msg;
    region.appendChild(t);
    setTimeout(function () {
      t.classList.add('leaving');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 350);
    }, 2600);
  }

  window.NVToast = {
    show: function (msg) { spawnToast(msg, ''); },
    /* Error states (Nov 22, 2026): the failure variant — the red
       .nv-toast-error pill, and the message is also announced to
       screen readers via NVAnnounce (which itself respects the
       nv_a11y_announce preference). */
    error: function (msg) {
      spawnToast(msg, 'nv-toast-error');
      if (window.NVAnnounce) window.NVAnnounce(msg);
    }
  };


  /* Screen-reader status (Nov 22, 2026): a visually hidden live
     region + window.NVAnnounce(msg). The region text is cleared
     and re-set after 30ms so repeated messages still announce.
     Gated by the Options-page preference nv_a11y_announce
     ('off' silences announcements; anything else is on). */
  function mountSrStatus() {
    if (document.getElementById('nvSrStatus')) return;
    var r = document.createElement('div');
    r.id = 'nvSrStatus';
    r.className = 'nv-sr-only';
    r.setAttribute('role', 'status');
    r.setAttribute('aria-live', 'polite');
    document.body.appendChild(r);
  }

  window.NVAnnounce = function (msg) {
    try { if (localStorage.getItem('nv_a11y_announce') === 'off') return; } catch (e) {}
    var r = document.getElementById('nvSrStatus');
    if (!r) return;
    r.textContent = '';
    setTimeout(function () { r.textContent = msg; }, 30);
  };

  /* Accessibility preferences (Nov 22, 2026): read the Options
     page's localStorage keys and stamp the non-default choices on
     <html>, where the tokens CSS picks them up. Defaults ('auto',
     announcements on) set no attribute. */
  function applyA11yPrefs() {
    var h = document.documentElement;
    function pref(key) { try { return localStorage.getItem(key) || ''; } catch (e) { return ''; } }
    if (pref('nv_a11y_motion') === 'reduce') h.setAttribute('data-a11y-motion', 'reduce');
    if (pref('nv_a11y_contrast') === 'high') h.setAttribute('data-a11y-contrast', 'high');
    if (pref('nv_a11y_text') === 'large') h.setAttribute('data-a11y-text', 'large');
    if (pref('nv_a11y_bg') === 'calm') h.setAttribute('data-a11y-bg', 'calm');
  }

  /* Escape = back, one control (Nov 22, 2026). Bubble phase.
     Layers that own Escape themselves win first: the Commands
     palette (nv-commands.js closes it — its open marker is the
     .open class on the .palette-overlay element), any visible
     backdrop/modal layer (the page's own handler closes it), and
     NV-808, where Escape means stop playback. With focus in a
     text field, Escape just leaves the field. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var overlay = document.querySelector('.palette-overlay');
    if (overlay && overlay.classList.contains('open')) return;
    var layers = document.querySelectorAll('[class*="backdrop"]');
    for (var i = 0; i < layers.length; i++) {
      var el = layers[i];
      if (el.hidden) continue;
      var cs = window.getComputedStyle ? getComputedStyle(el) : null;
      if (cs && cs.display === 'none') continue;
      /* offsetParent is null for position:fixed layers (e.g. the
         Avatar Editor's .palette-backdrop), so a visible fixed
         layer counts as open too. */
      if (el.offsetParent !== null || (cs && cs.position === 'fixed')) return;
    }
    if (window.location.pathname.indexOf('nv808') !== -1) return;
    var a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) { a.blur(); return; }
    goBack();
  });

  function init() {
    /* Ticker + palette are shared modules; load them if the page did not
       include them directly (the shell still works if they are present).
       Phase 1 (Nov 13, 2026): pages with data-nv-no-ticker on <html>
       (the Gigas Garden game frame; My Room) get NO ticker — this module
       does not load nv-ticker.js there at all, and nv-ticker.js itself
       also refuses to render on those routes. The element is removed,
       never created — not hidden, and no replacement strip is added.
       The dock and the palette still load as normal. */
    if (!document.documentElement.hasAttribute('data-nv-no-ticker')) {
      ensureScript(base + 'nv-ticker.js', '__nvTickerLoaded');
    }
    ensureScript(base + 'nv-commands.js', '__nvCommandsLoaded');
    applyA11yPrefs();
    mountWireframe();
    mountDock();
    mountBack();
    mountToastRegion();
    mountSrStatus();
  }

  /* Back-only mode (Nov 22, 2026): pages that are not full shell
     pages (Options, Privacy, Terms, Avatar Editor) set
     data-nv-shell="back-only" on <html> and get just the back
     control and the toast region — no ticker, palette, dock or
     wireframe. */
  function initBackOnly() {
    applyA11yPrefs();
    mountBack();
    mountToastRegion();
    mountSrStatus();
  }

  window.Infinity6Shell = { mountDock: mountDock, mountWireframe: mountWireframe, mountBack: mountBack, goBack: goBack, mountToastRegion: mountToastRegion, toast: window.NVToast, mountSrStatus: mountSrStatus, announce: window.NVAnnounce, applyA11yPrefs: applyA11yPrefs };
  var startShell = document.documentElement.getAttribute('data-nv-shell') === 'back-only' ? initBackOnly : init;
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', startShell); }
  else { startShell(); }
})();
