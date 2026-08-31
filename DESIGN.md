# Design — billyfrazier.is v2 (LISA homage)

One non-scrolling 100dvh page, closely modeled on lisa.locomotive.ca/en.
Supersedes v1's long-scroll design (annamackenzie.com reference): no contact form
(mailto + copy-email instead), no RSS feeds, no scroll. All PRD goals served by
the four chips.

## Tokens ([src/styles/global.css](src/styles/global.css))
- `--color` #000 on `--color-bg` #fff; accent `#312DFB` (focus rings, progress
  tick, hovers ONLY).
- Studio backdrop: CSS radial gradient `#f2f2f2 → #d9d9d9` on `.stage`; the
  WebGL canvas renders transparent on top.
- Type: 17px base, headline 1.733rem/700. Font stack intentionally starts with
  `"HelveticaNowDisplay"` and falls back to system Helvetica/Arial — **do not
  add a webfont**; the fallback IS the design (we don't license Helvetica Now).
- Grid margin 2.667rem, header 4rem, borders 2px.

## Layout
Header: name left · ✳ glyph center · "Let's talk" (mailto) right. Left column
vertically centered: blurred intro line (blur 0.8px — keep ≤1px for a11y),
typed headline with blinking block cursor, four white pill chips, follow-up
chips appear under a reply. Bottom-left: circular reset ↺ + 160×2px progress
bar (blue while the GLB loads, black for typing progress). Bottom-right slot:
"Enable motion" chip (iOS tilt permission) — the reference's sound controls
live there; we ship no sound. Mobile ≤720px: column drops to the lower third,
bust recenters/scales 0.85.

## 3D scene ([src/scripts/scene.js](src/scripts/scene.js))
- **Square-on rule:** camera and bust share x=0 (dead-on perspective); the
  right-of-center placement comes from a CSS `translateX(14vw)` on the canvas
  (desktop only). Never re-angle the camera to move the figure — that was the
  original "he looks angled left" bug.
- Pose calibration: `BODY_YAW` 0.1 squares the mesh's baked lean; head bone rest
  offset 0. Tunable at runtime via `?bodyyaw=` `?headyaw=` `?neck0=` `?neck1=`
  `?model=` (dev affordances).
- Model: Meshy multi_image_to_3d from hi-res crops, 100k polys, meshopt+webp
  2048px (1.5MB). Raw candidates and rejects live in assets/models-raw/
  (gitignored). **Optimize with `--simplify false`** — the default simplify pass
  facets the silhouette and hairline; the size win isn't worth the jagged edges.
- three.js, lazy chunk imported one frame after first paint (the static shell
  is the loading state). Camera 35°, bust pivot at x+0.55 (desktop) looking at
  x=0 so the figure sits right-of-center, chest cropped by the viewport bottom.
- Placeholder grey figure ships until `public/models/billy-bust.glb` exists;
  flip `hasBust` in index.astro when it lands. GLB is normalized at runtime
  (Box3 recenter + scale to 1.6 units).
- Lighting: hemisphere + key + rim (neutral studio). Loop pauses on hidden tab.

## Blink ([src/scripts/blink.js](src/scripts/blink.js))
The scan has no eyelids, no blendshapes, and a shattered UV atlas — nothing to
"close". The blink squashes the eye-aperture vertices vertically toward a line
just below each pupil for ~150ms, every 5–7s. Eye centres are **measured
constants** tied to the current GLB; replacing the model means re-measuring.
How: load the site, then in the console raycast through each pupil with
`__bfDbg` (`{THREE, camera}`) against `__bfMesh`, converting hits with
`mesh.worldToLocal`. Verify coverage by tinting the selected vertices before
trusting it — an off-centre selection closes the brow, not the eye. Debug
handles: `__bfDbg`, `__bfMesh`, `__bfBlink` (`.apply(1)` holds eyes shut),
`__bfState`, `__bfFrames`.

## Motion ([src/scripts/controls.js](src/scripts/controls.js))
One damped {yaw,pitch}; rest pose glances toward the text (yaw −0.15). Desktop
= cursor; touch = DeviceOrientation (iOS permission chip), else drag + slow
idle sway. `prefers-reduced-motion`: static ¾ pose, no loop, instant typing.

## Verification
Headless one-shot Chrome is unreliable for this page (virtual-time kills large
module fetches; capture races the scene chunk). Use Playwright via
`scratchpad/verify.mjs`-style scripts (channel: 'chrome'), real mouse moves,
`window.__bfState` / `window.__bfFrames` test handles. Dev-only pages
`/dev/pointer-test` (+`?instant`, `#tl…#br`, `?chip=book`) and
`/dev/mobile-frame` build only when `PUBLIC_DEV_PAGES=1`.
