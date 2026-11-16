/* মূল লুপ — renderer, title orbit, game loop, the ending. */
import * as THREE from 'three';
import { SECTIONS } from './content.js';
import { R, NODES, buildWorld, Builder, box, M } from './world.js';
import { P, createPlayer, stepPlayer, followCamera, teleportTo } from './player.js';
import { buildCast } from './characters.js';
import { state, showBar, open, visit, renderPanel, showEnding, isLocked } from './ui.js';

const $ = (s) => document.querySelector(s);
const calm = matchMedia('(prefers-reduced-motion:reduce)').matches;
const cvs = $('#game');

function noWebGL(){
  state.gl = false; document.body.classList.add('nogl');
  $('#start').textContent = 'লেখার তালিকা খুলুন';
  $('#start').addEventListener('click', () => { $('#title').classList.remove('on'); open('travel'); });
}

async function boot(){
  let renderer;
  try { if (location.search.includes('nogl')) throw new Error('WebGL switched off by ?nogl');
    renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true, powerPreference: 'high-performance' }); }
  catch (e){ noWebGL(); return; }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 2000), ghost = new THREE.PerspectiveCamera();
  function resize(){
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 0.8 ? 58 : 48; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  /* Bengali name tags are drawn to canvas, so the font has to be there first */
  await Promise.race([
    document.fonts.load('600 44px "Baloo Da 2"', SECTIONS.map(s => s.name).join('')),
    new Promise(r => setTimeout(r, 2500))
  ]).catch(() => {});

  const world = buildWorld(scene);
  const cast = buildCast(scene);
  createPlayer(scene);

  /* pages that fly up at the end */
  const flock = new THREE.Group(); flock.visible = false; P.group.add(flock);
  for (let i = 0; i < 6; i++) flock.add(new Builder(0.03).add(box(0.5, 0.66, 0.03), '#EFE2C4', M(0, 0, 0)).mesh());
  let endT = -1;

  state.onInteract = () => {
    const n = state.near; if (!n || isLocked(n)) return;
    const fresh = visit(n);
    if (fresh && n.isSection) cast.takePage(n.id);
    if (n.id === 'door') cast.openDoor();
    renderPanel(n); open('panel');
  };
  state.onTravel = (s) => { teleportTo(s); state.near = s; showBar(s); };
  state.onResume = () => {
    if (!state.ended && state.visited.size === SECTIONS.length){ state.ended = true; endT = 0; flock.visible = true; }
  };

  let intro = 0, started = false, time = 0, last = performance.now();
  $('#start').addEventListener('click', () => {
    $('#title').classList.remove('on'); started = true; last = performance.now(); cvs.focus({ preventScroll: true });
  });
  $('#start').focus({ preventScroll: true });

  const tp = new THREE.Vector3(), tq = new THREE.Quaternion();
  function frame(now){
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (state.stack.length) return;                       // a panel is open: nothing to draw
    time += dt;

    if (started && intro < 1) { intro = Math.min(1, intro + dt / (calm ? 0.01 : 2.2)); if (intro === 1) state.running = true; }
    if (state.running){
      stepPlayer(dt, state.keys, state.drag);
      let found = null, best = 3.9 / R;
      for (const n of NODES){ const a = Math.acos(Math.min(1, P.p.dot(n.dir))); if (a < best){ best = a; found = n; } }
      if (found !== state.near){ state.near = found; showBar(found); }
    }
    state.drag = 0;
    world.anim.forEach(f => f(time, dt, calm));
    cast.anim(time, dt, calm);

    if (endT >= 0){
      endT += dt;
      flock.children.forEach((pg, i) => {
        const a = endT * 2.4 + i * Math.PI / 3, r = 1.1 + endT * 0.35;
        pg.position.set(Math.cos(a) * r, 1.2 + endT * 1.5 + Math.sin(endT * 3 + i) * 0.2, Math.sin(a) * r);
        pg.rotation.set(endT * 2 + i, a, 0);
      });
      if (endT > 3.4){ endT = -1; flock.visible = false; showEnding(); }
    }

    /* camera: slow orbit on the title, then glide down behind the player */
    followCamera(ghost, camera.aspect);
    if (intro < 1){
      const a = calm ? 0.6 : time * 0.07, far = R * (camera.aspect < 0.8 ? 4.6 : 3.1);
      tp.set(Math.sin(a) * 0.62, 0.78, Math.cos(a) * 0.62).normalize().multiplyScalar(far);
      camera.position.copy(tp); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0); tq.copy(camera.quaternion);
      const e = intro * intro * (3 - 2 * intro);
      camera.position.lerpVectors(tp, ghost.position, e);
      camera.quaternion.slerpQuaternions(tq, ghost.quaternion, e);
    } else {
      camera.position.copy(ghost.position); camera.quaternion.copy(ghost.quaternion);
    }
    renderer.render(scene, camera);
  }
  (function loop(now){ frame(now); requestAnimationFrame(loop); })(last);
  /* handy in the console: __planet.run(2) advances the world two seconds */
  window.__planet = { P, state, teleportTo, NODES, renderer,
    run(sec){ for (let i = 0; i < sec * 60; i++) frame(last + 1000 / 60); } };
}

boot().catch(err => { console.error(err); if (!state.gl) return; noWebGL(); });
