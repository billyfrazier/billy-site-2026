# Model repair pipeline

How `public/models/billy-body.glb` is produced. Current model: **v7**,
`assets/models-raw/billy-body-v7-raw.glb`, Higgsfield/Meshy `multi_image_to_3d`
(a-pose, rigged, 100k polys, 1.8 m) from three inputs made by `matte.mjs`.

**Input order matters more than anything else.** Meshy takes the subject extent
*and the face* from the first image. Seven runs taught this the expensive way:
body photo first → body fine, eyes shut (he looks down in that photo); portrait
first → a bust, no body; unmatted group photo first → all three people and the
bookshelf wall. The frontal cutout first (Billy alone, eyes open, cover painted
out), then the 3/4 body, then the portrait, produced v7.

**What it fixes** (steps 1–2 were built for v2, whose source photo still had
the cover; on v7 the cover step finds no seeds and skips itself)

1. **The book baked onto his tee.** Both source photos have him holding the
   yellow *Fumbling Forward* cover at his waist, and the generator paints it
   onto the torso. Recolouring the yellow (the first attempt) left a dark
   rectangle of the cover's type and shading behind. This repaints the whole
   footprint with the tee, sampled from the shirt around it.
2. **A red bleed on the black jeans.** The scan picked up warm light as
   saturated red streaks across otherwise black denim.
3. **Arm weights bleeding into the torso.** The auto-rig gives the upper-arm
   bone a wide wedge of the jacket's side, armpit to hip, so raising the arm
   drags the jacket up with it. `fixweights` hands any arm-bone weight that
   sits inside the torso column (|x| < 0.20) *and* more than 0.075 from the
   arm's axis to the nearest spine bone, with a soft edge on both tests. Paint
   the result before trusting it (`?weights=RightArm+RightForeArm+RightHand`
   in the harness viewer): the red must stop at the sleeve.
4. **A fully self-lit material.** The generator ships `emissiveFactor [1,1,1]`
   with the base colour as the emissive map, so the studio lights did nothing
   and he read flat. Now `0.28` — enough baked-in photographic light to keep
   the skin tones, little enough that the key light actually shapes him.

**Why it works in 3D and not in the texture**

The atlas is thousands of tiny islands, so nothing about it is spatially
coherent: neighbouring texels are unrelated surfaces. Every selection is
therefore made on *triangles in 3D* and only then rasterised to UV space.
For the same reason the mask edge must stay hard — feathering it means partial
alpha along every island boundary, which lets the original cover amber bleed
straight back through.

## Running it

```bash
npm i -D playwright-core                             # sharp is already a transitive dep
node tools/model/matte.mjs /tmp/m                    # the three generator inputs
#   → upload in that order to multi_image_to_3d, download the GLB to assets/models-raw/
npx @gltf-transform/cli copy assets/models-raw/billy-body-v7-raw.glb /tmp/m/body.gltf
node tools/model/serve.mjs &                         # port 4599
node tools/model/domask.mjs /assets/models-raw/billy-body-v7-raw.glb /tmp/m
node tools/model/fixtex.mjs /tmp/m/baseColor.png /tmp/m /tmp/m/fixed.png
node tools/model/fixweights.mjs /assets/models-raw/billy-body-v7-raw.glb /tmp/m     # → joints.bin, weights.bin
npm i -D @gltf-transform/core && node tools/model/patchweights.mjs assets/models-raw/billy-body-v7-raw.glb /tmp/m assets/models-raw/billy-body-v7-weights.glb
node tools/model/pack.mjs assets/models-raw/billy-body-v7-weights.glb public/models/billy-body.glb /tmp/m/fixed.png --simplify 0.45
```

`pack.mjs` sets the material factors (`emissiveFactor` `0.28`,
`specularColorFactor` `1` — the generator ships a non-physical `2`), encodes
the texture as webp q72, and meshopt-packs. `--simplify` is opt-in: the
*default* simplify pass facets the silhouette, but 0.45 at error 0.0004 is
invisible at render scale and takes the 103k-tri v7 from 1.5 MB to 1.1 MB.

Then set `BODY_TILT` in scene.js by eye (`?tilt=`): v2 needed +0.13, v7 stands
straight at 0.

## Checking it

Every threshold in here was tuned by looking, not by reasoning — the failure
modes are all visual (the mask eating the jacket, amber left in the seams,
denim flattened into a dead black). `mask.html` also emits `mask-bookzone.png`
and friends; composite one over the texture in a solid colour and render the
model before trusting a change.
