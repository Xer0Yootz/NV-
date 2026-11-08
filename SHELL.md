# Infinity6Shell — shared App Shell (audit fix, Nov 8, 2026)

The Neon Vigil web app is static HTML — no build step — so the shell is three
shared files plus a module. Every signed-in page wires into the same shell:

**Include (in `<head>`):**
```html
<link rel="stylesheet" href="./nv-terminal-tokens.css">
<link rel="stylesheet" href="./nv-ticker.css">
<link rel="stylesheet" href="./nv-commands.css">
```
**Include (before `</body>`):**
```html
<script src="./nv-ticker.js"></script>
<script src="./nv-commands.js"></script>
<script src="./nv-shell.js"></script>
```
From a sub-folder (`/nv808/`, `/gridlog/`, `/aniimo/`, …) use `../` in place of
`./`. Add `class="nv-shell-page"` to `<body>` so the fixed ticker (top) and
the fixed dock (bottom) never cover page content. The hub does **not** use
`.nv-shell-page` and does **not** include `nv-shell.js` — its dock is inline
and its centred `.hub-col` already accounts for ticker + dock.

**What each file does:**
- `nv-terminal-tokens.css` — design tokens (obsidian/violet palette, VT323,
  1px borders) + the shell header wrapper (`.nv-shell-head`), the bottom
  Radio/Hexa dock (`.nv-shell-dock`), and the display-name field + buttons
  (`#nameInput`, `#saveNameBtn`, …).
- `nv-ticker.js` + `nv-ticker.css` — the shared top telemetry ticker (time,
  date, location, Open-Meteo weather, live NOAA tide). 14px, VT323. It sits
  still until location resolves, then scrolls seamlessly. "TIDES STANDBY" /
  "WEATHER STANDBY" are loading states only — the live tide replaces them
  once NOAA answers. The loop seam now ends each copy with a `·` delimiter
  so the repeat never reads back-to-back.
- `nv-commands.js` + `nv-commands.css` — the shared Cmd/Ctrl+K palette.
  Labels (locked): `Virtual IWW: Gigas Garden` (Jasmine's Nov 7 rename),
  `NV_Gigas Garden — Remix`, `NV_808`, `NV_Gridlog`, `NV-TV`, `Settings`,
  `Sign out`, plus `Aniimo` and `NV_Pet Pal` (added by this audit fix).
- `nv-shell.js` (`window.Infinity6Shell`) — injects the standard bottom dock
  (Radio with the three Sound Beds, default Bed 3, + Hexa/Commands button)
  when the page has no dock, and loads the ticker/palette modules if a page
  forgot them. The dock radio is the shared implementation — same stations,
  same first-tap autoplay, same cookie-lock guard as the hub.

**Routes (all same-origin, shell-preserving — nothing leaves the app shell
except through a wrapper page):**
- `/gigas-garden/` — shell wrapper; the game loads in a full-viewport iframe
  from `xer0yootz.github.io/neon-vigil-oauth/gigas-garden/` (GitHub Pages
  allows framing). Fallback link on the page if the frame cannot load.
- `/remix/` — shell wrapper; the Remix game loads in an iframe from
  `remix.gg/g/neon-vigil-gigas-garden`. **Framing by remix.gg is unverified**
  — if it blocks framing the page shows the shell + an "Open in Remix"
  link. Needs a live rendered check.
- `/gridlog/` — the Grid Log: the same five creature entries as the in-game
  log (`GRID_CREATURES`). Praxia is shown (unlocked by default in-game);
  the other four show `UNSYNCED SIGNAL` until synced in the Garden, exactly
  like the in-game modal. Syncing happens in the Garden — link on the page.
- `/aniimo/` — the Aniimo Avatar Editor console (test editor copy, Nov 8).
  Banner on the page still says PRIVATE TEST COPY — it is the test console,
  not the final Avatar Editing System.
- `/nv808/` — NV_808 (ticker + standard dock added; its own lone ⌘K button
  and Sound Bed 3 button were replaced by the shell dock).
- `/test-web-bible-neon-ultra` — Bible character-sheets test page (shell
  header wrapper + ticker + standard dock added).
- `/nv-tv.html` — NV-TV (shell header wrapper + ticker + standard dock
  added; still the blank water + static page — the fuller ts-space NV TV
  app is a separate port decision, not part of this fix).
- `/hub.html` — hub (name field + Save styled to the shell; terminal +
  palette routes updated to the shell-preserving destinations; header
  unchanged — "Infinity6 Terminal" stays inside the terminal box per the
  Nov 8 order; the typewriter re-types it on load, so a screenshot taken
  in the first ~0.4s can catch it mid-type — that is the "truncation" the
  audit saw, not a layout clip: no width/overflow rule truncates it).
- `/settings.html`, `/options.html` — name field styled to the shell;
  nav routes updated to the shell-preserving destinations.

**Not wired:** the main page (`/index.html`, the sign-in / coming-soon gate)
is excepted from the ticker lock and keeps its own "Hub Status" bar.
`/settings.html` and `/options.html` keep their `User:` label (the Nov 8
removal was hub-only) — flag if Jasmine wants it gone there too.

**Deploy (from Jasmine's Mac terminal only — never from here):**
```bash
cd <NV- repo>
git checkout audit-fixes-2026-11-08
git status            # review the branch diff first
git push -u origin audit-fixes-2026-11-08
# then merge to main (GitHub web UI or: git checkout main && git merge audit-fixes-2026-11-08 && git push)
# Cloudflare Pages redeploys from main automatically; verify live afterwards.
```
