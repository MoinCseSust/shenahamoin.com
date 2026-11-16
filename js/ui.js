/* UI — dialogue bar, panels, reader, index list, keyboard and touch input. */
import { SECTIONS, SECRETS, ENDING } from './content.js';

export const state = {
  running: false, gl: true, near: null, keys: {}, drag: 0, stack: [],
  visited: new Set(), secrets: new Set(), ended: false,
  onInteract: null, onTravel: null, onResume: null
};
const $ = (s) => document.querySelector(s);
export const bnum = (n) => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const bar = $('#bar');
export const isLocked = (n) => n.id === 'door' && state.visited.size < SECTIONS.length;

export function showBar(n){
  if (!n){ bar.classList.remove('on'); return; }
  $('#barWho').textContent = n.roman || 'KEEPER';
  $('#barSay').textContent = isLocked(n) ? n.lockedSay : n.say;
  $('#bar .cue').style.display = isLocked(n) ? 'none' : '';
  const verb = $('#cueVerb'); if (verb) verb.textContent = n.isSection ? 'কথা বলুন' : 'কাছ থেকে দেখুন';
  bar.classList.add('on');
}

/* ---- overlay stack ---- */
export function open(id){
  const el = document.getElementById(id); el.classList.add('on'); el.scrollTop = 0;
  if (id === 'travel') travelSync();
  state.stack.push(id); $('#back').classList.add('on'); document.body.classList.add('reading');
  state.running = false; for (const k in state.keys) state.keys[k] = false;
  const f = el.querySelector('button, a'); (f || $('#back')).focus({ preventScroll: true });
}
export function closeTop(){
  const id = state.stack.pop(); if (!id) return;
  document.getElementById(id).classList.remove('on');
  if (!state.stack.length){
    $('#back').classList.remove('on'); document.body.classList.remove('reading');
    if (state.gl){ state.running = true; $('#game').focus({ preventScroll: true }); if (state.onResume) state.onResume(); }
    else open('travel');
  }
}
const toggle = (id) => { if (state.stack[state.stack.length - 1] === id) closeTop(); else open(id); };

/* ---- panels ---- */
export function visit(n){
  if (n.isSection && !state.visited.has(n.id)){ state.visited.add(n.id); $('#found').textContent = bnum(state.visited.size); return true; }
  if (n.isSecret && !state.secrets.has(n.id)){
    state.secrets.add(n.id); $('#secretLine').hidden = false; $('#secretN').textContent = bnum(state.secrets.size); return true;
  }
  return false;
}
export function renderPanel(n){
  const c = n.color || '#EFE2C4';
  const posts = (n.posts || []).map((p, i) => `
    <button class="post" data-i="${i}">
      <div class="meta">${p.kind || ''} · ${p.date || ''}</div>
      <h3>${p.title}</h3><p>${p.excerpt || ''}</p>
    </button>`).join('');
  $('#panelIn').innerHTML = `
    <div class="crest">
      <div class="sym" style="border-color:${c};color:${c}">${n.icon}</div>
      <div><h2 style="color:${c}">${n.name}</h2><span class="roman">${n.roman}${n.kind ? ' · ' + n.kind : ''}</span></div>
    </div>
    <p class="lede">${n.lede}</p>
    <div class="rule" style="background:${c}"></div>
    ${ (n.posts && n.posts.length)
        ? `<div class="count">${bnum(n.posts.length)} টি লেখা</div>${posts}`
        : (n.isSection ? `<div class="empty">এই সেকশনে এখনও কিছু প্রকাশিত হয়নি। শিগগিরই আসছে।</div>` : '') }`;
  $('#panelIn').querySelectorAll('.post').forEach(b => {
    b.addEventListener('click', () => {
      const p = n.posts[+b.dataset.i];
      if (p.url){ window.open(p.url, '_blank', 'noopener'); return; }
      renderReader(n, p); open('reader');
    });
  });
}
function renderReader(n, p){
  $('#readerIn').innerHTML = `
    <div class="head" style="color:${n.color}">${n.name} · ${p.kind || ''}</div>
    <h2>${p.title}</h2>
    <div class="byline">MOIN · ${p.date || ''}</div>
    <div class="rule" style="background:${n.color}"></div>
    <div class="body">${(p.body || []).map(t => `<p>${t}</p>`).join('')}</div>
    <div class="end">✦ ✦ ✦</div>`;
}
export function showEnding(){
  $('#endingIn').innerHTML = `
    <div class="tag" style="color:var(--brass)">${bnum(6)} / ${bnum(6)} · THE MANUSCRIPT IS WHOLE</div>
    <h2 class="plain" style="margin-top:10px">${ENDING.title}</h2>
    <div class="rule" style="background:var(--brass)"></div>
    ${ENDING.body.map(t => `<p class="lede">${t}</p>`).join('')}
    <div class="end">✦ ✦ ✦</div>`;
  open('ending');
}

/* ---- index list (also the no-WebGL way in) ---- */
$('#travelList').innerHTML = SECTIONS.map(s => `
  <button class="trav" data-id="${s.id}">
    <span class="s" style="border-color:${s.color}">${s.icon}</span>
    <span><b style="color:${s.color}">${s.name}</b><i>${s.tag}</i></span>
    <span class="ok" data-ok="${s.id}"></span>
  </button>`).join('');
$('#travelList').querySelectorAll('.trav').forEach(b => {
  b.addEventListener('click', () => {
    const s = SECTIONS.find(x => x.id === b.dataset.id);
    if (!state.gl){                                  // no 3D: the list is the site
      visit(s); renderPanel(s); document.getElementById('travel').classList.remove('on'); state.stack.length = 0; open('panel'); return;
    }
    while (state.stack.length) closeTop();
    if (state.onTravel) state.onTravel(s);
  });
});
function travelSync(){
  SECTIONS.forEach(s => { const e = document.querySelector(`[data-ok="${s.id}"]`); if (e) e.textContent = state.visited.has(s.id) ? '✓ পাতা পাওয়া গেছে' : ''; });
}

/* ---- input ---- */
const DIRS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('.sheet.on') && (e.code === 'Space' || e.code === 'Enter')) return;   // let buttons work
  if (DIRS[e.code] && state.running){ state.keys[DIRS[e.code]] = true; e.preventDefault(); }
  if ((e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') && state.running && state.near){ state.onInteract(); e.preventDefault(); }
  const started = !$('#title').classList.contains('on');
  if (e.code === 'KeyM' && started) toggle('travel');
  if (e.code === 'KeyH' && started) toggle('help');
  if (e.code === 'Escape') closeTop();
});
addEventListener('keyup', e => { if (DIRS[e.code]) state.keys[DIRS[e.code]] = false; });
addEventListener('blur', () => { for (const k in state.keys) state.keys[k] = false; });

const touch = $('#touch');
if (matchMedia('(pointer:coarse)').matches){
  touch.classList.add('on');
  $('#bar .cue').innerHTML = '<span>নিচের গোল বোতাম চাপুন</span> <span class="blink">▼</span>';
}
document.querySelectorAll('#pad button').forEach(b => {
  const d = b.dataset.dir, on = e => { e.preventDefault(); state.keys[d] = true; }, off = e => { e.preventDefault(); state.keys[d] = false; };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
  b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
});
$('#act').addEventListener('click', () => { if (state.near && state.running) state.onInteract(); });

/* drag on the scene to look around */
const cvs = $('#game'); let lastX = null;
cvs.addEventListener('pointerdown', e => { lastX = e.clientX; cvs.setPointerCapture(e.pointerId); });
cvs.addEventListener('pointermove', e => { if (lastX !== null){ state.drag += (e.clientX - lastX) * 0.006; lastX = e.clientX; } });
const end = () => { lastX = null; };
cvs.addEventListener('pointerup', end); cvs.addEventListener('pointercancel', end);

$('#back').addEventListener('click', closeTop);
$('#btnMap').addEventListener('click', () => toggle('travel'));
$('#btnHelp').addEventListener('click', () => toggle('help'));
