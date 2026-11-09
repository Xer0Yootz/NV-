# Settings flow — PR how-to (for Jasmine's review)

Branch: `settings-flow-2026-11-08` → `main`, 3 commits, 5 files, +167/−46. No rebuild — this is the approved panel from the voice call, exactly as built.

## The three commits

- **e59fa9d — Guided Settings flow.** Settings → Profile Settings → Avatar Settings. Profile Settings is the first stop, Avatar Settings is where the editor lives. Nothing standalone, nothing called "Aniimo".
- **cfd7b5a — Settings round 2.** Blinking cursor sits right after the word "username" — inline invisible input, no box. One Save only, a floppy-disk symbol, sitting next to the Sign Out symbol, in one row under the username line. No boxes or cards around any of the controls — flat terminal styling. Symbiont base picker: three sigils — Hexa cyan, Cyphr indigo, Helix yellow. Same hexagon shape, only the glow colour differs.
- **c2f4574 — Hub welcome + Sound Bed.** The welcome types out on load: "Welcome aboard the Infinity Six". The help hint ("type help for commands") shows when you click into the command center. Sound Bed controls sit all the way to the right, and nothing on them says "radio".

## What this is NOT

- The sigils are symbiont bases (Hexa / Cyphr / Helix) — NOT character selectors, NOT Val, and NOT audio / display / garden settings.
- No rebuild of the panel from guesses. The two rebuild proposals from the other Muse chat do not match this panel and are not authorized.

## How to review it

1. Check out the branch, open Settings and the hub.
2. Settings: cursor right after "username", no box; one floppy-disk Save next to the Sign Out symbol; three sigils in cyan / indigo / yellow.
3. Hub: "Welcome aboard the Infinity Six" types out; click the command center and the help hint shows; Sound Bed is far right with no "radio" label.
4. Nothing else on the page should have changed — ticker, greeting, and Avatar Editor in Settings are from the audit-fixes merge already live on main.

## Merge

Merge to `main` when approved. Cloudflare Pages redeploys from main automatically.
