// node patchweights.mjs <in.glb> <dir with joints.bin/weights.bin> <out.glb>
import { NodeIO } from '@gltf-transform/core';
import { readFileSync } from 'node:fs';
const [inp, dir, out] = process.argv.slice(2);
const io = new NodeIO();
const doc = await io.read(inp);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
const joints = new Uint8Array(readFileSync(`${dir}/joints.bin`));
const weights = new Float32Array(new Uint8Array(readFileSync(`${dir}/weights.bin`)).buffer);
if (joints.length !== J.getCount() * 4) throw new Error('joint count mismatch ' + joints.length + ' vs ' + J.getCount() * 4);
J.setArray(joints); W.setArray(weights);
await io.write(out, doc);
console.log('wrote', out);
