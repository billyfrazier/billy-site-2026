# billyfrazier.is (v2)

One-page LISA-style site: 3D Billy bust that follows your cursor (tilt on
phones), typed chip replies. Astro + three.js. See [DESIGN.md](DESIGN.md),
[PRD.md](PRD.md), [PRODUCT.md](PRODUCT.md).

## Billy's two setup jobs
1. **Photos** — drop the two photos (tight portrait + event photo) into
   `assets/source-photos/`. They feed the AI 3D-bust generation; until then the
   site shows a placeholder figure.
2. **Deploy login (Terminal):** `npx vercel login` once. After that deploys are
   scripted (`npx vercel link --yes --project billy-site-2026 && npx vercel --prod`).
   The Vercel project is currently paused; it gets unpaused at first v2 deploy.

## Commands (Terminal)
| Command | What |
|---|---|
| `npm run dev` | dev server (localhost:4321) |
| `npm run build` | static build to `dist/` |
| `PUBLIC_DEV_PAGES=1 npm run build` | build incl. `/dev/*` test pages |
| `npm run preview` | serve the built site |

## Editing content
Chip reply copy: `src/scripts/typer.js` (marked EDIT ME). Email address
appears in typer.js and index.astro. Font: intentionally system Helvetica —
see DESIGN.md before "fixing".

## Phone check (only thing that can't be tested headless)
On iOS: tap "Enable motion" (bottom-right) → grant → tilting the phone moves
the bust. Deny → it sways idly and responds to drag instead.
