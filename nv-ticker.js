/* nv-ticker.js — Shared ticker for the Neon Vigil web app.
   Infinity 6 Terminal / Hex OS. One module; the hub ticker, extracted whole
   (time + date + location + weather + tides). Full width across the entire
   top, 30s seamless scroll once location is accepted and the content is real.
   Before location resolves it sits still — it never scrolls empty/loading
   content. Location chain: browser location → IP fallback → Oakland default.
   Weather: Open-Meteo. Tides: NOAA (nearest Bay station). Weather/tides
   refresh every 15 min; clock every 1s. This module creates its own DOM —
   pages only include nv-ticker.css + this file. Safe to include once per
   page; a second include is a no-op. */
(function () {
  if (window.__nvTickerLoaded) return;
  window.__nvTickerLoaded = true;

  /* Phase 1 (Nov 13, 2026) — ticker REMOVAL routes. The game (Gigas Garden
     frame page) and My Room get no ticker at all: this module returns
     before any element is created, so no .ticker node ever exists on
     those routes (removal, not hidden text, and no replacement strip).
     A page opts out with data-nv-no-ticker on <html>; the game path is
     also matched directly so the frame page is covered even if its
     attribute is lost in a later edit. nv-shell.js mirrors this check
     and refuses to load this module on opted-out pages. */
  var NV_NO_TICKER_PATHS = ['/gigas-garden'];
  var nvPath = (window.location && window.location.pathname) || '';
  var nvNoTicker = document.documentElement.hasAttribute('data-nv-no-ticker');
  for (var nvI = 0; nvI < NV_NO_TICKER_PATHS.length && !nvNoTicker; nvI++) {
    var nvP = NV_NO_TICKER_PATHS[nvI];
    if (nvPath === nvP || nvPath.indexOf(nvP + '/') === 0) nvNoTicker = true;
  }
  if (nvNoTicker) return;

  var tickerState = { weather: 'WEATHER STANDBY', place: '', tides: 'TIDES STANDBY', coords: null, requested: false };
  function tickerLocale() { return (navigator.languages && navigator.languages[0]) || navigator.language || 'en-US'; }
  function tickerDateTime() {
    var d = new Date(), loc = tickerLocale();
    var date = d.toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
    var time = d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    return date + ' · ' + time;
  }
  var WMO = [[0, 'CLEAR'], [1, 'MOSTLY CLEAR'], [2, 'PARTLY CLOUDY'], [3, 'OVERCAST'], [48, 'FOG'], [57, 'DRIZZLE'], [67, 'RAIN'], [77, 'SNOW'], [82, 'SHOWERS'], [86, 'SNOW SHOWERS'], [99, 'THUNDERSTORM']];
  function wxCondition(code) { for (var i = 0; i < WMO.length; i++) if (code <= WMO[i][0]) return WMO[i][1]; return 'SKY UNKNOWN'; }
  function useFahrenheit() {
    var region = '';
    try { region = new Intl.Locale(tickerLocale()).maximize().region || ''; } catch (e) { region = (tickerLocale().split('-')[1] || '').toUpperCase(); }
    return ['US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'PW', 'FM', 'MH'].indexOf(region) !== -1;
  }
  function renderTicker() {
    var el = document.getElementById('tickerInfo');
    if (!el) return;
    var parts = [tickerDateTime(), tickerState.place || 'LOCATION —', tickerState.weather, tickerState.tides];
    /* Trailing delimiter: the ticker loops two identical copies for the
       seamless scroll, so each copy ends with ' · ' — otherwise the seam
       reads "TIDES STANDBY SUN 8 NOV…" back-to-back with no delimiter
       (audit fix, Nov 8, 2026). */
    var text = parts.join(' · ') + ' · ';
    el.textContent = text;
    var el2 = document.getElementById('tickerInfo2');
    if (el2) el2.textContent = text;
  }
  function fetchWeatherAndTides() {
    var c = tickerState.coords;
    if (!c) return;
    var f = useFahrenheit();
    var lat = c.latitude.toFixed(3), lon = c.longitude.toFixed(3);
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,weather_code&temperature_unit=' + (f ? 'fahrenheit' : 'celsius'))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var cur = d && d.current;
        if (!cur || typeof cur.temperature_2m !== 'number') throw new Error('no weather');
        tickerState.weather = Math.round(cur.temperature_2m) + '°' + (f ? 'F' : 'C') + ' ' + wxCondition(cur.weather_code);
        renderTicker();
      }).catch(function () { tickerState.weather = 'WEATHER OFFLINE'; renderTicker(); });
    if (!tickerState.place) {
      fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lon + '&localityLanguage=' + encodeURIComponent(tickerLocale().split('-')[0] || 'en'))
        .then(function (r) { return r.json(); })
        .then(function (g) { var nm = g.city || g.locality || g.principalSubdivision || ''; if (nm) { tickerState.place = String(nm).toUpperCase(); renderTicker(); } })
        .catch(function () {});
    }
    /* Tides: NOAA station list is a 2 MB download, so use the Bay stations and pick the nearest. */
    var BAY_STATIONS = [
      { id: '9414290', lat: 37.8063, lon: -122.4659 },
      { id: '9414750', lat: 37.7717, lon: -122.3017 },
      { id: '9414863', lat: 37.9197, lon: -122.4000 },
      { id: '9415144', lat: 38.0480, lon: -122.0380 }
    ];
    var best = BAY_STATIONS[0], bestD = Infinity;
    BAY_STATIONS.forEach(function (s) {
      var dd = (s.lat - parseFloat(lat)) * (s.lat - parseFloat(lat)) + (s.lon - parseFloat(lon)) * (s.lon - parseFloat(lon));
      if (dd < bestD) { bestD = dd; best = s; }
    });
    fetch('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=today&range=24&station=' + best.id + '&product=predictions&datum=MLLW&time_zone=lst_ldt&interval=hilo&units=english&format=json')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var now = new Date(), next = null;
        (d.predictions || []).forEach(function (pr) {
          var tt = new Date(pr.t.replace(' ', 'T'));
          if (tt > now && !next) next = { type: pr.type, t: tt };
        });
        tickerState.tides = next ? ('TIDE ' + (next.type === 'H' ? 'HIGH' : 'LOW') + ' ' + next.t.toLocaleTimeString(tickerLocale(), { hour: 'numeric', minute: '2-digit' })) : 'TIDES —';
        renderTicker();
      }).catch(function () { tickerState.tides = 'TIDES OFFLINE'; renderTicker(); });
  }
  function useCoords(lat, lon, place) {
    tickerState.coords = { latitude: lat, longitude: lon };
    if (place) tickerState.place = String(place).toUpperCase();
    /* Location accepted (browser, IP fallback, or Oakland default) — the
       ticker now has real time/date/location/weather/tides to show, so
       start it scrolling across the top. Before this it sits still. */
    var ticker = document.querySelector('.ticker');
    if (ticker) ticker.classList.add('scrolling');
    fetchWeatherAndTides();
    setInterval(fetchWeatherAndTides, 15 * 60 * 1000);
  }
  function requestTickerLocation() {
    if (tickerState.requested) return; tickerState.requested = true;
    function fallback() {
      /* Browser location blocked or timed out: try IP location, then Oakland as home default. */
      fetch('https://ipwho.is/')
        .then(function (r) { return r.json(); })
        .then(function (g) {
          if (g && g.success && g.latitude && g.longitude) useCoords(g.latitude, g.longitude, g.city || '');
          else useCoords(37.8207, -122.2716, 'Oakland');
        })
        .catch(function () { useCoords(37.8207, -122.2716, 'Oakland'); });
    }
    try {
      if (!navigator.geolocation || !window.fetch) { fallback(); return; }
      var done = false;
      var hard = setTimeout(function () { if (!done) { done = true; fallback(); } }, 8000);
      navigator.geolocation.getCurrentPosition(function (pos) {
        if (done) return; done = true; clearTimeout(hard);
        useCoords(pos.coords.latitude, pos.coords.longitude, '');
      }, function () {
        if (done) return; done = true; clearTimeout(hard); fallback();
      }, { enableHighAccuracy: false, timeout: 7000, maximumAge: 15 * 60 * 1000 });
    } catch (e) { fallback(); }
  }
  function init() {
    var ticker = document.createElement('div');
    ticker.className = 'ticker';
    ticker.innerHTML = '<div class="ticker-track"><span id="tickerInfo">LOADING TIME · DATE · LOCATION · WEATHER · TIDES</span><span id="tickerInfo2" aria-hidden="true">LOADING TIME · DATE · LOCATION · WEATHER · TIDES</span></div>';
    document.body.insertBefore(ticker, document.body.firstChild);
    renderTicker();
    setInterval(renderTicker, 1000);
    requestTickerLocation();
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
