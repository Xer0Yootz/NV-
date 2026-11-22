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
    mountWireframe();
    mountDock();
  }

  window.Infinity6Shell = { mountDock: mountDock, mountWireframe: mountWireframe };
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
