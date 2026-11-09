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
   The dock radio is the shared implementation: the same three Sound Beds as
   the hub (default Sound Bed 3), the same first-tap autoplay, and the same
   cookie-lock guard (no playback while body.cookie-locked). Safe to include
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
    '/sounds/neon-vigil-sound-bed-3-loop.wav'
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
      '<span class="nv-shell-dock-cell"><span>Radio: ' +
      '<button type="button" id="nvShellRadioBtn" class="nv-shell-radio-btn" aria-label="Play Sound Bed 3" title="Play Sound Bed 3">' + PLAY_SVG + '</button> ' +
      '<select id="nvShellStationSelect" aria-label="Radio station">' +
      '<option value="0">Sound Bed 1</option>' +
      '<option value="1">Sound Bed 2</option>' +
      '<option value="2" selected>Sound Bed 3</option>' +
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
    function stationName() { return sel.options[sel.selectedIndex].text; }
    function sync() {
      var playing = !audio.paused;
      btn.innerHTML = playing ? STOP_SVG : PLAY_SVG;
      btn.setAttribute('aria-label', (playing ? 'Stop ' : 'Play ') + stationName());
      btn.setAttribute('title', (playing ? 'Stop ' : 'Play ') + stationName());
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

  function init() {
    /* Ticker + palette are shared modules; load them if the page did not
       include them directly (the shell still works if they are present). */
    ensureScript(base + 'nv-ticker.js', '__nvTickerLoaded');
    ensureScript(base + 'nv-commands.js', '__nvCommandsLoaded');
    mountDock();
  }

  window.Infinity6Shell = { mountDock: mountDock };
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
