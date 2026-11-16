/* লেখক — the player: walking on a sphere, collision, follow camera. */
import * as THREE from 'three';
import { R, WATER, HUB, elev, obstacles, mapDir, offsetDir, Builder, box, sph, M } from './world.js';

const SPEED = 8.2, TURN = 1.25;
const up = new THREE.Vector3(), right = new THREE.Vector3(), mv = new THREE.Vector3(), np = new THREE.Vector3();
const _x = new THREE.Vector3(), _m = new THREE.Matrix4(), _look = new THREE.Vector3(), _n = new THREE.Vector3(), _sl = new THREE.Vector3();

export const P = {
  p: mapDir(36, 29.4),          // where the player stands (unit direction)
  cf: new THREE.Vector3(),      // camera heading, tangent to the surface
  face: new THREE.Vector3(),    // which way the figure faces
  moving: false, t: 0, group: null, parts: null
};
function tangent(v, p){ return v.addScaledVector(p, -v.dot(p)).normalize(); }
P.cf.copy(HUB); tangent(P.cf, P.p); P.face.copy(P.cf);

export function createPlayer(scene){
  const g = new THREE.Group();
  const body = new Builder(0.045)
    .add(box(0.74, 0.8, 0.44), '#C8503F', M(0, 0.98, 0))            // kurta
    .add(box(0.78, 0.14, 0.48), '#a83f33', M(0, 0.62, 0))
    .add(box(0.62, 0.58, 0.56), '#E8C9A0', M(0, 1.68, 0))           // head
    .add(box(0.68, 0.26, 0.62), '#1E1520', M(0, 1.94, -0.02))       // hair
    .add(box(0.68, 0.34, 0.2), '#1E1520', M(0, 1.72, -0.24))
    .add(box(0.09, 0.09, 0.04), '#1E1520', M(-0.15, 1.68, 0.29), false)
    .add(box(0.09, 0.09, 0.04), '#1E1520', M(0.15, 1.68, 0.29), false)
    .add(box(0.4, 0.42, 0.16), '#8a5a34', M(0.12, 0.92, -0.3))       // satchel of pages
    .add(box(0.3, 0.06, 0.2), '#EFE2C4', M(0.12, 1.15, -0.3), false)
    .mesh();
  const limb = (color, w, h, x, y) => { const pv = new THREE.Group(); pv.position.set(x, y, 0);
    pv.add(new Builder(0.04).add(box(w, h, w), color, M(0, -h / 2, 0)).mesh()); g.add(pv); return pv; };
  const legL = limb('#2E4A7D', 0.26, 0.58, -0.19, 0.58), legR = limb('#2E4A7D', 0.26, 0.58, 0.19, 0.58);
  const armL = limb('#E8C9A0', 0.18, 0.62, -0.47, 1.34), armR = limb('#E8C9A0', 0.18, 0.62, 0.47, 1.34);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.62, 12),
    new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04;
  g.add(body, shadow);
  P.group = g; P.parts = { body, legL, legR, armL, armR };
  scene.add(g); place();
  return g;
}

const WET = { water: true };
function hit(d){                       // what is in the way at `d`, if anything
  if (elev(d) < WATER + 0.14) return WET;
  for (const o of obstacles) if (d.dot(o.d) > o.c) return o;
  return null;
}
function place(){
  up.copy(P.p); _x.crossVectors(up, P.face).normalize();
  _m.makeBasis(_x, up, P.face);
  P.group.quaternion.setFromRotationMatrix(_m);
  P.group.position.copy(up).multiplyScalar(R + elev(up));
}

export function stepPlayer(dt, keys, drag){
  up.copy(P.p);
  const ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), iy = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
  const turn = -ix * TURN * dt * (iy < 0 ? -0.5 : 1) - drag;
  if (turn) P.cf.applyAxisAngle(up, turn);
  right.crossVectors(P.cf, up).normalize();
  mv.set(0, 0, 0).addScaledVector(P.cf, iy).addScaledVector(right, ix * 0.8);
  P.moving = mv.lengthSq() > 1e-6;
  if (P.moving){
    if (mv.length() > 1) mv.normalize();
    const k = SPEED * dt / R;
    const tryMove = (v) => { np.copy(P.p).addScaledVector(v, k).normalize(); const h = hit(np); if (h) return h; P.p.copy(np); return null; };
    let h = tryMove(mv);
    if (h && h.d){                                   // slide round trees, rocks and keepers
      tangent(_n.copy(P.p).sub(h.d), P.p);
      const into = mv.dot(_n);
      if (into < 0){
        _sl.copy(mv).addScaledVector(_n, -into);
        if (_sl.lengthSq() < 0.05) _sl.crossVectors(_n, up).multiplyScalar(0.6);
        h = tryMove(_sl);
      }
    }
    if (h){                                          // shorelines: try each axis on its own
      const f = _look.copy(P.cf).multiplyScalar(iy), sd = _x.copy(right).multiplyScalar(ix * 0.8);
      if (!(iy && !tryMove(f)) && ix) tryMove(sd);
    }
    P.face.lerp(mv.normalize(), Math.min(1, dt * 12));
    P.t += dt * 10;
  } else P.t = 0;
  tangent(P.cf, P.p); tangent(P.face, P.p);
  const sw = P.moving ? Math.sin(P.t) * 0.7 : 0;
  P.parts.legL.rotation.x = sw; P.parts.legR.rotation.x = -sw;
  P.parts.armL.rotation.x = -sw * 0.8; P.parts.armR.rotation.x = sw * 0.8;
  P.parts.body.position.y = P.moving ? Math.abs(Math.sin(P.t)) * 0.06 : 0;
  place();
}

/* put any camera-like object behind and above the player */
export function followCamera(cam, aspect){
  const tall = aspect < 0.8, h = tall ? 10 : 7.6, back = tall ? 16 : 12.5;
  up.copy(P.p);
  const base = P.group.position;
  cam.position.copy(base).addScaledVector(up, h).addScaledVector(P.cf, -back);
  cam.up.copy(up);
  cam.lookAt(_look.copy(base).addScaledVector(up, 1.7).addScaledVector(P.cf, 2.2));
}

/* drop the player just in front of a node, facing it */
export function teleportTo(n){
  P.p.copy(offsetDir(n.dir, HUB, 0.085, 0.035));
  if (hit(P.p)) P.p.copy(offsetDir(n.dir, HUB, 0.085));
  P.cf.copy(n.dir); tangent(P.cf, P.p); P.face.copy(P.cf); place();
}
