/* গ্রহ — planet mesh, biomes, water, scattered props, sky.
   Everything is generated from code; there are no model files. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SECTIONS, PROPS, SECRETS } from './content.js';

export const R = 36;            // planet radius
export const WATER = -0.5;      // water surface, relative to R
const K = 0.065;                // radians per old map tile

/* ---------- old 2D map coordinates -> direction on the sphere ----------
   The hub (36,26) is the top of the planet; everything else keeps its
   compass bearing and distance from the hub. */
export function mapDir(tx, ty){
  const dx = tx - 36, dy = ty - 26, d = Math.hypot(dx, dy) * K, a = Math.atan2(dy, dx);
  return new THREE.Vector3(Math.sin(d) * Math.cos(a), Math.cos(d), Math.sin(d) * Math.sin(a));
}
export const HUB = new THREE.Vector3(0, 1, 0);
export const ANTI = new THREE.Vector3(0, -1, 0);
export const NODES = [...SECTIONS, ...PROPS, ...SECRETS];
NODES.forEach(n => { n.dir = mapDir(n.tx, n.ty); });
SECTIONS.forEach(n => { n.isSection = true; });
SECRETS.forEach(n => { n.isSecret = true; });

const POND = mapDir(13, 41.4);
const HILL = mapDir(36, 53);
export const SUN = new THREE.Vector3(1, 0.62, -0.35).normalize();

/* ---------- small maths ---------- */
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const ang = (a, b) => Math.acos(clamp(a.dot(b), -1, 1));
function hash3(x, y, z){
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
function noise3(x, y, z){
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  const h = (i, j, k) => hash3(xi + i, yi + j, zi + k);
  return L(L(L(h(0,0,0), h(1,0,0), u), L(h(0,1,0), h(1,1,0), u), v),
           L(L(h(0,0,1), h(1,0,1), u), L(h(0,1,1), h(1,1,1), u), v), w);
}
let seed = 20261;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };

/* ---------- roads: great-circle arcs from the hub to each section ---------- */
const ROADS = SECTIONS.map(s => ({ to: s.dir, n: new THREE.Vector3().crossVectors(HUB, s.dir).normalize(), len: ang(HUB, s.dir) }));
function roadDist(d){
  let best = 9;
  for (const r of ROADS){
    if (ang(d, HUB) > r.len + 0.02 || ang(d, r.to) > r.len + 0.02) continue;
    const x = Math.abs(Math.asin(clamp(d.dot(r.n), -1, 1)));
    if (x < best) best = x;
  }
  return best;
}
function riverBand(d){            // a C-shaped river round the far side
  const a = ang(d, ANTI); if (a < 0.44 || a > 0.72) return 0;
  const az = Math.atan2(d.z, d.x);
  const gap = sstep(0.35, 0.6, Math.PI - Math.abs(az));   // open towards -x
  return (1 - sstep(0.07, 0.13, Math.abs(a - 0.58))) * gap;
}

/* ---------- terrain height (relative to R) for any direction ---------- */
export function elev(d){
  let h = (noise3(d.x * 2.3 + 5, d.y * 2.3, d.z * 2.3) * 0.65 + noise3(d.x * 5.1, d.y * 5.1 + 9, d.z * 5.1) * 0.35) * 1.5 - 0.25;
  let flat = sstep(0.035, 0.1, roadDist(d));
  flat = Math.min(flat, sstep(0.22, 0.34, ang(d, HUB)));
  for (const n of NODES) flat = Math.min(flat, sstep(0.1, 0.2, ang(d, n.dir)));
  h *= flat;
  h += 3.6 * (1 - sstep(0.02, 0.16, ang(d, HILL)));
  h -= 2.4 * (1 - sstep(0.11, 0.19, ang(d, POND)));
  h -= 2.2 * riverBand(d);
  return h;
}

/* ---------- ground colour ---------- */
const BIOME = {
  shrine: { plaza: '#D8B87A', ground: '#7A7386', r: 0.24 },
  crater: { plaza: '#7A7386', ground: '#3A3350', r: 0.27 },
  metal:  { plaza: '#7A7386', ground: '#5E6B7E', r: 0.24 },
  garden: { plaza: '#548449', ground: '#D8B87A', r: 0.28 },
  forest: { plaza: '#3b5a3f', ground: '#2F4A34', r: 0.33 },
  pond:   { plaza: '#D8B87A', ground: '#D8B87A', r: 0.13 }
};
const C = (hex) => new THREE.Color(hex);
const col = { grass: C('#4E7D46'), grass2: C('#5c8f4f'), path: C('#A8804F'), sand: C('#D8B87A'), bed: C('#24566f'), rock: C('#6d6778') };
Object.values(BIOME).forEach(b => { b.plazaC = C(b.plaza); b.groundC = C(b.ground); });
export function biomeAt(d){
  for (const s of SECTIONS){ if (ang(d, s.dir) < BIOME[s.biome].r) return s.biome; }
  return null;
}
function groundColor(d, h, out){
  const j = hash3((d.x * 977) | 0, (d.y * 977) | 0, (d.z * 977) | 0);
  if (h < WATER + 0.05) out.copy(col.bed);
  else if (h < WATER + 0.42 || ang(d, ANTI) < 0.4) out.copy(col.sand);
  else if (roadDist(d) < 0.042 || ang(d, HUB) < 0.25) out.copy(col.path);
  else {
    out.copy(noise3(d.x * 4, d.y * 4, d.z * 4) > 0.5 ? col.grass : col.grass2);
    if (ang(d, HILL) < 0.15 && h > 1.2) out.copy(col.rock);
    for (const s of SECTIONS){
      const b = BIOME[s.biome], a = ang(d, s.dir) + (j - 0.5) * 0.05;
      if (a < 0.085) { out.copy(b.plazaC); break; }
      if (a < b.r) { out.copy(b.groundC); break; }
    }
  }
  out.multiplyScalar(0.9 + j * 0.2);
  return out;
}

/* ---------- toon materials ---------- */
const ramp = new THREE.DataTexture(new Uint8Array([95, 170, 255]), 3, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
export const toonMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
export const inkMat = new THREE.MeshBasicMaterial({ color: '#1B1226', side: THREE.BackSide });
export const glowMat = new THREE.MeshBasicMaterial({ color: '#FFD27A' });

/* ---------- geometry builder: coloured primitives merged into one mesh,
   plus a slightly swollen back-face copy that draws the dark outline ---------- */
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const sph = (r, detail = 1) => new THREE.IcosahedronGeometry(r, detail);
export const cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const cone = (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg);
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function M(x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0){
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}
const _col = new THREE.Color(), _bb = new THREE.Box3(), _c = new THREE.Vector3(), _sz = new THREE.Vector3();
export class Builder {
  constructor(ink = 0.05){ this.parts = []; this.lines = []; this.ink = ink; }
  add(geo, color, m, outline = true){
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    if (m) g.applyMatrix4(m);
    g.computeVertexNormals();
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    _col.set(color);
    for (let i = 0; i < n; i++){ a[i * 3] = _col.r; a[i * 3 + 1] = _col.g; a[i * 3 + 2] = _col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    this.parts.push(g);
    if (outline && this.ink){
      const o = g.clone(); o.deleteAttribute('color');
      _bb.setFromBufferAttribute(o.attributes.position); _bb.getCenter(_c); _bb.getSize(_sz);
      const t = this.ink * 2, f = (v) => (v > 1e-4 ? (v + t) / v : 1);
      o.translate(-_c.x, -_c.y, -_c.z).scale(f(_sz.x), f(_sz.y), f(_sz.z)).translate(_c.x, _c.y, _c.z);
      this.lines.push(o);
    }
    return this;
  }
  /* a straight limb between two points */
  limb(a, b, r, color, r2 = r){
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    const m = new THREE.Matrix4().compose(A.add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    return this.add(cyl(r2, r, len, 5), color, m);
  }
  geos(){ return { geo: mergeGeometries(this.parts), line: this.lines.length ? mergeGeometries(this.lines) : null }; }
  mesh(){
    const { geo, line } = this.geos(), g = new THREE.Group();
    g.add(new THREE.Mesh(geo, toonMat));
    if (line) g.add(new THREE.Mesh(line, inkMat));
    return g;
  }
  instanced(mats){
    const { geo, line } = this.geos(), g = new THREE.Group();
    const add = (ge, ma) => { const im = new THREE.InstancedMesh(ge, ma, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true; g.add(im); };
    add(geo, toonMat); if (line) add(line, inkMat);
    return g;
  }
}

/* ---------- placing things on the sphere ---------- */
const _x = new THREE.Vector3(), _z = new THREE.Vector3();
/* matrix standing at `dir`, with local +Z turned towards `face` */
export function standAt(dir, face, scale = 1, lift = 0){
  _z.copy(face).addScaledVector(dir, -face.dot(dir));
  if (_z.lengthSq() < 1e-6) _z.set(dir.y, dir.z, dir.x).addScaledVector(dir, -(dir.x * dir.y + dir.y * dir.z + dir.z * dir.x));
  _z.normalize(); _x.crossVectors(dir, _z);
  const m = new THREE.Matrix4().makeBasis(_x, dir, _z);
  m.scale(_s.set(scale, scale, scale));
  m.setPosition(_p.copy(dir).multiplyScalar(R + elev(dir) + lift));
  return m;
}
const randDir = () => { const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  return new THREE.Vector3(s * Math.cos(t), u, s * Math.sin(t)); };
/* step from `dir` towards `to` by `a` radians, then sideways by `side` */
export function offsetDir(dir, to, a, side = 0){
  const t = to.clone().addScaledVector(dir, -to.dot(dir)).normalize();
  const r = new THREE.Vector3().crossVectors(t, dir);
  return dir.clone().addScaledVector(t, Math.tan(a)).addScaledVector(r, Math.tan(side)).normalize();
}

/* obstacles the player cannot walk through: {d: direction, r: radius in units} */
export const obstacles = [];
export const block = (d, r) => obstacles.push({ d: d.clone(), c: Math.cos((r + 0.45) / R) });

/* ---------- build the world ---------- */
export function buildWorld(scene){
  const world = new THREE.Group(); scene.add(world);
  const anim = [];

  /* planet */
  const g = new THREE.IcosahedronGeometry(1, 44);
  const pos = g.attributes.position, colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3(), cen = new THREE.Vector3(), cc = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3){
    cen.set(0, 0, 0);
    for (let k = 0; k < 3; k++){ v.fromBufferAttribute(pos, i + k).normalize(); cen.add(v); }
    cen.normalize();
    groundColor(cen, elev(cen), cc);
    for (let k = 0; k < 3; k++){
      v.fromBufferAttribute(pos, i + k).normalize(); v.multiplyScalar(R + elev(v));
      pos.setXYZ(i + k, v.x, v.y, v.z);
      colors[(i + k) * 3] = cc.r; colors[(i + k) * 3 + 1] = cc.g; colors[(i + k) * 3 + 2] = cc.b;
    }
  }
  g.deleteAttribute('uv'); g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  world.add(new THREE.Mesh(g, toonMat));
  world.add(new THREE.Mesh(new THREE.IcosahedronGeometry(R + 0.75, 20), inkMat));      // silhouette line

  /* water */
  const water = new THREE.Mesh(new THREE.IcosahedronGeometry(R + WATER, 30),
    new THREE.MeshToonMaterial({ color: '#2E6C8E', gradientMap: ramp, transparent: true, opacity: 0.9 }));
  world.add(water);

  /* scatter: trees, pines, rocks, flowers */
  const tree = new Builder(0.06)
    .add(cyl(0.16, 0.24, 1.3, 5), '#6B4A2E', M(0, 0.65, 0))
    .add(sph(1.0, 0), '#3E7A38', M(0, 1.9, 0, 1, 0.95, 1))
    .add(sph(0.65, 0), '#4c8c44', M(0.45, 2.55, 0.2));
  const pine = new Builder(0.06)
    .add(cyl(0.14, 0.2, 1.0, 5), '#5a3f29', M(0, 0.5, 0))
    .add(cone(1.0, 1.5, 6), '#2F5C36', M(0, 1.5, 0))
    .add(cone(0.78, 1.3, 6), '#356a3d', M(0, 2.3, 0))
    .add(cone(0.5, 1.1, 6), '#3b7545', M(0, 3.05, 0));
  const rock = new Builder(0.05)
    .add(sph(0.6, 0), '#8A8296', M(0, 0.28, 0, 1.15, 0.75, 1))
    .add(sph(0.36, 0), '#A49CB0', M(0.5, 0.18, 0.25));
  const flowerA = new Builder(0).add(cyl(0.025, 0.025, 0.34, 4), '#2f5a2b', M(0, 0.17, 0)).add(sph(0.11, 0), '#F2B33D', M(0, 0.38, 0));
  const flowerB = new Builder(0).add(cyl(0.025, 0.025, 0.3, 4), '#2f5a2b', M(0, 0.15, 0)).add(sph(0.11, 0), '#E0574A', M(0, 0.34, 0));
  const tuft = new Builder(0).add(cone(0.1, 0.34, 3), '#6aa05a', M(0, 0.17, 0)).add(cone(0.08, 0.26, 3), '#5c8f4f', M(0.12, 0.13, 0.05));
  const lily = new Builder(0).add(cyl(0.32, 0.32, 0.04, 7), '#3f7a3a', M(0, 0, 0)).add(sph(0.1, 0), '#F0D7E4', M(0.05, 0.08, 0));

  const lists = { tree: [], pine: [], rock: [], flowerA: [], flowerB: [], tuft: [], lily: [] };
  const clear = (d) => roadDist(d) > 0.075 && ang(d, HUB) > 0.3 && !NODES.some(n => ang(d, n.dir) < 0.15);
  for (let i = 0; i < 5200; i++){
    const d = randDir(), h = elev(d), b = biomeAt(d), r = rnd(), face = randDir(), s = 0.75 + rnd() * 0.6;
    if (h < WATER + 0.05){ if (h < WATER - 0.5 && r > 0.9) lists.lily.push(standAt(d, face, s, WATER - h + 0.03)); continue; }
    if (h < WATER + 0.45 || !clear(d)) continue;
    if (ang(d, ANTI) < 0.4){ if (r > 0.97){ lists.rock.push(standAt(d, face, s * 0.7)); block(d, 0.5 * s); } continue; }
    if (b === 'forest'){
      if (r > 0.45){ lists.pine.push(standAt(d, face, s * 1.15)); block(d, 0.45); }
      else if (r > 0.38){ lists.rock.push(standAt(d, face, s)); block(d, 0.75 * s); }
    } else if (b === 'crater'){
      if (r > 0.86){ lists.rock.push(standAt(d, face, s * 1.2)); block(d, 0.85 * s); }
    } else if (b === 'metal' || b === 'shrine'){
      if (r > 0.95){ lists.rock.push(standAt(d, face, s)); block(d, 0.75 * s); }
    } else if (b === 'garden'){
      if (r > 0.93){ lists.tree.push(standAt(d, face, s)); block(d, 0.45); }
      else if (r > 0.5) (r > 0.72 ? lists.flowerA : lists.flowerB).push(standAt(d, face, s * 1.3));
    } else if (b !== 'pond'){
      if (r > 0.9){ lists.tree.push(standAt(d, face, s * 1.1)); block(d, 0.45); }
      else if (r > 0.865){ lists.rock.push(standAt(d, face, s)); block(d, 0.75 * s); }
      else if (r > 0.6) (r > 0.73 ? lists.flowerA : lists.flowerB).push(standAt(d, face, s));
      else if (r > 0.25) lists.tuft.push(standAt(d, face, s));
    }
  }
  const kinds = { tree, pine, rock, flowerA, flowerB, tuft, lily };
  for (const k in kinds) if (lists[k].length) world.add(kinds[k].instanced(lists[k]));

  /* lamp posts along the roads */
  const post = new Builder(0.04)
    .add(cyl(0.06, 0.09, 2.5, 5), '#2E2038', M(0, 1.25, 0))
    .add(box(0.5, 0.07, 0.07), '#2E2038', M(0.2, 2.5, 0))
    .add(box(0.22, 0.08, 0.22), '#2E2038', M(0.42, 2.44, 0));
  const posts = [], bulbs = [];
  ROADS.forEach((r, ri) => {
    for (let a = 0.32, i = 0; a < r.len - 0.12; a += 0.2, i++){
      const on = offsetDir(HUB, r.to, a), side = (i + ri) % 2 ? 1 : -1;
      const d = offsetDir(on, r.to, 0.0001, 0.062 * side);
      posts.push(standAt(d, on)); block(d, 0.15);
      const m = standAt(d, on); bulbs.push(m.clone().multiply(M(0.42, 2.28, 0)));
    }
  });
  world.add(post.instanced(posts));
  const bulb = new THREE.InstancedMesh(sph(0.15, 1), glowMat, bulbs.length);
  bulbs.forEach((m, i) => bulb.setMatrixAt(i, m)); world.add(bulb);

  /* sky: dusk gradient towards the sun, night on the far side, stars, clouds */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { sun: { value: SUN } },
    vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec3 d; uniform vec3 sun;
      void main(){ float t = dot(normalize(d), sun) * .5 + .5;
        vec3 night = vec3(.050,.032,.085), plum = vec3(.23,.13,.31), rose = vec3(.80,.40,.33), gold = vec3(.97,.72,.36);
        vec3 c = mix(night, plum, smoothstep(.0,.5,t)); c = mix(c, rose, smoothstep(.5,.86,t)); c = mix(c, gold, smoothstep(.86,1.,t));
        gl_FragColor = vec4(c,1.); }`
  }));
  scene.add(sky);
  const sp = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++){ const d = randDir().multiplyScalar(700); sp.set([d.x, d.y, d.z], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#EFE2C4', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.7 })));

  const cloudB = new Builder(0)
    .add(sph(1.5, 1), '#F3DCCB', M(0, 0, 0, 1.5, 0.7, 1))
    .add(sph(1.1, 1), '#F3DCCB', M(1.6, -0.1, 0.3, 1.3, 0.7, 1))
    .add(sph(0.9, 1), '#e9c9bd', M(-1.6, -0.15, -0.2, 1.3, 0.7, 1));
  const cm = [];
  for (let i = 0; i < 26; i++){
    const d = randDir(), m = standAt(d, randDir(), 0.8 + rnd() * 0.9);
    m.setPosition(d.multiplyScalar(R + 9 + rnd() * 7)); cm.push(m);
  }
  const clouds = cloudB.instanced(cm); scene.add(clouds);
  anim.push((t, dt, calm) => { if (!calm) clouds.rotation.y += dt * 0.012; });

  /* lights */
  const sun = new THREE.DirectionalLight('#ffd7a6', 2.3); sun.position.copy(SUN).multiplyScalar(100); scene.add(sun);
  scene.add(new THREE.HemisphereLight('#b9a6e8', '#3a2a48', 0.9));

  return { world, anim };
}
