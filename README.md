# FDC Café Hub — V1 wedge

First slice of the Café Hub: Today, Operations (opening/closing checklists + HACCP), and Coffee (espresso dial-in).

## Setup

```
npm install
npm run dev
```

## Deploy (mirrors the Roast Hub pattern)

1. Create a new GitHub repo, e.g. `fdc-cafe-hub` (github.com/firstdraftcoffee-cpu).
2. Clone it locally (e.g. `Desktop\fdc-cafe-hub`), copy these files in, `git add . && git commit -m "Initial Café Hub wedge" && git push`.
3. In Cloudflare Pages, connect the new GitHub repo. Build command `npm run build`, output directory `dist`.
4. Site goes live at `fdc-cafe-hub.pages.dev` (or similar).

## What's built (V1 wedge)

- **Today** — exception-first status screen: needs-attention panel, opening/closing progress, HACCP snapshot, latest coffee dial-in.
- **Operations → Opening / Closing** — the full checklists from the spec, tap to mark complete / issue / n/a, resets daily.
- **Operations → HACCP** — fridge/display temperature logging against target ranges, with a corrective-action workflow when a reading falls outside range (never silently disappears).
- **Coffee** — today's coffee card, dial-in logging (dose/yield/time/taste), dial-in history.

Data currently persists to the browser's local storage only (no backend yet) — fine for testing on one device, but it won't sync across devices or survive a browser data wipe. Cloud sync (same Worker + D1 pattern as Roast Hub) is the natural next step once this wedge feels right in daily use.

## Not built yet (by design — see the phased roadmap)

Stock, Money (cash/COGS), Team, and multi-location support. Deliberately left out of the wedge so the HACCP + coffee-quality combination — the actual market gap — gets proven first.
