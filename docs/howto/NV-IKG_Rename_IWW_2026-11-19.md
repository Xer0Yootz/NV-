# How-to: IWW name removed from the NV- hub (IKG only), Nov 19 2026

## What changed and why
User ordered every IWW reference replaced with IKG (Intergalactic Kyber Grid). The hub's visible labels already said iKG. Two hidden leftovers still accepted the old name:
1. `hub.html`: the terminal command `load iww` was a leftover alias for the game. It is removed. `load ikg` and `load gigas` still work.
2. `nv-commands.js`: the Command K search no longer matches the word "iww". Searching "ikg" or "gigas" still finds the game.

Not changed (waiting on User's ruling): the dated rename-history notes in `SHELL.md` line 38 and the code comment in `nv-commands.js` line 28 say the old name was IWW. They are kept for now as a record of the rename.

## How to test (phone and desktop)
1. Open the hub page from this pull request's preview, or neonvigil.app after merge.
2. Open the terminal and type `load ikg`. The Gigas Garden game should open.
3. Type `load iww`. It should no longer open the game.
4. Press Command K (on a phone, tap the command button), type `ikg`. The game entry should appear.

## How to undo
On GitHub, open this pull request and click Revert, or don't merge it.

## Steps only User can do
Review and merge the pull request on GitHub.
