# Design — billyfrazier.is v2 (LISA homage)

One non-scrolling 100dvh page, closely modeled on lisa.locomotive.ca/en.
Supersedes v1's long-scroll design (annamackenzie.com reference): no contact form
(mailto + copy-email instead), no RSS feeds, no scroll. All PRD goals served by
the four chips.

## Tokens ([src/styles/global.css](src/styles/global.css))
- `--color` #000 on `--color-bg` #fff; accent `#312DFB` (focus rings, progress
  tick, hovers ONLY). Reply chips hover/active to #e6e6e6; only the CTA chips
  (`.chip--cta`) are black, at rest and hovered.
- Studio backdrop: CSS radial gradient `#f2f2f2 → #d9d9d9` on `.stage`; the
  WebGL canvas renders transparent on top.
- Type: 17px base, headline 1.733rem/700. Font stack intentionally starts with
  `"HelveticaNowDisplay"` and falls back to system Helvetica/Arial — **do not
  add a webfont**; the fallback IS the design (we don't license Helvetica Now).
- Grid margin 2.667rem, header 4rem, borders 2px.

## Layout
Header: logo left (public/logo.svg — two black tags), nothing right for now
(the hamburger for separate pages was removed 2026-09-02; it's in git history
at 0421fef when pages arrive). Left column
vertically centered: blurred intro line (blur 0.8px — keep ≤1px for a11y),
typed headline with blinking block cursor, five white pill chips (the fifth,
"Grab coffee with me", is a reply like the others: he holds a to-go cup, the
headline asks about enabling his coffee addiction, and a black "Book coffee"
CTA goes to Calendly), follow-up chips appear under a reply. Bottom-left: circular reset ↺ + 160×2px progress
bar (blue while the GLB loads, black for typing progress). Bottom-right slot:
"Enable motion" chip (iOS tilt permission) — the reference's sound controls
live there; we ship no sound. Mobile ≤720px: the text moves into a solid white sheet pinned to the bottom
with a rounded top edge (no translucent scrim over the face). The sheet is a
fixed 54svh (svh, not dvh: Safari's collapsing toolbar would grow it as you
scroll) and scrolls inside — a long reply never pushes it up over him. A
sticky white gradient (`.col::after`) fades overflowing content out above the
fixed reset/motion controls instead of letting it run under them.
The bust is framed in the clear space above it, the reset button becomes a filled black circle over
the sheet, and the progress bar becomes a hairline on the bottom edge — matching
the LISA reference.

## 3D scene ([src/scripts/scene.js](src/scripts/scene.js))
- **Square-on rule:** camera and bust share x=0 (dead-on perspective); the
  right-of-center placement comes from a CSS `translateX(14vw)` on the canvas
  (desktop only). Never re-angle the camera to move the figure — that was the
  original "he looks angled left" bug.
- Pose calibration: `BODY_YAW` 0.1 squares the mesh's baked lean; head bone rest
  offset 0. Tunable at runtime via `?bodyyaw=` `?headyaw=` `?neck0=` `?neck1=`
  `?model=` (dev affordances).
- Model: Meshy multi_image_to_3d from hi-res crops, 100k polys, meshopt+webp
  2048px (1.5MB). Its URL carries `?v=<content hash>` (computed in
  index.astro at build) so a regenerated file with the same name is never
  served from a browser's cache — the preload and the loader both use it. Raw candidates and rejects live in assets/models-raw/
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

## Figure + props — variation-2 ([props.js](src/scripts/props.js))
A rigged **full-body** model (public/models/billy-body.glb, 1.1MB) replaces the
bust. It has a real humanoid skeleton, so the cursor drives its `Head` bone
directly instead of the runtime two-bone hack the unrigged bust needed.
`?model=bust` still loads the old one.

Selecting a chip floats its object above his head like a plumbob — spinning
slowly, bobbing, riding his crown — and he glances up at it (`PROP_MODE`
'float', the default since 2026-09-03; `?props=hold` puts it in his hands and
poses him around it instead — both paths are kept because this has flipped
twice). "Learn how I can help" → a 16:9 slide (title, donut pie, bar graph, drawn to
a canvas, both faces); "Buy my book" → the book, cover out;
"Subscribe" → a notebook in the left hand, a pencil scribbling in the right;
"Subscribe" → a composition book (marbled cover drawn to a canvas, both
faces, black cloth spine); "Drop a quick line" →
the iPhone (a modelled one: titanium frame, drawn screen, camera plateau on
the back — it spins, so the back shows); "Grab coffee with me" → the to-go cup. Floating items are drawn
at 1.25× the figure's scale with 14 cm of air above the crown. Reset clears
it and he stays still (the shrug went 2026-09-03 — the reset should not move
him). In hold mode the poses (rig `POSES`) apply: cup and
phone in the right hand with a sip / talking nods, notebook in the left with
the pencil scribbling, book at the chest. All primitives except the
cover art. Two-handed props (laptop, book) sit *between the hands* — centred on their
midpoint, x-axis along right→left hand — so they are in the hands wherever a
pose lands them. One-handed props anchor to a hand bone, walk out from the wrist along the
forearm's line toward the fingers, and orient in the figure's frame (the
wrist's twist is whatever the scan gave it). There are no finger bones and the
hands are flat, so every object sits a few centimetres *in front of* the palm
(+z, toward the camera): the fingers then read as wrapped behind it, where an
object through the palm read as clipping. Real sizes in metres, scaled with
the figure.

Framing: full body on desktop; phones crop to the upper body and cap the text
sheet at 62dvh. Tunables: `?busty=` `?busts=` `?moby=` `?mobs=`; `?pose=laptop`
(or book / notebook / phone) lands him in that pose on load, for tuning.

**Model provenance (v7):** Higgsfield/Meshy multi_image_to_3d, a-pose, rigged,
from three inputs built by [tools/model/matte.mjs](tools/model/matte.mjs) —
a hand-matted frontal cutout of Billy alone (cover painted out) *first*, the
3/4 standing photo second, the portrait third. That order is the whole trick:
Meshy takes the subject extent and the face from the first image (see the
tools README for the six runs that established it). The scan is then
repaired and packed by the same tools: red bleed pulled out of the jeans,
emissive `0.28` / specular `1` instead of the generator's fully self-lit
material, webp q72 at 2048, simplified 0.45 (invisible at render scale).
1.1 MB, 103k → 47k tris, 26 joints (24 from the scan + a knuckle bone per
hand). `BODY_TILT` is 0 for this scan (v2 gazed up and
needed +0.13). `?model=bust` still loads the old head-and-shoulders model.

v2 — the previous model, built from the launch photo where he holds the book —
is retired: its cover had to be painted off the tee, and its book-holding
hands were fused into the torso, so once the arms hung at his sides a second
pair of hands showed at his waist.

Blink is disabled. The eye coordinates in blink.js were measured against the
bust, and this mesh is skinned: its geometry lives in a tiny bind space, so
re-measuring means selecting the eyes in skinned space and mapping the squash
back through the head bone's inverse bind matrix.

## Motion ([src/scripts/controls.js](src/scripts/controls.js))
One damped {yaw,pitch}; rest pose glances toward the text (yaw −0.15). Desktop
= cursor; touch = DeviceOrientation (iOS permission chip), else drag + slow
idle sway. `prefers-reduced-motion`: static ¾ pose, no loop, instant typing.

On desktop, scene.js registers its own `pointermove` *after* controls', and
overwrites that straight screen-to-angle map with a real aim: the pointer is
unprojected onto a plane a metre in front of his head, and the direction from
head to that point becomes yaw/pitch in his own frame. So he tracks the cursor
rather than leaning with it — point at his head and he looks back at you.
Because the canvas is CSS-shifted (`translateX(14vw)`), NDC must come from the
canvas rect, not the window. If there is no head bone (the placeholder figure)
the override bails and controls' simpler mapping stands.

`HEAD_REST_YAW` counters a head-turn baked into the **bust** mesh and is not
applied to the rig — the aim above is already in his frame, so adding it just
skews his gaze off you.

## Performance rig ([src/scripts/rig.js](src/scripts/rig.js))
The full-body GLB has a real 24-bone humanoid skeleton
(Hips → Spine02 → Spine01 → Spine → neck → Head, plus arms and legs — note the
spine numbering runs *upward from* Spine02). rig.js drives it procedurally;
there are no baked clips. Every layer writes additive euler offsets that get
composed onto the captured rest pose each frame:

- **breath** — the chest leads, the head rides on it (~1.15 rad/s)
- **weight shift** — two slow sines on the hips so the cycle never obviously
  repeats, counter-rotated up the spine to keep his head level
- **look** — shared out along the chain (Head 49%, neck 24%, Spine 13%,
  Spine01 9%, Spine02 5%) with a little roll. Spreading it is what stops him
  reading like an owl bolted to a turntable.
- **idle gaze drift** — left alone for ~2.5s he starts glancing off and back
  instead of staring
- **poses** — `POSES` in rig.js: per pose, a direction for each upper arm and
  each forearm plus a head pitch/roll, and a forearm `twist` (radians about
  the bone's own length). At rest the twist is −0.8: the A-pose scan has the
  palms facing out, this rolls them in to the thighs. `?twist=` tunes it.
  Each pose also sets a finger `curl` (radians on the knuckle bones that
  tools/model/fingers adds — the scan has none): 0 at rest — the scan's own
  hands, by request; 2.2 was a fist, 1.35 hooked the tips — and 1.0 around
  the cup in hold mode. `?curl=` tunes the rest value. Chips blend to the matching pose
  (~0.4s, from wherever he currently is); reset blends back to `hang`. While
  holding something he keeps most of his attention on it (the cursor look is
  damped) and does busywork — typing, scribbling, talking nods, eyes across
  the page — so the pose never freezes.
- **reactions** — one-shots: `nod` `recoil` `shrug`. A pose change cancels
  any in flight. (The wave was removed 2026-09-02 at Billy's request.)

Triggers: hovering him nods (a window-level ray/box test — the canvas takes no
pointer events, sitting behind the text column); clicking him recoils; reset
shrugs.

**Axis map, measured against this rig** (poke a bone and look — there is no
convention to rely on): `Head.x` negative looks up, `Head.y` positive turns to
his left, `Head.z` positive tilts toward his right shoulder;
`RightForeArm.x` negative bends the elbow up. Debug handle: `__bfRig`.

**The arms are aimed, not rotated — both joints.** Their local axes are
tilted, so a single-axis euler sweeps a cone (`RightArm.x` looked like it
lowered the arm from the front but was actually swinging it 45° *behind* him).
`aimBone` points a bone along a direction in the figure's frame (his right −x,
up +y, forward +z) every frame, solved against the bone's rest rotation so the
artist's twist survives and only the swing changes; parents are refreshed
first, so the forearm aims correctly whatever the upper arm just did. That is
what gives him elbows — the old single-joint wave was a stiff lever from the
shoulder with the torso leaning to help. The other half of "arms stuck to the
torso" was the scan's skin weights: the auto-rig gave the upper-arm bone a
wedge of the jacket's side, so the jacket rose with the arm. Repaired by rule
in tools/model (`fixweights`); what remains is the armpit itself, a closed
surface a scan cannot articulate, so the wave keeps the upper arm just under
horizontal and lets the forearm do the waving. Directions blend (lerp + normalise)
rather than quaternions slerping, so poses are plain numbers to tune. This all
survives a model swap untouched.

## Verification
Headless one-shot Chrome is unreliable for this page (virtual-time kills large
module fetches; capture races the scene chunk). Use Playwright via
`scratchpad/verify.mjs`-style scripts (channel: 'chrome'), real mouse moves,
`window.__bfState` / `window.__bfFrames` test handles. Dev-only pages
`/dev/pointer-test` (+`?instant`, `#tl…#br`, `?chip=book`) and
`/dev/mobile-frame` build only when `PUBLIC_DEV_PAGES=1`.
