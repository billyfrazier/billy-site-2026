# Model repair pipeline

How `public/models/billy-body.glb` is produced from the generator's raw output.
Run it again if the figure is ever regenerated — the raw scan has the same two
problems every time, because both source photos show Billy holding something.

**What it fixes**

1. **The book baked onto his tee.** Both source photos have him holding the
   yellow *Fumbling Forward* cover at his waist, and the generator paints it
   onto the torso. Recolouring the yellow (the first attempt) left a dark
   rectangle of the cover's type and shading behind. This repaints the whole
   footprint with the tee, sampled from the shirt around it.
2. **A red bleed on the black jeans.** The scan picked up warm light as
   saturated red streaks across otherwise black denim.
3. **A fully self-lit material.** The generator ships `emissiveFactor [1,1,1]`
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
npm i -D playwright-core sharp                       # not shipped deps
npx @gltf-transform/cli copy assets/models-raw/billy-body-raw.glb /tmp/m/body.gltf
node tools/model/serve.mjs &                         # port 4599
node tools/model/domask.mjs /assets/models-raw/billy-body-raw.glb /tmp/m
node tools/model/fixtex.mjs /tmp/m/baseColor.png /tmp/m /tmp/m/fixed.png
```

Then re-encode the texture, point the glTF at it, set the material factors
(`emissiveFactor` `0.28`, `KHR_materials_specular.specularColorFactor` `1` —
the generator ships a non-physical `2`), and pack it:

```bash
npx sharp-cli -i /tmp/m/fixed.png -o /tmp/m/baseColor.webp --quality 72   # ~450KB
npx @gltf-transform/cli optimize /tmp/m/body.gltf public/models/billy-body.glb \
  --simplify false --texture-compress false --compress meshopt
```

`--simplify false` is not optional: the default pass facets the silhouette and
the hairline.

## Checking it

Every threshold in here was tuned by looking, not by reasoning — the failure
modes are all visual (the mask eating the jacket, amber left in the seams,
denim flattened into a dead black). `mask.html` also emits `mask-bookzone.png`
and friends; composite one over the texture in a solid colour and render the
model before trusting a change.
