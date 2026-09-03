// node addfingers.mjs <in.glb> <dir> <out.glb> — adds RightFingers/LeftFingers joints and the split weights
import { NodeIO } from '@gltf-transform/core';
import { readFileSync } from 'node:fs';
const [inp, dir, out] = process.argv.slice(2);
const io = new NodeIO();
const doc = await io.read(inp);
const root = doc.getRoot();
const skin = root.listSkins()[0];
const joints = skin.listJoints();
const ibmAcc = skin.getInverseBindMatrices();
const ibm = Array.from(ibmAcc.getArray());
for (const s of JSON.parse(readFileSync(`${dir}/fingers.json`, 'utf8'))) {
  const hand = joints[s.handIdx];
  const node = doc.createNode(s.name).setTranslation(s.translation);
  hand.addChild(node);
  skin.addJoint(node);
  ibm.push(...s.ibm);
  console.log(`added ${s.name} under ${hand.getName()} as joint ${skin.listJoints().length - 1}`);
}
ibmAcc.setArray(new Float32Array(ibm));
const prim = root.listMeshes()[0].listPrimitives()[0];
prim.getAttribute('JOINTS_0').setArray(new Uint8Array(readFileSync(`${dir}/fingers-joints.bin`)));
prim.getAttribute('WEIGHTS_0').setArray(new Float32Array(new Uint8Array(readFileSync(`${dir}/fingers-weights.bin`)).buffer));
await io.write(out, doc);
console.log('wrote', out);
