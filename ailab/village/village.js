// AI 연구소 마을 — 방 하나 = 단층 건물 한 채. 직원은 블록 캐릭터 NPC, 나는 사장님.
// 동네 3곳마다 배치가 달라요: 파타야 = 해변 큰길 일자 거리(안다즈 파타야 좀티엔 사진처럼), 몰디브 = 섬에서 세 갈래로 뻗은 부두와 수상 빌라(5성급 리조트 사진처럼),
// 교토 = 기요미즈데라로 오르는 언덕 참배길(산넨자카 · 야사카 오층탑 · 기요미즈 무대). 하늘은 지금 시각에 맞춰 낮 · 노을 · 밤.
// 직원 머리 위 말풍선: 지금 시각(아침 · 점심 · 저녁 …)과 자기 방 일에 맞는 인사. 푸드코트: 그 나라에서 꼭 먹어야 하는 음식 노점 4곳.
// 건물을 누르면 연구소의 그 방(../#방이름)으로 가요. 자료는 연구소 화면 그대로 써요.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ROOMS } from '../rooms.js';
import { drawPlate } from './plates.js';

const $ = (s) => document.querySelector(s);
const store = { get(k, d) { try { return localStorage.getItem('ailab-village:' + k) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('ailab-village:' + k, v); } catch {} } };
const rnd = (() => { let s = 7; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();

// ───────── 건물 (방 11채 + 사장님 집) ─────────
// 동네마다 배치가 달라요: 아래 '동네 배치' 의 layoutPattaya · layoutMaldives · layoutKyoto 가 자리를 정해요.
// [방 이름, 너비, 깊이]
const ORDER = [['security', 5, 4.5], ['moral', 5.5, 4.5], ['others', 5.5, 4.5], ['links', 6, 5], ['train', 6, 5], ['lobby', 7, 5], ['archive', 5.5, 4.5], ['aiedu', 6, 5], ['task', 6, 5], ['plans', 6, 5], ['store2', 5, 4]];
const SIZE = Object.fromEntries(ORDER.map(([k, w, d]) => [k, [w, d]]));
const V = (x, z, y = 0) => new THREE.Vector3(x, y, z);
// L = 지금 동네 배치. spots(건물 자리, rot = 문이 보는 쪽) · plaza(광장) · fc(푸드코트) · net(직원이 다니는 길) · H(x,z)(땅 높이)
let L = null, SPOTS = [], LOBBY = null;
function spot(key, x, z, rot, o = {}) { const [w, d] = SIZE[key] || [8, 6]; return { key, x, z, rot, w, d, lot: key === 'store2', boss: key === 'boss', ...o }; }
const gy = (x, z) => (L ? L.H(x, z) : 0);
const NAME = (k) => (k === 'boss' ? '사장님 집' : k === 'store2' ? '빈 터' : ROOMS[k]?.name || k);
const JOB = (k) => ROOMS[k]?.role || '';
const DESC = {
  boss: '사장님 집이에요. 계기판 · 브리핑 · 일정은 연구소의 사장실에서 열려요.',
  store2: '아직 비어 있는 터예요. 새 방이 생기면 여기에 건물이 올라가요.',
};

// ───────── 테마 ─────────
const THEMES = {
  andaz: {
    name: '파타야', hello: '사와디캅~', skyTop: 0x4a90c8, sky: 0xa9d6ea, fog: 0xcfe2ea, sun: 0xfff3dc, hemiG: 0x7a9060,
    ground: 0x6f9a3e, plaza: 0xe2d8c6, sand: 0xeadcb1, water: 0x2f8fb0, waterNear: 0x4fb8c8,
  },
  maldives: {
    name: '몰디브', hello: '아쌀라무 알라이쿰~', skyTop: 0x3a8fd8, sky: 0xa8dcf2, fog: 0xd5f1f6, sun: 0xffffff, hemiG: 0x9ad6c8,
    ground: 0xa9d478, plaza: 0xf6eed6, sand: 0xf7efd8, water: 0x1f78b8, waterNear: 0x5fe0d8,
  },
  kyoto: {
    name: '교토', hello: '곤니치와~', skyTop: 0x2f6fd0, sky: 0xa8cce8, fog: 0xe0e6ea, sun: 0xffeccc, hemiG: 0x6f8a5a,
    ground: 0x7f9a52, plaza: 0xd9d4c6, sand: 0x8f8a7c, water: 0x5f8f9a, waterNear: 0x6fa19a,
  },
};

// ───────── 3D 기본 ─────────
const canvas = $('#stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 600);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.1;
controls.minDistance = 8; controls.maxDistance = 95; controls.maxPolarAngle = 1.35; controls.enablePan = false;
camera.position.set(0, 26, 46);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
function box(parent, w, h, d, c, x, y, z, o) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), c.isMaterial ? c : M(c, o)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
const ball = (parent, r, c, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), M(c)); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
function cyl(parent, r1, r2, h, c, x, y, z, seg = 10) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), c.isMaterial ? c : M(c)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
// 지붕: 네모 바닥에서 꼭대기로 모이는 모임지붕 (열대 · 이엉 · 기와 모두 이걸로, 처마 길이와 높이만 달리)
function hipRoof(parent, w, d, h, c, y, { eave = 0.6, flare = false } = {}) {
  const g = new THREE.ConeGeometry(1, 1, 4, 1, false, Math.PI / 4); g.translate(0, 0.5, 0);
  const m = new THREE.Mesh(g, c.isMaterial ? c : M(c, { flatShading: true }));
  m.scale.set((w / 2 + eave) * Math.SQRT2, h, (d / 2 + eave) * Math.SQRT2); m.position.y = y; m.castShadow = true; parent.add(m);
  if (flare) { const s = new THREE.Mesh(new THREE.BoxGeometry(w + eave * 2.4, 0.18, d + eave * 2.4), c.isMaterial ? c : M(c)); s.position.y = y + 0.05; s.castShadow = true; parent.add(s); }
  return m;
}
function label(text, gold) {
  const c = document.createElement('canvas'), g = c.getContext('2d'); const f = 50;
  g.font = `${f}px "Ownglyph_UNZ-Rg", sans-serif`; const w = Math.ceil(g.measureText(text).width) + 44; c.width = w; c.height = 72;
  g.font = `${f}px "Ownglyph_UNZ-Rg", sans-serif`; g.fillStyle = gold ? 'rgba(212,161,46,.95)' : 'rgba(31,42,36,.82)';
  g.beginPath(); g.roundRect(0, 4, w, 64, 32); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 38);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(w / 72 * 1.1, 1.1, 1); s.renderOrder = 10; return s;
}

// ───────── 블록 캐릭터 (사장님 · 직원 · 친구 같은 모양) ─────────
const SKIN = 0xf1c9a5;
function person({ shirt = 0x3f6b55, pants = 0x2f3a52, hair = 0x3a2a20, long = false, hat = null } = {}) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const legL = new THREE.Group(), legR = new THREE.Group(), armL = new THREE.Group(), armR = new THREE.Group();
  legL.position.set(-0.17, 0.75, 0); legR.position.set(0.17, 0.75, 0);
  box(legL, 0.3, 0.75, 0.32, pants, 0, -0.37, 0); box(legR, 0.3, 0.75, 0.32, pants, 0, -0.37, 0);
  box(legL, 0.32, 0.12, 0.4, 0xf4f4f0, 0, -0.72, 0.03); box(legR, 0.32, 0.12, 0.4, 0xf4f4f0, 0, -0.72, 0.03);
  box(body, 0.7, 0.8, 0.4, shirt, 0, 1.15, 0);
  armL.position.set(-0.47, 1.5, 0); armR.position.set(0.47, 1.5, 0);
  box(armL, 0.22, 0.7, 0.24, shirt, 0, -0.32, 0); box(armL, 0.2, 0.16, 0.22, SKIN, 0, -0.73, 0);
  box(armR, 0.22, 0.7, 0.24, shirt, 0, -0.32, 0); box(armR, 0.2, 0.16, 0.22, SKIN, 0, -0.73, 0);
  const head = new THREE.Group(); head.position.y = 1.55; body.add(head);
  box(head, 0.64, 0.6, 0.6, SKIN, 0, 0.32, 0);
  box(head, 0.68, 0.2, 0.64, hair, 0, 0.66, 0); box(head, 0.68, long ? 0.75 : 0.35, 0.18, hair, 0, long ? 0.3 : 0.5, -0.24);
  if (long) { box(head, 0.12, 0.7, 0.62, hair, -0.33, 0.3, -0.02); box(head, 0.12, 0.7, 0.62, hair, 0.33, 0.3, -0.02); }
  box(head, 0.09, 0.13, 0.02, 0x222222, -0.14, 0.34, 0.305); box(head, 0.09, 0.13, 0.02, 0x222222, 0.14, 0.34, 0.305);
  box(head, 0.16, 0.04, 0.02, 0xd9706a, 0, 0.17, 0.305);
  if (hat) box(head, 0.8, 0.12, 0.8, hat, 0, 0.8, 0);
  body.add(legL, legR, armL, armR);
  g.userData = { legL, legR, armL, armR, head, body, phase: rnd() * 6 };
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function animate(p, dt, moving, act) {
  const u = p.userData; u.phase += dt * (moving ? (p === me?.g ? 9 : 5) : 2);   // 직원은 발걸음도 느리게
  const s = moving ? Math.sin(u.phase) * 0.6 : 0;
  u.legL.rotation.x = s; u.legR.rotation.x = -s; u.armL.rotation.x = -s * 0.8; u.armR.rotation.x = s * 0.8; u.armL.rotation.z = 0; u.armR.rotation.z = 0;
  u.body.position.y = moving ? Math.abs(Math.sin(u.phase)) * 0.06 : 0;
  if (act === 'wave') { u.armR.rotation.x = -2.8; u.armR.rotation.z = Math.sin(u.phase * 3) * 0.35; }
  if (act === 'kite') { u.armR.rotation.x = -2.2; }
  if (act === 'carry') { u.armL.rotation.x = -1.2; u.armR.rotation.x = -1.2; }
  if (act === 'sit' || act === 'eat') { u.legL.rotation.x = -1.5; u.legR.rotation.x = -1.5; u.body.position.y = -0.3; u.armL.rotation.x = -0.4; u.armR.rotation.x = -0.4 + Math.sin(u.phase * 0.7) * 0.15; u.head.rotation.y = Math.sin(u.phase * 0.4) * 0.4; }
  if (act === 'eat') { u.armR.rotation.x = -0.9 - Math.max(0, Math.sin(u.phase * 1.1)) * 1.1; u.armL.rotation.x = -0.9; u.head.rotation.y = 0; }
  if (act === 'hold') { u.armR.rotation.x = -1.1; }
  if (act === 'cook') { u.armR.rotation.x = -1 + Math.sin(u.phase * 3) * 0.35; u.armL.rotation.x = -0.9; }
  if (act === 'icecream') { u.armR.rotation.x = -1.6 - Math.max(0, Math.sin(u.phase * 0.9)) * 0.9; u.head.rotation.x = 0.1; }
  if (act === 'npckite') { u.armR.rotation.x = -2.3 + Math.sin(u.phase) * 0.15; u.head.rotation.x = -0.4; }
  if (act !== 'npckite' && act !== 'icecream') u.head.rotation.x = 0;
  if (act !== 'sit') u.head.rotation.y = 0;
  if (u.hand) u.hand.rotation.x = -u.armR.rotation.x;   // 손에 든 음식은 늘 수평으로
  if (act === 'bike') { u.legL.rotation.x = -1 + Math.sin(u.phase) * 0.5; u.legR.rotation.x = -1 - Math.sin(u.phase) * 0.5; u.armL.rotation.x = -1.2; u.armR.rotation.x = -1.2; u.body.position.y = 0.45; }
}

// ───────── 마을 만들기 ─────────
let world = null, hemi = null, sun = null;
const pickables = [], GLOWS = [];
function clearWorld() { if (world) { scene.remove(world); world.traverse((o) => { o.geometry?.dispose(); }); } pickables.length = 0; GLOWS.length = 0; }
// 저녁이면 불이 켜지는 재료 (창문 · 등 · 초롱). k = 밝기 배율
function glowMat(c, k = 1, o = {}) { const m = M(c, { emissive: c, emissiveIntensity: 0, ...o }); m.userData.k = k; GLOWS.push(m); return m; }

// 하늘: 지금 시각에 맞춰 낮 · 노을 · 밤 (위쪽 단추로 바꿔 볼 수도 있어요, 주소 끝 ?time=dusk 도 돼요)
const TIMES = ['now', 'day', 'dusk', 'night'], TIME_NAME = { now: '지금 시각', day: '낮', dusk: '노을', night: '밤' };
let timeMode = TIMES.includes(new URLSearchParams(location.search).get('time')) ? new URLSearchParams(location.search).get('time') : 'now';
function skyNow() { if (timeMode !== 'now') return timeMode; const h = new Date().getHours() + new Date().getMinutes() / 60; return h >= 19 || h < 5.5 ? 'night' : h >= 17 || h < 6.6 ? 'dusk' : 'day'; }
function gradTex(top, bot, mid) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  const hex = (n) => '#' + n.toString(16).padStart(6, '0'); gr.addColorStop(0, hex(top)); if (mid != null) gr.addColorStop(0.62, hex(mid)); gr.addColorStop(1, hex(bot));
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function applySky() {
  const T = THEMES[theme], s = skyNow();
  const P = s === 'day' ? { top: T.skyTop, bot: T.sky, fog: T.fog, hemi: 1.15, sun: 2.3, sunC: T.sun, sp: [30, 50, 20], glow: 0 }
    : s === 'dusk' ? { top: 0x272a66, mid: 0x9a6a9a, bot: 0xf2a070, fog: 0xb08a9a, hemi: 0.6, sun: 1.3, sunC: 0xffa36a, sp: [-60, 16, -10], glow: 1 }
    : { top: 0x060a1e, mid: 0x14204a, bot: 0x2a3866, fog: 0x1a2444, hemi: 0.32, sun: 0.45, sunC: 0x9fb4ff, sp: [-20, 50, 30], glow: 1.5 };
  scene.background = gradTex(P.top, P.bot, P.mid); scene.fog.color.set(P.fog);
  hemi.intensity = P.hemi; sun.intensity = P.sun; sun.color.set(P.sunC); sun.position.set(...P.sp);
  for (const m of GLOWS) m.emissiveIntensity = P.glow * m.userData.k;
  const b = $('#timeBtn'); if (b) b.textContent = timeMode === 'now' ? `지금 · ${TIME_NAME[s]}` : TIME_NAME[timeMode];
}

// 지붕: 마루가 있는 우진각 지붕 (안다즈 지붕널 · 몰디브 이엉 · 교토 기와 모두). eave = 처마가 벽 밖으로 나온 길이
function ridgeRoof(parent, w, d, h, c, y, eave = 0.6) {
  const swap = d > w, W = (swap ? d : w) / 2 + eave, D = (swap ? w : d) / 2 + eave, r = Math.max(W - D * 0.95, 0.05);
  const P = [[-W, 0, D], [W, 0, D], [W, 0, -D], [-W, 0, -D], [-r, h, 0], [r, h, 0]];
  const pos = []; for (const f of [[0, 1, 5], [0, 5, 4], [2, 3, 4], [2, 4, 5], [1, 2, 5], [3, 0, 4], [0, 3, 2], [0, 2, 1]]) for (const i of f) pos.push(...P[i]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, c.isMaterial ? c : M(c, { flatShading: true, side: THREE.DoubleSide }));
  m.position.y = y; if (swap) m.rotation.y = Math.PI / 2; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
// 길 띠: 점들을 따라 땅 높이에 맞춰 깔아요
function ribbon(pts, width, c, lift = 0.06, steps = 0) {
  const out = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(a.distanceTo(b) / 0.8)); for (let k = 0; k < n; k++) out.push(a.clone().lerp(b, k / n)); } out.push(pts[pts.length - 1].clone());
  const pos = [], idx = [];
  out.forEach((p, i) => { const q = out[Math.min(i + 1, out.length - 1)], o = out[Math.max(i - 1, 0)], dir = q.clone().sub(o).setY(0).normalize(), nx = -dir.z * width / 2, nz = dir.x * width / 2;
    pos.push(p.x + nx, gy(p.x + nx, p.z + nz) + lift, p.z + nz, p.x - nx, gy(p.x - nx, p.z - nz) + lift, p.z - nz); if (i) { const j = i * 2; idx.push(j - 2, j - 1, j, j - 1, j + 1, j); } });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, M(c, { side: THREE.DoubleSide })); m.receiveShadow = true; world.add(m);
  if (steps) for (let i = 0; i < out.length; i += steps) { const p = out[i], q = out[Math.min(i + 1, out.length - 1)], s = box(world, width, 0.08, 0.12, 0x9a9282, p.x, gy(p.x, p.z) + lift + 0.03, p.z); s.rotation.y = Math.atan2(q.x - p.x, q.z - p.z); s.castShadow = false; }
  return m;
}
const mushLamp = (x, z, y = gy(x, z)) => { cyl(world, 0.1, 0.14, 0.45, 0xece6da, x, y + 0.22, z, 8); const d = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), glowMat(0xfff0d0, 1.8, { emissive: 0xffc98a })); d.position.set(x, y + 0.45, z); world.add(d); };

function buildWorld(id) {
  clearWorld();
  const T = THEMES[id]; world = new THREE.Group(); scene.add(world);
  scene.fog = new THREE.Fog(T.fog, 120, 340);
  hemi = new THREE.HemisphereLight(0xffffff, T.hemiG, 1.1); world.add(hemi);
  sun = new THREE.DirectionalLight(T.sun, 2.2); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, far: 260 }); world.add(sun);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), M(T.water, { roughness: 0.2, metalness: 0.15 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.35; sea.receiveShadow = true; world.add(sea);
  L.ground(id);   // 동네마다 땅 · 길 · 물

  for (const s of SPOTS) {
    const g = new THREE.Group(); g.position.set(s.x, gy(s.x, s.z), s.z); g.rotation.y = s.rot; world.add(g);
    if (s.lot) buildLot(g, s, id);
    else ({ andaz: buildAndaz, maldives: buildMaldives, kyoto: buildKyoto }[id])(g, s);
    // 문패: 문 앞 기둥에 방마다 다른 정사각형 문패
    { const tex = new THREE.CanvasTexture(drawPlate(s.key, 256)); tex.colorSpace = THREE.SRGBColorSpace;
      const post = new THREE.Group(); post.position.set(s.w / 2 - 0.4, s.plateY || 0, s.d / 2 + 1.3); g.add(post);
      box(post, 0.14, 1.5, 0.14, 0x6e4c30, 0, 0.75, 0);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })); pl.position.set(0, 2.15, 0.09); pl.castShadow = true; post.add(pl);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), M(0x6e4c30)); back.rotation.y = Math.PI; back.position.set(0, 2.15, 0.07); post.add(back); }
    const tag = label(NAME(s.key), s.boss); tag.position.set(0, s.tagY || (s.boss ? 7.6 : 6.4), 0); g.add(tag);
    g.traverse((o) => { if (o.isMesh) o.userData.spot = s; });
    pickables.push(g);
  }
  L.deco(id);
  buildPlaza(id);
  buildFoodCourt(id);
  applySky();
}

// ── 파타야 (안다즈 파타야 좀티엔): 짙은 회색 지붕널 · 티크 기둥 · 불 켜진 유리벽 정자, 붉은 티크 타이 집 ──
function pavilion(g, s, big = false) {
  const h = big ? 3.4 : 2.8, w = s.w, d = s.d, teak = 0x4e2e1c;
  box(g, w + 2.6, 0.5, d + 2.6, 0xcfc4b0, 0, 0.25, 0);   // 돌 기단
  box(g, w, h, d, glowMat(0xc9a27a, 1.1, { emissive: 0xffa24a, roughness: 0.3 }), 0, 0.5 + h / 2, 0);   // 불 켜지는 유리벽
  for (let x = -w / 2; x <= w / 2 + 0.01; x += 0.9) for (const z of [d / 2 + 0.02, -d / 2 - 0.02]) box(g, 0.12, h, 0.08, teak, x, 0.5 + h / 2, z);
  for (let z = -d / 2; z <= d / 2 + 0.01; z += 0.9) for (const x of [w / 2 + 0.02, -w / 2 - 0.02]) box(g, 0.08, h, 0.12, teak, x, 0.5 + h / 2, z);
  box(g, w + 0.2, 0.35, d + 0.2, teak, 0, 0.5 + h, 0);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(g, 0.13, 0.13, h, 0x3a2416, x * (w / 2 + 0.9), 0.5 + h / 2, z * (d / 2 + 0.9), 8);
  box(g, w + 2.6, 0.12, d + 2.6, 0x8a5a34, 0, 0.62 + h, 0);   // 처마 밑 나무 천장
  ridgeRoof(g, w, d, big ? 3.2 : 2.2, 0x56575b, 0.68 + h, 1.3);
  box(g, 1.3, h * 0.82, 0.1, 0x3a2416, 0, 0.5 + h * 0.41, d / 2 + 0.06);   // 문
}
function thaiHouse(g, s) {   // 붉은 티크 2층 집: 아래는 기둥만, 위층에 발코니와 흰 커튼
  const w = s.w, d = s.d, red = 0xa5442c, dk = 0x6e2a1a;
  box(g, w + 3, 0.12, d + 3, 0xd8d0c0, 0, 0.06, 0);   // 헤링본 돌바닥
  for (const x of [-w / 2, 0, w / 2]) for (const z of [-d / 2, d / 2]) box(g, 0.32, 2.6, 0.32, dk, x, 1.3, z);
  box(g, w - 0.4, 2.2, 0.15, red, 0, 1.1, -d / 2 + 0.2);   // 아래층 뒷벽
  box(g, w + 0.4, 0.25, d + 0.4, dk, 0, 2.7, 0);
  box(g, w, 2.4, d - 1.2, red, 0, 4.0, -0.6);
  for (let y = 3.2; y < 5.2; y += 0.6) box(g, w + 0.02, 0.06, d - 1.18, dk, 0, y, -0.6);
  for (const x of [-w / 4, w / 4]) box(g, 1, 1.3, 0.06, glowMat(0x2a1a12, 1.4, { emissive: 0xffa04a }), x, 4.1, d / 2 - 1.18);
  for (let x = -w / 2; x <= w / 2; x += 0.5) box(g, 0.06, 0.8, 0.06, dk, x, 3.25, d / 2 + 0.1);   // 발코니 난간
  box(g, w + 0.2, 0.08, 0.1, dk, 0, 3.65, d / 2 + 0.1);
  for (const x of [-w / 2 + 0.6, w / 2 - 0.6]) box(g, 0.7, 1.9, 0.05, 0xf6f1e6, x, 4.0, d / 2 - 0.4);   // 흰 커튼
  ridgeRoof(g, w, d, 2.8, 0x3a2418, 5.15, 0.9);
  box(g, 2.2, 0.35, 0.8, 0x2a2420, -w / 2 + 1.4, 0.3, d / 2 + 1.6);   // 짙은 평상
  for (const x of [w / 2 + 0.3, -w / 2 - 0.3]) { cyl(g, 0.05, 0.05, 2.6, 0xdddddd, x, 1.3, d / 2 + 1.4, 6); const u = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.5, 10), M(0xf1ead8, { side: THREE.DoubleSide })); u.position.set(x, 2.7, d / 2 + 1.4); u.castShadow = true; g.add(u); }
  for (const x of [w / 2 - 0.6]) { cyl(g, 0.35, 0.35, 0.06, 0x2a2420, x, 0.75, d / 2 + 2.4, 10); for (const sx of [-0.6, 0.6]) box(g, 0.5, 0.7, 0.5, 0xc9a06a, x + sx, 0.35, d / 2 + 2.4); }
}
function buildAndaz(g, s) {
  if (s.boss) {   // 바다 위 부두 끝 붉은 티크 집 (기둥 위 데크)
    box(g, s.w + 5, 0.25, s.d + 5, 0xa07a52, 0, 0.05, 0);
    for (let x = -s.w / 2 - 2; x <= s.w / 2 + 2; x += 2.2) for (const z of [-s.d / 2 - 2, s.d / 2 + 2]) cyl(g, 0.16, 0.16, 2, 0x5a3a24, x, -0.9, z, 6);
    thaiHouse(g, s); return;
  }
  if (s.key === 'moral' || s.key === 'others') { thaiHouse(g, s); return; }
  pavilion(g, s, s.key === 'lobby');
  if (s.key === 'security') box(g, 0.4, 0.4, 0.4, 0xff4b3a, 0, 6, 0, { emissive: 0xff2a1a, emissiveIntensity: 0.6 });
}

// ── 몰디브 (5성급 수상 빌라): 기둥 위 데크 · 흰 벽에 회색 줄 · 밝은 이엉 지붕 · 개인 수영장 · 바다로 내려가는 계단 ──
function buildMaldives(g, s) {
  const w = s.w, d = s.d, h = 2.6, wood = 0xc8a57a;
  if (s.key === 'lobby') {   // 섬 위 열린 로비: 큰 이엉 지붕 아래 기둥만
    box(g, w + 3, 0.3, d + 3, 0xf4efe4, 0, 0.15, 0);
    for (const x of [-w / 2, -w / 6, w / 6, w / 2]) for (const z of [-d / 2, d / 2]) cyl(g, 0.2, 0.2, 3.4, 0x8a6a46, x, 1.85, z, 8);
    ridgeRoof(g, w, d, 3.6, 0xd9b98a, 3.5, 1.4);
    box(g, 3, 1.1, 0.8, 0xe8dcc4, 0, 0.85, -0.5); box(g, 1.2, 0.06, 0.06, glowMat(0xffe0a0, 2), 0, 3.0, 0);
    return;
  }
  // 기둥 + 데크 (문 쪽 = 부두, 뒤쪽 = 바다로 넓은 데크)
  const back = s.boss ? 6 : 4.4;
  for (let x = -w / 2 - 1; x <= w / 2 + 1.01; x += (w + 2) / 3) for (const z of [d / 2 + 0.6, -d / 2, -d / 2 - back]) cyl(g, 0.16, 0.16, 2.2, 0x6e5a44, x, -1.05, z, 6);
  box(g, w + 2.4, 0.22, d + back + 1, wood, 0, -0.05, -back / 2 + 0.3);
  box(g, w, h, d, 0xf7f5f0, 0, h / 2, 0);   // 흰 벽
  for (let x = -w / 2 + 0.6; x < w / 2; x += 1.2) for (const z of [d / 2 + 0.02]) box(g, 0.5, h - 0.4, 0.04, 0x9aa6ae, x, h / 2, z);   // 회색 줄
  box(g, w - 1, h - 0.5, 0.06, glowMat(0x9fd6e2, 0.9, { emissive: 0xffd9a0, roughness: 0.1 }), 0, h / 2 - 0.1, -d / 2 - 0.02);   // 바다 쪽 큰 유리문
  box(g, 1.2, h * 0.8, 0.08, 0x8a6a46, 0, h * 0.4, d / 2 + 0.04);   // 문
  ridgeRoof(g, w, d, s.boss ? 3.4 : 2.6, 0xd9b98a, h, 1.1);
  // 흰 난간
  const ry = 0.9, zb = -d / 2 - back + 0.2;
  for (const x of [-w / 2 - 1.1, w / 2 + 1.1]) box(g, 0.06, 0.06, back + 0.6, 0xffffff, x, ry, -d / 2 - back / 2);
  for (let z = -d / 2 - 0.3; z > zb; z -= 1) for (const x of [-w / 2 - 1.1, w / 2 + 1.1]) box(g, 0.06, ry, 0.06, 0xffffff, x, ry / 2, z);
  // 개인 수영장 (흰 상자 위 옥빛 물) · 선베드 · 파라솔 · 계단
  const pw = s.boss ? w : w * 0.6, px = s.boss ? 0 : w / 2 - pw / 2;
  box(g, pw, 1.2, 2.2, 0xf7f5f0, px, -0.45, zb - 0.6); box(g, pw - 0.3, 0.06, 1.9, M(0x4fe0e8, { roughness: 0.05, emissive: 0x1aa0b0, emissiveIntensity: 0.25 }), px, 0.16, zb - 0.6);
  for (const x of [-w / 2 + 0.3, -w / 2 + 1.3]) { box(g, 0.7, 0.2, 1.7, 0xffffff, x, 0.2, -d / 2 - 1.8); box(g, 0.7, 0.45, 0.25, 0xffffff, x, 0.4, -d / 2 - 1.05); }
  cyl(g, 0.04, 0.04, 2.2, 0xdddddd, -w / 2 + 0.8, 1.1, -d / 2 - 3, 6); { const u = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.45, 10), M(0xfaf6ee, { side: THREE.DoubleSide })); u.position.set(-w / 2 + 0.8, 2.3, -d / 2 - 3); u.castShadow = true; g.add(u); }
  for (let i = 0; i < 6; i++) box(g, 0.9, 0.06, 0.3, wood, -w / 2 - 1.6, -0.2 - i * 0.24, -d / 2 - 1 - i * 0.28);
  if (s.boss) {   // 지붕에서 바다로 내려가는 미끄럼틀
    for (let i = 0; i < 9; i++) { const a = i / 8, seg = box(g, 1.1, 0.12, 1.4, 0xe0a466, w / 2 + 1.8 + Math.sin(a * 2.2) * 2.4, 3.6 - a * 3.9, -d / 2 + 1 - a * 6); seg.rotation.x = 0.5; seg.rotation.y = -a * 1.1; }
    for (const x of [w / 2 + 2.6]) box(g, 0.2, 3.4, 0.2, 0xd9c8a8, x, 1.6, -d / 2 + 0.5);
  }
}

// ── 교토 (기요미즈 언덕): 마치야 = 짙은 나무 격자 1층 + 크림 회벽 2층 + 회색 기와, 접수처 = 주홍 누문, 사장님 집 = 기요미즈 무대 ──
function machiya(g, s) {
  const w = s.w, d = s.d, wood = 0x4a2f22, dk = 0x2e1d14;
  box(g, w + 0.8, 4, d + 0.8, 0x8a8478, 0, -1.9, 0);   // 돌 축대 (비탈에 박혀요)
  box(g, w, 2.3, d, wood, 0, 1.15, 0);
  for (let x = -w / 2 + 0.15; x < w / 2; x += 0.24) box(g, 0.07, 1.9, 0.06, dk, x, 1.05, d / 2 + 0.04);   // 센본 격자
  box(g, 1.3, 1.9, 0.08, 0x1e1410, 0, 0.95, d / 2 + 0.07);
  for (let i = 0; i < 3; i++) box(g, 0.4, 0.75, 0.03, 0x2f3a5a, -0.42 + i * 0.42, 1.55, d / 2 + 0.14);   // 노렌
  const eave = box(g, w + 0.6, 0.12, 1.3, 0x585c62, 0, 2.45, d / 2 + 0.5); eave.rotation.x = 0.32;
  box(g, w, 1.6, d - 0.6, 0xe6d8b8, 0, 3.15, -0.2);
  box(g, w * 0.5, 0.5, 0.05, glowMat(0x3a2a1a, 1.2, { emissive: 0xffb060 }), 0, 3.2, d / 2 - 0.48);
  for (let x = -w / 4; x <= w / 4; x += 0.22) box(g, 0.04, 0.5, 0.04, dk, x, 3.2, d / 2 - 0.44);
  ridgeRoof(g, w, d, 1.5, 0x55585c, 3.95, 0.7);
  box(g, 0.32, 0.5, 0.32, glowMat(0xf6efe0, 1.6, { emissive: 0xffc070 }), w / 2 - 0.3, 1.9, d / 2 + 0.4);   // 초롱
}
function niomon(g, w, d, red = 0xd8402a) {   // 주홍 2층 누문 (가운데가 뚫린 문)
  box(g, w + 1, 0.4, d + 1, 0x9a9488, 0, 0.2, 0);
  for (const x of [-w / 2, -w / 6, w / 6, w / 2]) for (const z of [-d / 2, d / 2]) box(g, 0.45, 4.2, 0.45, red, x, 2.5, z);
  for (const x of [-w / 3, w / 3]) box(g, w / 3 - 0.5, 3.2, d - 0.6, 0xf3ece0, x, 2, 0);
  box(g, w + 0.6, 0.5, d + 0.6, red, 0, 4.6, 0);
  ridgeRoof(g, w, d, 0.6, 0x3a3836, 4.85, 1.4);
  box(g, w * 0.86, 2.4, d * 0.8, red, 0, 6.6, 0); for (let x = -w * 0.4; x <= w * 0.4; x += 0.7) box(g, 0.1, 1.8, 0.05, 0xf3ece0, x, 6.6, d * 0.4 + 0.02);
  ridgeRoof(g, w * 0.86, d * 0.8, 2.2, 0x3a3836, 7.8, 1.6);
  for (const x of [-w / 3, w / 3]) box(g, 0.6, 0.9, 0.6, glowMat(0xf6efe0, 1.6, { emissive: 0xffc070 }), x, 4.0, d / 2 + 0.6);
}
function kiyomizu(g, s) {   // 본당 + 앞으로 튀어나온 나무 무대 (아래 골짜기에 긴 기둥)
  const w = s.w, d = s.d, wood = 0x6a3a22;
  box(g, w, 4, d, wood, 0, 2, 0);
  box(g, w - 1.4, 2.6, 0.08, glowMat(0x4a2a18, 1.3, { emissive: 0xffa040 }), 0, 1.6, d / 2 + 0.05);
  for (let x = -w / 2; x <= w / 2; x += 1.2) box(g, 0.3, 4, 0.3, 0x4a2414, x, 2, d / 2 + 0.2);
  ridgeRoof(g, w, d, 4.6, 0x4a3226, 4, 2.2);
  // 무대: 앞으로 8칸, 아래로 기둥을 땅까지
  const D0 = d / 2, D1 = d / 2 + 8;
  box(g, w + 3, 0.4, D1 - D0 + 0.5, 0xa77a4a, 0, -0.2, (D0 + D1) / 2);
  for (let x = -w / 2 - 1.2; x <= w / 2 + 1.21; x += (w + 2.4) / 6) for (let z = D0 + 0.5; z <= D1 + 0.01; z += 2.5) {
    const wx = s.x + x, wz = s.z + z, len = Math.max(0.5, (g.position.y) - L.T(wx, wz) + 0.4);
    box(g, 0.35, len, 0.35, 0x5a3420, x, -len / 2, z);
    if (len > 3) for (let y = -2; y > -len; y -= 2.6) box(g, 0.2, 0.2, 2.5, 0x5a3420, x, y, z - 1.25);
  }
  for (let x = -w / 2 - 1.4; x <= w / 2 + 1.4; x += 0.7) box(g, 0.1, 0.9, 0.1, 0x8a5a34, x, 0.45, D1 + 0.2);
  box(g, w + 3, 0.1, 0.16, 0x8a5a34, 0, 0.9, D1 + 0.2);
  for (const x of [-w / 2 - 0.6, w / 2 + 0.6]) box(g, 0.5, 0.7, 0.5, glowMat(0xf6efe0, 1.6, { emissive: 0xffc070 }), x, 0.6, D1 - 0.4);
}
function buildKyoto(g, s) {
  if (s.boss) { kiyomizu(g, s); return; }
  if (s.key === 'lobby') { niomon(g, s.w, s.d); return; }
  machiya(g, s);
  if (s.key === 'security') box(g, 0.4, 0.4, 0.4, 0xff4b3a, 0, 5.8, 0, { emissive: 0xff2a1a, emissiveIntensity: 0.6 });
}
function buildLot(g, s, id) {
  const c = id === 'kyoto' ? 0x6e4c30 : 0xc9a06b;
  if (id === 'maldives') { for (let x = -s.w / 2; x <= s.w / 2; x += 2) for (const z of [-s.d / 2, s.d / 2]) cyl(g, 0.15, 0.15, 2, 0x6e5a44, x, -0.9, z, 6); box(g, s.w + 1, 0.2, s.d + 1, 0xc8a57a, 0, -0.05, 0); }
  for (let i = -s.w / 2; i <= s.w / 2; i += 0.8) { box(g, 0.12, 0.8, 0.12, c, i, 0.4, -s.d / 2); box(g, 0.12, 0.8, 0.12, c, i, 0.4, s.d / 2); }
  for (let i = -s.d / 2; i <= s.d / 2; i += 0.8) { box(g, 0.12, 0.8, 0.12, c, -s.w / 2, 0.4, i); box(g, 0.12, 0.8, 0.12, c, s.w / 2, 0.4, i); }
  box(g, 1.6, 1, 0.1, 0xf2c94c, 0, 1.2, 0); cyl(g, 0.06, 0.06, 1.2, c, 0, 0.6, 0);
}

// 광장: 둥근 벤치 6개(앉을 자리 12) · 아이스크림 수레 · 가운데 분수(파타야는 큰 레인트리, 교토는 돌 연못)
const SEATS = [], KITE_SPOTS = [];
let CART = null;
function buildPlaza(id) {
  SEATS.length = 0; KITE_SPOTS.length = 0;
  const P = L.plaza, y0 = gy(P.x, P.z), wood = id === 'kyoto' ? 0x6e4c30 : 0xb98a5a, stone = id === 'kyoto' ? 0xb8b0a0 : id === 'andaz' ? 0xe2d8c6 : 0xf6eed6;
  const pz = new THREE.Group(); pz.position.set(P.x, y0, P.z); world.add(pz);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(P.r, P.r, 0.08, 48), M(stone)); floor.position.y = 0.04; floor.receiveShadow = true; pz.add(floor);
  if (id === 'andaz') rainTree(P.x, P.z, 0.85);
  else if (id === 'kyoto') { cyl(pz, 1.8, 2, 0.4, 0x7a7468, 0, 0.2, 0, 20); cyl(pz, 1.6, 1.6, 0.42, 0x4f7a72, 0, 0.22, 0, 20); box(pz, 0.7, 0.6, 0.6, 0x6e6a62, 0.5, 0.6, 0.2, { flatShading: true }); }
  else { cyl(pz, 2, 2.2, 0.6, 0xe8e2d4, 0, 0.3, 0, 24); cyl(pz, 1.8, 1.8, 0.62, 0x5fdbe8, 0, 0.32, 0, 24); cyl(pz, 0.22, 0.3, 1.6, 0xe8e2d4, 0, 0.8, 0); const w = cyl(pz, 0.2, 0.55, 0.8, 0x9fe6f2, 0, 2.0, 0, 12); w.material.transparent = true; w.material.opacity = 0.6; }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6, r = P.benchR, x = Math.sin(a) * r, z = Math.cos(a) * r;
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = a + Math.PI; pz.add(b);
    box(b, 2.2, 0.12, 0.7, wood, 0, 0.55, 0); box(b, 2.2, 0.6, 0.1, wood, 0, 0.9, -0.33);
    for (const sx of [-1, 1]) box(b, 0.12, 0.55, 0.6, 0x3a3a3a, sx * 0.95, 0.27, 0);
    for (const sx of [-0.5, 0.5]) { const p = new THREE.Vector3(sx, 0, 0.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), a + Math.PI).add(new THREE.Vector3(P.x + x, y0, P.z + z)); SEATS.push({ pos: p, rot: a, taken: null }); }
  }
  // 아이스크림 수레 (줄무늬 차양)
  const cp = L.cart, c = new THREE.Group(); c.position.set(cp.x, gy(cp.x, cp.z), cp.z); c.rotation.y = cp.r || 0.7; world.add(c);
  box(c, 2, 1.1, 1.1, 0xf4f1ea, 0, 0.75, 0); box(c, 2.05, 0.2, 1.15, 0xff8fb1, 0, 1.0, 0);
  for (const x of [-0.7, 0.7]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 6, 14), M(0x333333)); w.position.set(x, 0.28, 0.6); c.add(w); }
  for (const x of [-0.95, 0.95]) box(c, 0.07, 1.2, 0.07, 0xb0b0b0, x, 1.9, 0);
  for (let i = 0; i < 6; i++) box(c, 0.36, 0.08, 1.4, i % 2 ? 0xffffff : 0xff6b8a, -0.9 + i * 0.36, 2.5, 0);
  for (const [x, col] of [[-0.5, 0xffd1dc], [0, 0xfff1b8], [0.5, 0xbfe8d0]]) cyl(c, 0.14, 0.14, 0.18, col, x, 1.4, 0, 10);
  const cl = label('아이스크림'); cl.scale.multiplyScalar(0.55); cl.position.y = 3.3; c.add(cl);
  CART = new THREE.Vector3(0.9, 0, 1.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), c.rotation.y).add(c.position).setY(0);
  for (const k of L.kites) KITE_SPOTS.push({ pos: k.clone(), kite: null });
}

// ───────── 푸드코트: 그 나라에 가면 꼭 먹어야 하는 음식 노점 4곳 + 파라솔 식탁 4개(16자리) ─────────
// kind = 그릇 모양 (plate 접시 · bowl 국그릇 · glass 유리잔 · skewer 꼬치 · balls 동그란 튀김), col = 음식 색, sign = 노점 색
const FOODS = {
  andaz: [
    { name: '팟타이', kind: 'plate', col: 0xe0a050, sign: 0xd9483b, say: '팟타이엔 땅콩 듬뿍!' },
    { name: '똠얌꿍', kind: 'bowl', col: 0xe0602a, sign: 0xe2873a, say: '똠얌꿍 새콤 매콤해요!' },
    { name: '망고 찹쌀밥', kind: 'plate', col: 0xffc93c, sign: 0x3f9a5a, say: '망고 찹쌀밥 달콤해요~' },
    { name: '쏨땀', kind: 'plate', col: 0x9fd36a, sign: 0x2f7a96, say: '쏨땀 아삭아삭!' },
  ],
  maldives: [
    { name: '마스후니', kind: 'plate', col: 0xf3ead2, sign: 0x2aa6c8, say: '마스후니를 로시 빵에 싸 먹어요' },
    { name: '가루디야', kind: 'bowl', col: 0xd9c08a, sign: 0x3f7a4f, say: '가루디야 생선 국물 시원해요' },
    { name: '마스 리하', kind: 'bowl', col: 0xd98a2a, sign: 0xe2603d, say: '참치 커리 마스 리하 최고!' },
    { name: '굴라', kind: 'balls', col: 0xc98a3a, sign: 0x9a5a7a, say: '굴라 한 입에 쏙!' },
  ],
  kyoto: [
    { name: '유도후', kind: 'bowl', col: 0xf7f3e8, bowl: 0x3a2a1a, sign: 0x4f6a8f, say: '유도후 따끈하고 부드러워요' },
    { name: '니신 소바', kind: 'bowl', col: 0x8a5a2a, bowl: 0xa33b2a, sign: 0x6e4c30, say: '니신 소바 국물 진하다' },
    { name: '말차 파르페', kind: 'glass', col: 0x6f9a42, sign: 0x3f7a4f, say: '말차 파르페 쌉싸름 달콤!' },
    { name: '미타라시 당고', kind: 'skewer', col: 0xd9b07a, sign: 0xb4523a, say: '당고 소스가 달짝지근해요' },
  ],
};
let FC = { x: 0, z: 0, ry: 0 };   // 동네 배치(L.fc)에서 정해요
const FCW = (x, z) => new THREE.Vector3(x, 0, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), FC.ry).add(new THREE.Vector3(FC.x, 0, FC.z));
const STALLS = [], FOOD_SEATS = [], VENDORS = [];
function dish(f, k = 1) {
  const g = new THREE.Group();
  if (f.kind === 'plate' || f.kind === 'balls') cyl(g, 0.3, 0.26, 0.05, 0xffffff, 0, 0.025, 0, 14);
  if (f.kind === 'plate') cyl(g, 0.21, 0.24, 0.1, f.col, 0, 0.09, 0, 10);
  if (f.kind === 'balls') for (const [x, z] of [[-0.1, 0.05], [0.1, 0.05], [0, -0.1]]) ball(g, 0.08, f.col, x, 0.12, z);
  if (f.kind === 'bowl') { cyl(g, 0.26, 0.15, 0.2, f.bowl ?? 0xf4f1ea, 0, 0.1, 0, 14); cyl(g, 0.23, 0.23, 0.02, f.col, 0, 0.19, 0, 14); }
  if (f.kind === 'glass') { const gl = cyl(g, 0.11, 0.07, 0.42, 0xffffff, 0, 0.21, 0, 10); gl.material.transparent = true; gl.material.opacity = 0.45; cyl(g, 0.09, 0.06, 0.32, f.col, 0, 0.17, 0, 10); ball(g, 0.09, 0xfff8e8, 0, 0.42, 0); }
  if (f.kind === 'skewer') { cyl(g, 0.015, 0.015, 0.55, 0xc9a86a, 0, 0.27, 0, 5); for (const y of [0.22, 0.35, 0.48]) ball(g, 0.07, f.col, 0, y, 0); }
  g.scale.setScalar(k); return g;
}
function buildFoodCourt(id) {
  STALLS.length = 0; FOOD_SEATS.length = 0; VENDORS.length = 0;
  FC = L.fc; const T = THEMES[id], foods = FOODS[id], y0 = gy(FC.x, FC.z);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.07, 40), M(id === 'kyoto' ? 0xa8a294 : T.plaza)); floor.position.set(FC.x, y0 + 0.04, FC.z); floor.receiveShadow = true; world.add(floor);
  const sign = label(FC.name || '푸드코트'); sign.scale.multiplyScalar(0.8); sign.position.copy(FCW(0, -1.5)).setY(y0 + 5.6); world.add(sign);
  // 노점: 뒤쪽 2곳(가운데를 보고), 양옆 2곳(안쪽을 보고)
  [[-1.7, -3.6, 0], [1.7, -3.6, 0], [-6.2, -1, Math.PI / 2], [6.2, -1, -Math.PI / 2]].forEach(([x, z, r], i) => {
    const f = foods[i], s = new THREE.Group(); s.position.copy(FCW(x, z)).setY(y0); s.rotation.y = FC.ry + r; world.add(s);
    const wood = id === 'kyoto' ? 0x5a3a24 : id === 'maldives' ? 0xc49a6a : 0xf4f1ea;
    box(s, 2.4, 1, 1, wood, 0, 0.5, 0); box(s, 2.5, 0.1, 1.15, id === 'kyoto' ? 0x3a2a1a : 0xe6dfcf, 0, 1.05, 0.05);
    for (const sx of [-1.15, 1.15]) box(s, 0.1, 2.6, 0.1, 0x6e4c30, sx, 1.3, -0.45);
    if (id === 'kyoto') {   // 교토: 기와 지붕 + 노렌(가게 앞 천)
      box(s, 2.8, 0.18, 1.6, 0x2e2a26, 0, 2.65, 0);
      for (let j = 0; j < 4; j++) box(s, 0.55, 0.6, 0.03, f.sign, -0.85 + j * 0.57, 2.25, 0.55);
    } else {   // 줄무늬 차양
      for (let j = 0; j < 7; j++) { const a = box(s, 0.36, 0.08, 1.6, j % 2 ? 0xffffff : f.sign, -1.08 + j * 0.36, 2.55, 0.25); a.rotation.x = 0.22; }
      if (id === 'maldives') box(s, 2.7, 0.25, 1.7, 0xc9a46a, 0, 2.75, 0.2);   // 몰디브: 야자잎 지붕
    }
    const big = dish(f, 1.7); big.position.set(0.55, 1.1, 0.15); s.add(big);
    const small = dish(f, 1.2); small.position.set(-0.6, 1.1, 0.2); s.add(small);
    const tag = label(f.name); tag.scale.multiplyScalar(0.5); tag.position.set(0, 3.4, 0); s.add(tag);
    const v = person({ shirt: 0xffffff, pants: 0x3a3a3a, hair: 0x2a1d16, hat: id === 'kyoto' ? f.sign : 0xffffff }); v.position.set(0, 0, -0.95); s.add(v);
    box(v.userData.body, 0.72, 0.6, 0.05, f.sign, 0, 1.05, 0.21);   // 앞치마
    const vendor = { g: v, chat: 6 + rnd() * 20, vendor: true, food: f }; VENDORS.push(vendor);
    STALLS.push({ food: f, vendor, order: FCW(x + Math.sin(r) * 1.4, z + Math.cos(r) * 1.4) });
  });
  // 파라솔 식탁 넷, 식탁마다 의자 네 개
  const top = id === 'kyoto' ? 0x6e4c30 : 0xf4f1ea, para = id === 'kyoto' ? [0xc0392b] : id === 'maldives' ? [0xf6eed6, 0x7fe0dc] : [0xff8fb1, 0xf2c94c, 0x43c9dc];
  [[0, 0.4], [0, 3.6], [-6, 3], [6, 3]].forEach(([tx, tz], i) => {
    const p = FCW(tx, tz), tg = new THREE.Group(); tg.position.set(p.x, y0, p.z); world.add(tg);
    cyl(tg, 0.85, 0.85, 0.08, top, 0, 0.85, 0, 16); cyl(tg, 0.1, 0.1, 0.85, 0x555555, 0, 0.42, 0, 6);
    cyl(tg, 0.05, 0.05, 2.2, 0xdddddd, 0, 1.95, 0, 6);
    const u = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.6, 8), M(para[i % para.length], { side: THREE.DoubleSide })); u.position.set(0, 3.1, 0); u.castShadow = true; tg.add(u);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4, sx = p.x + Math.sin(a) * 1.15, sz = p.z + Math.cos(a) * 1.15;
      cyl(world, 0.25, 0.22, 0.5, id === 'kyoto' ? 0x3a2a1a : 0xb98a5a, sx, y0 + 0.25, sz, 8);
      FOOD_SEATS.push({ pos: new THREE.Vector3(sx, y0, sz), rot: Math.atan2(p.x - sx, p.z - sz), taken: null });
    }
  });
}

// ───────── 말풍선: 머리 위에 몇 초 동안 ─────────
// 시간대: 새벽 · 아침 · 오전 · 점심 · 오후 · 저녁 · 밤 (보는 사람 컴퓨터 시계 기준)
function slot() { const h = new Date().getHours() + new Date().getMinutes() / 60; return h < 5 ? 'dawn' : h < 9 ? 'morning' : h < 12 ? 'am' : h < 13.5 ? 'lunch' : h < 18 ? 'pm' : h < 21 ? 'evening' : 'night'; }
const HELLO = {
  dawn: ['아직 안 주무세요?', '새벽 공기 차가워요', '일찍 나오셨네요!'],
  morning: ['좋은 아침이에요!', '아침 드셨어요?', '오늘도 반가워요!'],
  am: ['오전도 힘내세요!', '커피 한잔 하셨어요?', '안녕하세요, 사장님!'],
  lunch: ['점심 맛있게 드세요!', '점심 뭐 드실 거예요?', '푸드코트 같이 가실래요?'],
  pm: ['오후도 화이팅!', '나른한 오후네요', '간식 시간이에요~'],
  evening: ['오늘도 수고하셨어요', '저녁 노을 예쁘죠?', '퇴근 준비 하세요~'],
  night: ['늦게까지 계시네요', '푹 쉬세요!', '밤바람이 시원해요'],
};
// 방마다 하는 일 (시간대에 맞는 말이 없으면 any 에서 골라요)
const WORK = {
  train: { morning: ['오늘 연수 일정 챙겨 둘게요'], am: ['연수 기록 정리하는 중이에요'], lunch: ['연수 사진 정리하고 밥 먹으러 가요'], pm: ['연수 소감 받아 적는 중'], evening: ['오늘 연수 기록 마감!'], night: ['연수 기록 백업해 둘게요'], any: ['새 연수 기록이 왔어요'] },
  links: { morning: ['새 링크 꽂으러 가요'], am: ['책장 분류 다시 했어요'], pm: ['안 열리는 링크 고쳐 둘게요'], evening: ['오늘 모은 링크 정리 끝'], any: ['좋은 사이트 찾았어요!'] },
  moral: { morning: ['도덕 수업 자료 열어 둘게요'], am: ['도덕 수업 자료 구경 오세요'], pm: ['토론 수업 자료 새로 걸었어요'], evening: ['전시실 불 끄러 가요'], any: ['오늘 수업 자료 둘러보세요'] },
  others: { morning: ['타교과 자료실 문 열었어요'], am: ['다른 과목 자료도 구경 오세요'], pm: ['미술 · 과학 자료 새로 왔어요'], evening: ['자료실 정리하고 갈게요'], any: ['다른 과목에서 배울 게 많아요'] },
  plans: { morning: ['오늘 지도안 초안 시작!'], am: ['지도안 다듬는 중이에요'], pm: ['활동지도 같이 만들었어요'], evening: ['지도안 서랍 정리 끝'], night: ['내일 수업 준비 거의 다 됐어요'], any: ['좋은 수업 아이디어 있어요?'] },
  task: { morning: ['오늘 마감 과제 확인할게요'], am: ['할 일 체크리스트 정리 중'], pm: ['마감 다가온 과제 있어요!'], evening: ['오늘 할 일 거의 끝!'], any: ['작업대 깨끗이 비워 뒀어요'] },
  aiedu: { morning: ['아침 AI 소식 정리했어요'], am: ['새 AI 도구 써 보는 중'], pm: ['AI 수업 아이디어 메모 중'], evening: ['오늘 배운 AI 도구 정리'], any: ['새 AI 소식 모으는 중이에요'] },
  security: { morning: ['아침 문단속 확인 끝!'], am: ['수상한 메일 없나 보는 중'], pm: ['비밀번호 바꿀 때 됐어요'], evening: ['퇴근 전 잠금 확인할게요'], night: ['밤에도 지키고 있어요'], any: ['보안 점검 이상 없어요'] },
  lobby: { morning: ['접수처 문 열었어요!'], am: ['새 자료 오면 바로 나눌게요'], pm: ['들어온 서류 분류 중이에요'], evening: ['오늘 접수 마감했어요'], any: ['자료 넣으실 거 있으세요?'] },
  archive: { morning: ['보관함 열쇠 챙겼어요'], evening: ['보관실 잠그고 갈게요'], any: ['원본은 안전하게 보관 중이에요'] },
  secretary: { morning: ['사장님, 브리핑 준비됐어요'], am: ['오늘 일정 정리해 둘게요'], lunch: ['점심은 푸드코트 어떠세요?'], pm: ['오후 일정 알려 드릴게요'], evening: ['오늘 일정 다 끝났어요'], night: ['내일 일정도 챙겨 둘게요'], any: ['사장님 찾으시는 분 있어요'] },
  friend: { lunch: ['푸드코트 가 볼까?'], any: ['오늘 날씨 좋다~', '연구소 마을 산책 최고', '광장 분수 시원하다'] },
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function workLine(k) { const w = WORK[k] || WORK.friend; return pick(w[slot()] || w.any || HELLO[slot()]); }
const helloLine = () => pick(HELLO[slot()]);
function hello(n) { const h = THEMES[theme].hello; return n.key === 'friend' || n.vendor ? (theme === 'kyoto' && slot() === 'morning' ? '오하요~' : h) + ' ' + helloLine() : helloLine(); }
function lineFor(n) {
  if (n.vendor) return pick([`${n.food.name} 드시고 가세요~`, `${n.food.name} 맛있어요!`, THEMES[theme].hello]);
  const d = n.doing;
  if (d?.act === 'eat') return d.food.say;
  if (d?.act === 'sit') return pick(['잠깐 쉬었다 갈게요', '벤치 그늘이 시원해요', '오늘 하늘 예쁘다']);
  if (d?.act === 'icecream') return pick(['아이스크림 최고!', '녹기 전에 얼른 먹어요']);
  if (d?.act === 'npckite') return pick(['바람 딱 좋다~', '연이 높이 올라가요!']);
  if (n.holding) return n.key === 'secretary' ? '사장님께 드릴 서류예요' : '접수처에 서류 갖다 줄게요';
  return workLine(n.key);
}
function bubbleTex(text) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), F = `44px "Ownglyph_UNZ-Rg", sans-serif`;
  g.font = F; const w = Math.ceil(g.measureText(text).width) + 48; c.width = w; c.height = 96; g.font = F;
  g.fillStyle = '#fff'; g.strokeStyle = 'rgba(31,42,36,.5)'; g.lineWidth = 4;
  g.beginPath(); g.roundRect(3, 3, w - 6, 64, 30); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(w / 2 - 13, 64); g.lineTo(w / 2, 90); g.lineTo(w / 2 + 13, 64); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(w / 2 - 13, 67); g.lineTo(w / 2, 90); g.lineTo(w / 2 + 13, 67); g.stroke();
  g.fillStyle = '#1f2a24'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 37);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { t, w };
}
let talking = 0;
function say(n, text, sec = 4) {
  const { t, w } = bubbleTex(text);
  if (!n.say) { n.say = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true })); n.say.renderOrder = 11; n.g.add(n.say); }
  else n.say.material.map?.dispose();
  if (!(n.sayT > 0)) talking++;
  n.say.material.map = t; n.say.material.needsUpdate = true; n.say.scale.set(w / 96 * 1.15, 1.15, 1); n.say.position.y = n.vendor ? 3.2 : 3.55; n.say.visible = true; n.sayT = sec;
}
function chatter(dt) {
  for (const n of [...npcs, ...VENDORS]) {
    if (n.metT > 0) n.metT -= dt;
    if (n.sayT > 0) { n.sayT -= dt; if (n.sayT <= 0) { n.say.visible = false; talking--; if (n.queue) { say(n, n.queue); n.queue = null; } } continue; }
    // 사장님이 가까이 오면 시간대 인사 + 자기 일 이야기
    if (!n.vendor && !(n.metT > 0) && talking < 5 && me && n.g.position.distanceTo(me.g.position) < 4.5) { say(n, hello(n), 2.6); n.queue = lineFor(n); n.metT = 45; continue; }
    n.chat = (n.chat ?? 5 + Math.random() * 25) - dt;
    if (n.chat <= 0) { n.chat = 18 + Math.random() * 30; if (talking < 5) say(n, Math.random() < 0.2 ? hello(n) : lineFor(n)); }
  }
}

function palm(x, z, k = 1) {
  const g = new THREE.Group(); g.position.set(x, gy(x, z), z); world.add(g); const lean = (rnd() - 0.5) * 0.5;
  for (let i = 0; i < 7; i++) box(g, 0.32, 0.8, 0.32, 0x8a6a46, lean * i * 0.4, 0.4 + i * 0.75 * k, 0);
  const top = new THREE.Group(); top.position.set(lean * 2.8, 5.6 * k, 0); g.add(top);
  for (let i = 0; i < 6; i++) { const f = box(top, 3.2 * k, 0.12, 0.7, i % 2 ? 0x3f8f4a : 0x4f9f52, 1.4 * k, 0, 0); f.geometry.translate(0, 0, 0); const p = new THREE.Group(); p.add(f); p.rotation.y = (i / 6) * Math.PI * 2; p.rotation.z = -0.35; top.add(p); }
  return g;
}
function tree(x, z, c, k = 1) { const g = new THREE.Group(); g.position.set(x, gy(x, z), z); world.add(g); box(g, 0.4 * k, 1.6 * k, 0.4 * k, 0x6e4a2c, 0, 0.8 * k, 0); box(g, 2.4 * k, 1.8 * k, 2.4 * k, c, 0, 2.4 * k, 0, { flatShading: true }); box(g, 1.6 * k, 1.2 * k, 1.6 * k, c, 0, 3.6 * k, 0); return g; }
// 나무를 심어도 되는 곳: 건물 · 광장 · 푸드코트 · 길과 겹치지 않게
const freeAt = (x, z, pad = 2.5) => Math.hypot(x - L.plaza.x, z - L.plaza.z) > L.plaza.r + 2 && Math.hypot(x - L.fc.x, z - L.fc.z) > 9 && (!L.free || L.free(x, z))
  && !SPOTS.some((s) => Math.hypot(x - s.x, z - s.z) < Math.max(s.w, s.d) / 2 + pad + (s.boss ? 3 : 0));
// 레인트리: 여러 갈래로 기운 줄기 + 넓게 퍼진 납작한 잎 (안다즈 잔디밭의 큰 나무)
function rainTree(x, z, k = 1) {
  const g = new THREE.Group(); g.position.set(x, gy(x, z), z); world.add(g);
  for (const [rz, rx] of [[0.32, 0.1], [-0.28, -0.12], [0.05, 0.3]]) { const t = cyl(g, 0.18 * k, 0.32 * k, 5.4 * k, 0x5a4a3a, 0, 2.5 * k, 0, 7); t.rotation.set(rx, 0, rz); t.position.x = -rz * 2.4 * k; t.position.z = rx * 2.4 * k; }
  const leaf = [0x5d7f32, 0x6f8f3a, 0x4f7029];
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, r = i ? 3.2 * k : 0; const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), M(leaf[i % 3], { flatShading: true })); m.scale.set(3 * k, 1.1 * k, 3 * k); m.position.set(Math.sin(a) * r, 5.4 * k + (i % 2) * 0.5 * k, Math.cos(a) * r); m.castShadow = true; g.add(m); }
  return g;
}
function lily(x, z, r, y = 0.12) { cyl(world, r, r, 0.08, 0x6f8f3a, x, y, z, 14); }
function pond(x0, x1, z0, z1, lilies = 3) {   // 짙은 거울 연못 + 돌 테두리 + 둥근 연잎 섬
  box(world, x1 - x0 + 0.8, 0.1, z1 - z0 + 0.8, 0xe2d8c6, (x0 + x1) / 2, 0.03, (z0 + z1) / 2).castShadow = false;
  const w = box(world, x1 - x0, 0.1, z1 - z0, M(0x2c4648, { roughness: 0.05, metalness: 0.35 }), (x0 + x1) / 2, 0.06, (z0 + z1) / 2); w.castShadow = false;
  for (let i = 0; i < lilies; i++) lily(x0 + 1.4 + rnd() * (x1 - x0 - 2.8), z0 + 1.4 + rnd() * (z1 - z0 - 2.8), 0.8 + rnd() * 0.9);
}
const umbrella = (x, z, c = 0xf1ead8, r = 1.8, y = gy(x, z)) => { cyl(world, 0.05, 0.05, 2.6, 0xdddddd, x, y + 1.3, z, 6); const u = new THREE.Mesh(new THREE.ConeGeometry(r, 0.5, 10), M(c, { side: THREE.DoubleSide })); u.position.set(x, y + 2.7, z); u.castShadow = true; world.add(u); };
const lounger = (x, z, rot = 0, y = gy(x, z)) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; world.add(g); box(g, 0.75, 0.25, 1.9, 0xf7f5f0, 0, 0.25, 0); box(g, 0.75, 0.5, 0.25, 0xf7f5f0, 0, 0.5, -0.85); };

// ───────── 동네 배치 ─────────
// 길 그물: 선(점 목록)들을 이어 붙이고, 곁길(문 · 광장 …)은 가장 가까운 선에 이어요. 직원은 이 길로만 다녀요
function makeNet(lines, spurs) {
  const nodes = [], add = (p) => { let n = nodes.find((q) => q.p.distanceTo(p) < 0.4); if (!n) { n = { p: p.clone().setY(0), e: [] }; nodes.push(n); } return n; };
  const link = (a, b) => { if (a !== b) { const d = a.p.distanceTo(b.p); a.e.push([b, d]); b.e.push([a, d]); } };
  const segs = []; for (const ln of lines) for (let i = 0; i < ln.length - 1; i++) segs.push([ln[i], ln[i + 1]]);
  const proj = (p, [a, b]) => { const ab = b.clone().sub(a), t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1); return { t, q: a.clone().addScaledVector(ab, t) }; };
  const pts = lines.flat().map((p) => p.clone());
  const sp = spurs.map((s) => { let best = null; for (const sg of segs) { const r = proj(s, sg), d = r.q.distanceTo(s); if (!best || d < best.d) best = { d, q: r.q }; } pts.push(best.q); return [s, best.q]; });
  for (const sg of segs) { const on = pts.map((p) => ({ p, ...proj(p, sg) })).filter((r) => r.q.distanceTo(r.p) < 0.4).sort((a, b) => a.t - b.t); for (let i = 0; i < on.length - 1; i++) link(add(on[i].p), add(on[i + 1].p)); }
  for (const [s, q] of sp) link(add(s), add(q));
  return nodes;
}
function route(from, to) {   // from 에서 to 까지 길을 따라 가는 점들 (마지막이 to)
  const net = L.net; if (!net || from.distanceTo(to) < 4) return [to];
  const near = (p) => net.reduce((a, n) => (n.p.distanceTo(p) < a.p.distanceTo(p) ? n : a));
  const A = near(from), B = near(to); if (A === B) return [to];
  const dist = new Map([[A, 0]]), prev = new Map(), open = new Set([A]);
  while (open.size) { let u = null; for (const n of open) if (!u || dist.get(n) < dist.get(u)) u = n; open.delete(u); if (u === B) break; for (const [v, w] of u.e) { const nd = dist.get(u) + w; if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); open.add(v); } } }
  if (!prev.has(B)) return [to];
  const out = []; for (let n = B; n; n = prev.get(n)) out.unshift(n.p.clone());
  return [...out, to];
}
const door = (s) => V(s.x + Math.sin(s.rot) * (s.d / 2 + 1.6), s.z + Math.cos(s.rot) * (s.d / 2 + 1.6));
const loopOf = (pts) => pts.map(([x, z]) => V(x, z));

// ── 파타야 1안: 비치로드 일자 거리 ──
// 북쪽(-z)부터: 워킹 스트리트 푸드코트 · 접수처(거울 연못 정자) · 건물 한 줄 · 해변 큰길 · 잔디밭 광장 · 모래사장 · 바다, 사장님 집은 바다로 난 부두 끝
function layoutPattaya() {
  const xs = [-52, -42, -32, -22, -12, 12, 22, 32, 42, 52], keys = ['security', 'moral', 'others', 'links', 'train', 'archive', 'aiedu', 'task', 'plans', 'store2'];
  const spots = keys.map((k, i) => spot(k, xs[i], 9, 0));
  spots.push(spot('lobby', 0, -4, 0, { w: 12, d: 9, tagY: 9.6 }));
  spots.push(spot('boss', 36, 42, Math.PI, { w: 8, d: 6, tagY: 9.6 }));
  const ROAD = 16, plaza = { x: 0, z: 21.5, r: 5, benchR: 3.7 };
  const lines = [loopOf([[-58, ROAD], [58, ROAD]]), loopOf([[-17, ROAD], [-17, -13], [17, -13], [17, ROAD]]), loopOf([[0, ROAD], [0, 3]]), loopOf([[-44, 28], [44, 28]]), loopOf([[-8, ROAD], [-8, 28]]), loopOf([[8, ROAD], [8, 28]]), loopOf([[36, 28], [36, 37]])];
  return {
    spots, plaza, H: () => 0,
    fc: { x: 0, z: -21, ry: 0, name: '워킹 스트리트 야시장' },
    cart: { x: 9, z: 20, r: -0.4 }, kites: loopOf([[-30, 28.5], [-20, 28.5], [18, 28.5], [26, 28.5]]), kiteFace: Math.PI,
    start: V(12, 19), cam: V(-6, 28, 38),
    net: makeNet(lines, [...spots.map(door), V(plaza.x - plaza.r, plaza.z)]),
    loops: { bike: loopOf([[-56, 15.2], [56, 15.2], [56, 16.8], [-56, 16.8]]), kite: loopOf([[-42, 27.4], [44, 27.4], [44, 29.6], [-42, 29.6]]), walk: loopOf([[-22, 19], [22, 19], [22, 24.5], [-22, 24.5]]) },
    msg: { kite: '모래사장을 달리며 연을 날려요', bike: '해변 큰길을 자전거로 달려요', walk: '잔디밭 둘레를 천천히 걸어요' },
    ground(id) {
      const T = THEMES[id];
      box(world, 160, 0.6, 92, T.ground, 0, -0.3, -20).castShadow = false;   // 잔디 (z -66 ~ 26)
      box(world, 160, 0.5, 8, T.sand, 0, -0.27, 29).castShadow = false;      // 모래사장
      const shallow = box(world, 160, 0.1, 10, M(T.waterNear, { roughness: 0.2 }), 0, -0.32, 38); shallow.castShadow = false;
      ribbon(loopOf([[-62, ROAD], [62, ROAD]]), 3.6, 0xe9e2d2, 0.02);   // 해변 큰길
      ribbon(loopOf([[-17, ROAD], [-17, -13]]), 2.2, 0xe2d8c6, 0.02); ribbon(loopOf([[17, ROAD], [17, -13]]), 2.2, 0xe2d8c6, 0.02);
      ribbon(loopOf([[-24, -13], [24, -13]]), 3.2, 0xd8c9ae, 0.02);   // 워킹 스트리트
      for (const s of spots) if (!s.boss && s.key !== 'lobby') ribbon([V(s.x, s.z + s.d / 2 + 1), V(s.x, ROAD - 1.6)], 1.8, 0xe2d8c6, 0.03);
      // 접수처 앞 거울 연못: 가운데 돌길로 건너요, 양옆 연못도 정자를 감싸요
      pond(-8, -1.4, 2.8, 13.6, 4); pond(1.4, 8, 2.8, 13.6, 4); pond(-8.9, -7.5, -9, 2.8, 0); pond(7.5, 8.9, -9, 2.8, 0);
      ribbon(loopOf([[0, 2], [0, ROAD]]), 2.6, 0xeee6d6, 0.1);
      for (const z of [4, 7.5, 11]) for (const x of [-1.6, 1.6]) mushLamp(x, z, 0.12);
      for (const [x, z] of [[-4.5, 5], [4.5, 9]]) { box(world, 3, 0.12, 3, 0xeee6d6, x, 0.12, z); mushLamp(x, z, 0.18); }
      // 부두
      box(world, 2.6, 0.2, 12, 0xa07a52, 36, 0.05, 32.5); for (let z = 27; z < 39; z += 2.4) for (const x of [34.9, 37.1]) cyl(world, 0.12, 0.12, 1.4, 0x5a3a24, x, -0.6, z, 6);
    },
    deco() {
      for (let x = -60; x <= 60; x += 6) for (const z of [ROAD - 2.3, ROAD + 2.3]) if (Math.abs(x) > 3) mushLamp(x + (z > ROAD ? 3 : 0), z);   // 큰길 버섯등
      for (let x = -58; x <= 58; x += 5) if (Math.abs(x - 36) > 3) palm(x + rnd() * 1.5, 25.6 + rnd() * 1.4, 0.85 + rnd() * 0.3);
      for (let x = -40; x <= 40; x += 6) { if (Math.abs(x - 36) < 4 || Math.abs(x) < 3) continue; lounger(x - 0.6, 30.2, Math.PI); lounger(x + 0.6, 30.2, Math.PI); umbrella(x, 31.6); }
      for (const [x, z, k] of [[-27, 22, 1], [-45, 21.5, 0.9], [24, 22, 0.95], [48, 21.5, 1], [-60, 3, 1.1], [62, 4, 1], [-28, -8, 1.2], [28, -6, 1.15], [-46, -10, 1], [46, -12, 1.1], [-10, -32, 1.2], [14, -34, 1.1], [-36, -30, 1], [38, -30, 1]]) rainTree(x, z, k);
      for (let i = 0; i < 40; i++) { const x = (rnd() - 0.5) * 140, z = -60 + rnd() * 42; if (freeAt(x, z, 3)) (rnd() < 0.6 ? rainTree(x, z, 0.8 + rnd() * 0.3) : palm(x, z, 0.8)); }
      // 야시장 꼬마전구 줄
      for (let i = 0; i < 18; i++) { const x = -22 + i * 2.6; box(world, 0.16, 0.16, 0.16, glowMat(0xfff0b0, 2.2, { emissive: 0xffd070 }), x, 4.2 - Math.sin((i % 6) / 5 * Math.PI) * 0.5, -13); }
      for (const x of [-23, 23]) cyl(world, 0.08, 0.08, 4.4, 0x444444, x, 2.2, -13, 6);
    },
    free: (x, z) => z < 24 && !(Math.abs(x) < 10 && z > -10 && z < 15) && Math.abs(z - ROAD) > 3 && Math.abs(z + 13) > 3,
  };
}

// ── 몰디브 1안: 섬에서 세 갈래로 뻗은 부두와 물 위 빌라 ──
// 북쪽 작은 섬에 접수처(열린 로비) · 광장 · 비치 바 푸드코트, 남쪽으로 부두가 세 갈래, 양옆에 수상 빌라, 가운데 끝이 사장님 빌라
function layoutMaldives() {
  const IC = V(0, -26), IRX = 21, IRZ = 13.5, J = V(0, 2), DECK = 1.2;
  const onIsland = (x, z) => ((x - IC.x) / IRX) ** 2 + ((z - IC.z) / IRZ) ** 2;
  const arms = [[J, V(-34, 24)], [J, V(34, 24)]];
  const spots = [spot('lobby', 0, -32, 0, { w: 10, d: 7, tagY: 8.6 })];
  const keysL = ['train', 'links', 'moral', 'others', 'security'], keysR = ['archive', 'aiedu', 'task', 'plans', 'store2'];
  [[arms[0], keysL, 1], [arms[1], keysR, -1]].forEach(([[a, b], ks, sg]) => {
    const dir = b.clone().sub(a), Ln = dir.length(); dir.normalize(); const nrm = V(-dir.z, dir.x);
    ks.forEach((k, i) => { const t = 0.2 + i * 0.19, side = (i % 2 ? -1 : 1) * sg, p = a.clone().addScaledVector(dir, Ln * t).addScaledVector(nrm, side * 6.8);
      spots.push(spot(k, +p.x.toFixed(1), +p.z.toFixed(1), Math.atan2(-nrm.x * side, -nrm.z * side), { w: 6.4, d: 5 })); });
  });
  spots.push(spot('boss', 0, 31, Math.PI, { w: 9, d: 6.5, tagY: 9.4 }));
  const plaza = { x: -9, z: -21, r: 4.8, benchR: 3.5 };
  const lines = [loopOf([[0, -28], [0, -13], [0, 2]]), [J, V(-34, 24)], [J, V(34, 24)], loopOf([[0, 2], [0, 26.4]]), loopOf([[-13, -20], [0, -20], [13, -20]])];
  return {
    spots, plaza,
    H: (x, z) => { const e = onIsland(x, z); return e < 1 ? 0 : e < 1.25 ? (e - 1) / 0.25 * DECK : DECK; },
    fc: { x: 10, z: -21.5, ry: -0.35, name: '비치 바 푸드코트' },
    cart: { x: -2, z: -16, r: 0.4 }, kites: loopOf([[-17, -30], [-14, -35], [15, -32], [18, -27]]), kiteFace: 0,
    start: V(0, -6), cam: V(-8, 30, 40),
    net: makeNet(lines, [...spots.map(door), V(plaza.x, plaza.z + plaza.r)]),
    loops: { bike: loopOf([[0, -13], [0, 2], [-34, 24], [0, 2], [0, 26], [0, 2], [34, 24], [0, 2]]), walk: loopOf([[0, -13], [0, 2], [-34, 24], [0, 2], [0, 26], [0, 2], [34, 24], [0, 2]]),
      kite: Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * Math.PI * 2; return V(IC.x + Math.sin(a) * (IRX - 1.2), IC.z + Math.cos(a) * (IRZ - 1.2)); }) },
    msg: { kite: '섬 해변을 달리며 연을 날려요', bike: '부두 위를 자전거로 한 바퀴', walk: '부두를 따라 빌라 사이를 걸어요' },
    ground(id) {
      const T = THEMES[id];
      const near = new THREE.Mesh(new THREE.CircleGeometry(95, 64), M(T.waterNear, { roughness: 0.15 })); near.rotation.x = -Math.PI / 2; near.position.set(0, -0.3, 0); world.add(near);
      const foam = new THREE.Mesh(new THREE.RingGeometry(95, 98, 64), M(0xffffff)); foam.rotation.x = -Math.PI / 2; foam.position.y = -0.29; world.add(foam);
      for (const [x, z, r] of [[-20, 10, 9], [22, 14, 10], [0, 18, 7], [-40, -10, 12], [40, -6, 12]]) { const s = new THREE.Mesh(new THREE.CircleGeometry(r, 24), M(0xa8eee6, { roughness: 0.2 })); s.rotation.x = -Math.PI / 2; s.position.set(x, -0.29, z); world.add(s); }   // 얕은 모래 바닥
      const sand = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.12, 0.7, 64), M(T.sand)); sand.scale.set(IRX + 1.5, 1, IRZ + 1.5); sand.position.set(IC.x, -0.35, IC.z); sand.receiveShadow = true; world.add(sand);
      const grass = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.7, 64), M(T.ground)); grass.scale.set(IRX - 4, 1, IRZ - 3.5); grass.position.set(IC.x, -0.34, IC.z - 2); grass.receiveShadow = true; world.add(grass);
      // 부두: 섬 끝에서 갈림목까지, 세 갈래
      const jetty = (a, b) => { const len = a.distanceTo(b), m = a.clone().lerp(b, 0.5), j = new THREE.Group(); j.position.set(m.x, DECK - 0.12, m.z); j.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); world.add(j);
        box(j, 2.4, 0.2, len + 1.2, 0xc8a57a, 0, 0, 0); for (let z = -len / 2; z <= len / 2; z += 2.6) for (const x of [-1.1, 1.1]) cyl(j, 0.12, 0.12, 2, 0x6e5a44, x, -1, z, 6); };
      jetty(V(0, -12.5), J); jetty(J, V(-34, 24)); jetty(J, V(34, 24)); jetty(J, V(0, 27));
      ribbon(loopOf([[0, -28], [0, -12.4]]), 2.4, 0xf4efe4, 0.02); ribbon(loopOf([[-13, -20], [13, -20]]), 2, 0xf4efe4, 0.02);
    },
    deco() {
      for (let i = 0; i < 34; i++) { const a = rnd() * Math.PI * 2, r = 0.55 + rnd() * 0.4, x = IC.x + Math.sin(a) * IRX * r, z = IC.z + Math.cos(a) * IRZ * r; if (freeAt(x, z, 2)) palm(x, z, 0.85 + rnd() * 0.35); }
      for (let i = 0; i < 9; i++) { const a = -0.9 + i * 0.22 + Math.PI, x = IC.x + Math.sin(a) * (IRX - 0.5), z = IC.z + Math.cos(a) * (IRZ - 0.5); if (Math.abs(x) > 3 && freeAt(x, z, 1)) lounger(x, z, a); }
      for (const [x, z] of [[-15, -14], [15, -14]]) umbrella(x, z, 0xfaf6ee);
      for (let z = -27; z < -13; z += 3.5) for (const x of [-1.8, 1.8]) mushLamp(x, z, 0.02);
    },
    free: (x, z) => onIsland(x, z) < 0.85,
  };
}

// ── 교토 2안: 기요미즈 언덕 참배길 ──
// 남쪽 아래 주홍 누문(접수처)에서 지그재그 돌계단길(산넨자카)을 올라가면 꼭대기에 기요미즈 무대(사장님 집).
// 오른쪽 비탈에 야사카 오층탑, 왼쪽 굽이에 전망 쉼터 광장, 오른쪽 굽이에 찻집 거리 푸드코트, 무대 아래 골짜기는 단풍
function layoutKyoto() {
  const WAY = loopOf([[0, 31], [-18, 21], [20, 10], [-16, -1], [11, -12], [0, -21], [-5, -21.5]]);
  const base = (z) => { const t = THREE.MathUtils.clamp((28 - z) / 52, 0, 1); return 12 * t * t * (3 - 2 * t); };
  const raw = (x, z) => base(z) - 7 * Math.exp(-((x + 14) ** 2) / 70 - ((z + 15) ** 2) / 22) - (z > 37 && z < 41 ? 0.9 : 0);
  // 건물 자리: 지그재그 굽이 사이 넓은 곳에, 문은 가장 가까운 길 쪽으로
  const nearWay = (x, z) => { let best = null; for (let i = 0; i < WAY.length - 1; i++) { const a = WAY[i], ab = WAY[i + 1].clone().sub(a), t = THREE.MathUtils.clamp(((x - a.x) * ab.x + (z - a.z) * ab.z) / ab.lengthSq(), 0, 1), q = a.clone().addScaledVector(ab, t), d = Math.hypot(q.x - x, q.z - z); if (!best || d < best.d) best = { d, q }; } return best.q; };
  const put = [['security', 9, 22], ['moral', -14, 30.5], ['others', -28, 16], ['links', 0, 21.5], ['train', 16, 18.5], ['aiedu', -8, 9.5], ['archive', 8, -2], ['plans', -1, -2.5], ['task', -21, -9], ['store2', 16, -18]];
  const spots = put.map(([k, x, z]) => { const q = nearWay(x, z); return spot(k, x, z, Math.atan2(q.x - x, q.z - z)); });
  spots.push(spot('lobby', 0, 34, 0, { w: 7.5, d: 4.5, tagY: 10.8, plateY: 0 }));
  spots.push(spot('boss', -14, -31, 0, { w: 12, d: 7, tagY: 11.5 }));
  const plaza = { x: -26, z: 0, r: 5.6, benchR: 3.8 }, fc = { x: 29, z: 10, ry: -Math.PI / 2, name: '찻집 거리 푸드코트' }, TOWER = V(27, -9);
  const flats = [...spots.filter((s) => !s.boss).map((s) => ({ x: s.x, z: s.z, r: Math.max(s.w, s.d) / 2 + 1.2 })), { x: plaza.x, z: plaza.z, r: plaza.r + 1 }, { x: fc.x, z: fc.z, r: 8.5 }, { x: TOWER.x, z: TOWER.z, r: 4.5 }];
  for (const f of flats) f.h = raw(f.x, f.z);
  const T = (x, z) => { let h = raw(x, z); for (const f of flats) { const w = THREE.MathUtils.clamp(1 - (Math.hypot(x - f.x, z - f.z) - f.r) / 2.5, 0, 1); h += (f.h - h) * w; } return h; };
  const deck = (x, z) => x > -21.5 && x < -6.5 && z > -27.6 && z < -18.8;
  const lines = [WAY, loopOf([[0, 31], [0, 37], [0, 40]]), loopOf([[-18, 21], [-21, 9], [-26, 0]]), loopOf([[20, 10], [25, 10]]), loopOf([[-5, -21.5], [-14, -23]]), loopOf([[0, -21], [12, -28], [18, -32]]), loopOf([[-40, 37], [40, 37]])];
  return {
    spots, plaza, fc, T, H: (x, z) => (deck(x, z) ? 12 : T(x, z)),
    cart: { x: -21, z: 4.5, r: 0.8 }, kites: loopOf([[12, -32], [18, -36], [6, -38], [-30, 36]]), kiteFace: Math.PI,
    start: V(6, 14), cam: V(-6, 26, 44),
    net: makeNet(lines, [...spots.map(door), V(plaza.x + plaza.r, plaza.z)]),
    loops: { bike: loopOf([[-40, 36.2], [40, 36.2], [40, 37.8], [-40, 37.8]]), walk: [...WAY, ...WAY.slice(1, -1).reverse()], kite: Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * Math.PI * 2; return V(14 + Math.sin(a) * 7, -35 + Math.cos(a) * 4); }) },
    msg: { kite: '언덕 꼭대기 풀밭에서 연을 날려요', bike: '언덕 아래 개울길을 자전거로', walk: '돌계단 참배길을 오르내려요' },
    pick: true,
    ground(id) {
      const Th = THEMES[id], geo = new THREE.PlaneGeometry(150, 110, 150, 110); geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, T(p.getX(i), p.getZ(i) - 10)); geo.translate(0, 0, -10); geo.computeVertexNormals();
      const t = new THREE.Mesh(geo, M(Th.ground)); t.receiveShadow = true; world.add(t); L.groundMesh = t;
      // 남쪽 아래 개울
      const s = box(world, 150, 0.1, 3.6, M(Th.water, { roughness: 0.15 }), 0, -0.55, 39); s.castShadow = false;
      box(world, 3, 0.25, 5, 0xc0392b, 0, 0.1, 39);   // 붉은 다리
      ribbon(WAY, 3.2, 0xcfc6b2, 0.06, 2);   // 돌계단길
      ribbon(loopOf([[0, 31], [0, 40]]), 3, 0xcfc6b2, 0.06); ribbon(loopOf([[-18, 21], [-21, 9], [-26, 0]]), 2, 0xcfc6b2, 0.06); ribbon(loopOf([[20, 10], [24, 10]]), 2.2, 0xcfc6b2, 0.06);
      ribbon(loopOf([[0, -21], [12, -28], [18, -32]]), 2, 0xcfc6b2, 0.06); ribbon(loopOf([[-40, 37], [40, 37]]), 2.4, 0xd8cfba, 0.04);
    },
    deco() {
      // 야사카 오층탑
      { const pg = new THREE.Group(); pg.position.set(TOWER.x, T(TOWER.x, TOWER.z), TOWER.z); world.add(pg); box(pg, 5.4, 0.8, 5.4, 0x9a9488, 0, 0.4, 0);
        for (let i = 0; i < 5; i++) { const k = 1 - i * 0.1, y = 0.8 + i * 3.1; box(pg, 3.4 * k, 2.4, 3.4 * k, 0x4a2a1e, 0, y + 1.2, 0); box(pg, 3.42 * k, 0.5, 3.42 * k, 0xe8dcc4, 0, y + 1.9, 0); ridgeRoof(pg, 3.4 * k, 3.4 * k, 0.7, 0x2e2a26, y + 2.4, 1.3); }
        cyl(pg, 0.1, 0.1, 4.4, 0xb08a3a, 0, 18.8, 0); for (let i = 0; i < 7; i++) cyl(pg, 0.3, 0.3, 0.1, 0xb08a3a, 0, 17.4 + i * 0.4, 0, 10);
        const t = label('야사카 오층탑'); t.scale.multiplyScalar(0.7); t.position.y = 22.5; pg.add(t); }
      // 길가 석등 · 초롱
      for (let i = 0; i < WAY.length - 1; i++) { const a = WAY[i], b = WAY[i + 1]; for (let t = 0.15; t < 1; t += 0.35) { const p = a.clone().lerp(b, t), dir = b.clone().sub(a).normalize(), x = p.x - dir.z * 2.1, z = p.z + dir.x * 2.1, y = T(x, z); box(world, 0.35, 0.8, 0.35, 0xa8a294, x, y + 0.4, z); box(world, 0.6, 0.45, 0.6, glowMat(0xd8d0c0, 1.4, { emissive: 0xffc070 }), x, y + 1.0, z); box(world, 0.8, 0.18, 0.8, 0x8a8478, x, y + 1.32, z); } }
      // 단풍 (무대 아래 골짜기에 빽빽이) · 수양벚나무 · 소나무
      const maple = [0xc0392b, 0xd35400, 0xe74c3c, 0xe67e22, 0xb03a2e];
      for (let i = 0; i < 70; i++) { const x = -30 + rnd() * 34, z = -24 + rnd() * 20; if (freeAt(x, z, 1.5)) tree(x, z, maple[i % 5], 0.9 + rnd() * 0.5); }
      for (let i = 0; i < 90; i++) { const x = (rnd() - 0.5) * 140, z = -55 + rnd() * 90; if (Math.abs(x) < 46 && z > -36 && z < 34 && rnd() < 0.6) continue; if (freeAt(x, z, 2.5)) tree(x, z, rnd() < 0.7 ? maple[i % 5] : 0x4f7a3a, 0.8 + rnd() * 0.4); }
      for (const [x, z] of [[22, -4], [33, -14], [-8, 24]]) { const g = new THREE.Group(); g.position.set(x, T(x, z), z); world.add(g); box(g, 0.4, 3, 0.4, 0x4a3226, 0, 1.5, 0); for (let j = 0; j < 9; j++) { const a = (j / 9) * Math.PI * 2; box(g, 0.9, 2.4 - (j % 3) * 0.4, 0.9, j % 2 ? 0xf5a8c8 : 0xf0c0d8, Math.sin(a) * 1.4, 2.4, Math.cos(a) * 1.4); } box(g, 2.6, 1, 2.6, 0xf5b8d0, 0, 3.6, 0); }
    },
    free: (x, z) => !deck(x, z) && !WAY.some((p, i) => i < WAY.length - 1 && distSeg(x, z, p, WAY[i + 1]) < 3.5) && !(Math.abs(x) < 3 && z > 30) && Math.hypot(x - TOWER.x, z - TOWER.z) > 4.5,
  };
}
function distSeg(x, z, a, b) { const ab = b.clone().sub(a), t = THREE.MathUtils.clamp(((x - a.x) * ab.x + (z - a.z) * ab.z) / ab.lengthSq(), 0, 1); return Math.hypot(x - (a.x + ab.x * t), z - (a.z + ab.z * t)); }
const LAYOUTS = { andaz: layoutPattaya, maldives: layoutMaldives, kyoto: layoutKyoto };

// ───────── 사람들 ─────────
const STAFF_KEYS = ORDER.map(([k]) => k).filter((k) => k !== 'store2');
const SHIRTS = [0x3f6b55, 0x2f7a96, 0xc9822a, 0x6b5a9a, 0xa33b2a, 0x5a7a3a, 0x2f5d8a, 0x9a5a7a, 0x4a6a6a, 0x8a6a3a];
const npcs = [];
let me = null;
const plazaPt = () => { const a = rnd() * Math.PI * 2, r = L.plaza.r * (0.5 + rnd() * 0.45); return V(L.plaza.x + Math.sin(a) * r, L.plaza.z + Math.cos(a) * r); };
const mark = (v, m) => Object.assign(v, { mark: m });
// 길 그물을 따라 차례로 가요 (점에 mark 가 있으면 도착했을 때 그 일을 해요)
function go(n, list) { n.path = []; let cur = n.g.position.clone().setY(0); for (const t of list) { n.path.push(...route(cur, t)); cur = t; } }
function spawnPeople() {
  talking = 0;
  for (const p of npcs) { scene.remove(p.g); if (p.doing?.obj) scene.remove(p.doing.obj, p.doing.line); } npcs.length = 0; if (me) scene.remove(me.g);
  STAFF_KEYS.forEach((k, i) => {
    const g = person({ shirt: SHIRTS[i % SHIRTS.length], hair: [0x3a2a20, 0x1f1a16, 0x6a4a2a][i % 3], long: i % 3 === 0 });
    const tag = label(JOB(k) || NAME(k)); tag.scale.multiplyScalar(0.55); tag.position.y = 2.75; g.add(tag);
    const home = door(SPOTS.find((s) => s.key === k)); g.position.copy(home); scene.add(g);
    npcs.push({ g, key: k, home, path: [], wait: rnd() * 6, act: null, speed: 1.1 + rnd() * 0.4 });   // 사장님(5)보다 훨씬 천천히
  });
  // 비서: 사장님 집 ↔ 접수처, 친구 셋: 광장 둘레
  const sec = person({ shirt: 0x1f2a3a, hair: 0x2a1d16, long: true }); const st = label('비서'); st.scale.multiplyScalar(0.55); st.position.y = 2.75; sec.add(st); scene.add(sec);
  sec.position.copy(door(SPOTS.find((s) => s.key === 'boss')));
  npcs.push({ g: sec, key: 'secretary', home: sec.position.clone(), path: [], wait: 3, act: null, speed: 1.3 });
  for (let i = 0; i < 3; i++) { const f = person({ shirt: [0xe2603d, 0xf2c94c, 0x7fb3d5][i], hair: 0x4a3020, long: i === 1 }); f.position.copy(plazaPt()); scene.add(f); npcs.push({ g: f, key: 'friend', home: f.position.clone(), path: [], wait: rnd() * 4, act: null, speed: 0.9 }); }
  for (const n of npcs) n.g.position.y = gy(n.g.position.x, n.g.position.z);
  // 사장님
  const g = person({ shirt: 0xf2c94c, pants: 0x3a4a6a, hair: 0x3a2418, long: true });
  const tag = label('사장님', true); tag.scale.multiplyScalar(0.6); tag.position.y = 2.85; g.add(tag);
  g.position.copy(L.start).setY(gy(L.start.x, L.start.z)); g.rotation.y = Math.PI; scene.add(g);
  me = { g, target: null, act: null, t: 0 };
  controls.target.copy(g.position).add(V(0, 0, 1.4));
  camera.position.copy(g.position).add(L.cam);
}
// 직원 하루: 문 앞 → 광장 → 접수처(서류 받기) → 광장 → 문 앞. 사이사이 벤치 · 아이스크림 · 연날리기 · 푸드코트
function nextPlan(n) {
  const lobby = door(LOBBY);
  n.then = null;
  if (n.key === 'friend') { if (rnd() < (slot() === 'lunch' ? 0.6 : 0.25) && foodPlan(n)) return; go(n, [plazaPt()]); n.wait = 2 + rnd() * 5; return; }
  if (n.key === 'secretary') { go(n, [mark(lobby.clone(), 'pickup'), n.home]); n.wait = 6 + rnd() * 6; return; }
  const r = rnd();
  if ((slot() === 'lunch' ? r < 0.7 : r > 0.62 && r < 0.78) && foodPlan(n)) return;   // 점심때는 푸드코트가 북적여요
  if (r < 0.3) { const free = SEATS.filter((x) => !x.taken), seat = free[Math.floor(rnd() * free.length)]; if (seat) { seat.taken = n; go(n, [seat.pos.clone().setY(0)]); n.then = { act: 'sit', seat, dur: 14 + rnd() * 16 }; n.wait = 0; return; } }
  if (r < 0.5 && CART) { go(n, [CART.clone().add(V((rnd() - 0.5) * 1.5, rnd())), plazaPt()]); n.then = { act: 'icecream', dur: 12 + rnd() * 10, cone: true }; n.wait = 0; return; }
  if (r < 0.62) { const k = KITE_SPOTS.filter((x) => !x.kite)[0]; if (k) { k.kite = n; go(n, [k.pos.clone()]); n.then = { act: 'npckite', spot: k, dur: 18 + rnd() * 14 }; n.wait = 0; return; } }
  if (rnd() < 0.55) go(n, [plazaPt(), mark(lobby.clone(), 'pickup'), n.home]);
  else go(n, [plazaPt(), n.home]);
  n.wait = 4 + rnd() * 8;
}
// 푸드코트: 노점에서 주문 → 음식 받아 들고 → 빈 의자에 앉아 먹기
function foodPlan(n) {
  const free = FOOD_SEATS.filter((x) => !x.taken); if (!free.length || !STALLS.length) return false;
  const seat = free[Math.floor(rnd() * free.length)], st = STALLS[Math.floor(rnd() * STALLS.length)];
  seat.taken = n; go(n, [mark(st.order.clone().add(V((rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.6)), 'order'), seat.pos.clone().setY(0)]);
  n.stall = st; n.then = { act: 'eat', seat, food: st.food, dur: 16 + rnd() * 14 }; n.wait = 0; return true;
}
function holdIt(n, obj) { obj.position.set(0, -0.78, 0.16); n.g.userData.armR.add(obj); n.hand = obj; n.g.userData.hand = obj; }
function dropIt(n) { if (n.hand) { n.hand.removeFromParent(); n.hand = null; n.g.userData.hand = null; } }
function startDoing(n) {
  const d = { ...n.then, t: 0 }; n.then = null; n.doing = d;
  if (d.cone) { const cone = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 8), M(0xd9a35a)); c.rotation.x = Math.PI; cone.add(c); ball(cone, 0.13, [0xffd1dc, 0xfff1b8, 0xbfe8d0][Math.floor(rnd() * 3)], 0, 0.2, 0); holdIt(n, cone); }
  if (d.act === 'npckite') {
    d.obj = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 4), M([0x2f7a96, 0xf2c94c, 0x9a5a7a][Math.floor(rnd() * 3)], { side: THREE.DoubleSide })); d.obj.scale.z = 0.1;
    d.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff })); scene.add(d.obj, d.line);
    n.g.rotation.y = L.kiteFace;   // 바람 부는 쪽(바다 · 골짜기)으로 날려요
  }
}
function stepPerson(p, target, speed, dt) {
  const d = target.clone().sub(p.position).setY(0), len = d.length();
  if (len < 0.15) return true;
  p.position.addScaledVector(d.normalize(), Math.min(len, speed * dt));
  const want = Math.atan2(d.x, d.z), diff = Math.atan2(Math.sin(want - p.rotation.y), Math.cos(want - p.rotation.y)); p.rotation.y += diff * Math.min(1, dt * 8);
  return false;
}

// ───────── 사장님 동작: 손 흔들기 · 연날리기 · 자전거 · 산책(자동) ─────────
let kite = null, bike = null, loop = null;
function setAct(a) {
  const was = me.act; me.act = was === a ? null : a; me.t = 0; me.target = null; loop = null;
  if (kite) { scene.remove(kite.obj, kite.line); kite = null; }
  if (bike) { me.g.remove(bike); bike = null; }
  if (me.act === 'kite') {
    const obj = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 4), M(0xe2603d, { side: THREE.DoubleSide })); obj.scale.z = 0.1;
    const tail = box(obj, 0.08, 2.4, 0.05, 0xf2c94c, 0, -2, 0); tail.castShadow = false;
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff }));
    scene.add(obj, line); kite = { obj, line, h: 3 }; loop = { pts: L.loops.kite, i: 0, speed: 3.6 };
    toast(L.msg.kite);
  }
  if (me.act === 'bike') {
    bike = new THREE.Group(); for (const z of [-0.65, 0.65]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 18), M(0x222222)); w.rotation.y = Math.PI / 2; w.position.set(0, 0.42, z); bike.add(w); }
    box(bike, 0.08, 0.08, 1.4, 0x2f7a96, 0, 0.75, 0); box(bike, 0.3, 0.08, 0.4, 0x222222, 0, 1.0, -0.35); box(bike, 0.7, 0.06, 0.06, 0x222222, 0, 1.15, 0.6); box(bike, 0.45, 0.3, 0.35, 0xc9a86a, 0, 1.0, 0.85);
    me.g.add(bike); loop = { pts: L.loops.bike, i: 0, speed: 6 }; toast(L.msg.bike);
  }
  if (me.act === 'walk') { loop = { pts: L.loops.walk, i: 0, speed: 2.2 }; toast(L.msg.walk); }
  if (me.act === 'wave') { setTimeout(() => { if (me.act === 'wave') setAct('wave'); }, 2600); const near = npcs.filter((n) => n.g.position.distanceTo(me.g.position) < 6); if (near.length) { near.forEach((n) => { n.wave = 2.2; n.g.lookAt(me.g.position.x, n.g.position.y, me.g.position.z); say(n, hello(n), 2.6); n.queue = lineFor(n); n.metT = 45; }); toast('직원들이 손을 흔들어 인사해요'); } else toast('손을 흔들었어요'); }
  if (loop) { let best = 0, bd = 1e9; loop.pts.forEach((p, i) => { const d = p.distanceTo(me.g.position.clone().setY(0)); if (d < bd) { bd = d; best = i; } }); loop.i = best; }
  document.querySelectorAll('[data-act]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.act === me.act)));
}

// ───────── 입력: 누르면 걸어가기 · 건물 누르면 안내 · 방향키 ─────────
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) { down = null; return; }
  down = null;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables, true).find((h) => h.object.userData.spot && !h.object.isSprite || h.object.isSprite);
  const spot = hit?.object.userData.spot || (hit?.object.isSprite && hit.object.parent?.children.find((c) => c.userData.spot)?.userData.spot);
  if (spot) { openCard(spot); walkTo(door(spot)); return; }
  const gh = L.groundMesh && ray.intersectObject(L.groundMesh, false)[0];   // 언덕(교토)은 땅 모양을 맞혀요
  if (gh) { walkTo(gh.point.clone()); return; }
  const p = new THREE.Vector3(); if (ray.ray.intersectPlane(groundPlane, p)) walkTo(p);
});
function walkTo(p) { if (me.act && me.act !== 'wave') setAct(me.act); me.target = p.setY(0); }
const keys = new Set();
addEventListener('keydown', (e) => { if (e.target.closest('input,textarea')) return; keys.add(e.code); });
addEventListener('keyup', (e) => keys.delete(e.code));


function openCard(s) {
  $('#cardT').textContent = NAME(s.key);
  $('#cardD').textContent = DESC[s.key] || ROOMS[s.key]?.desc || '';
  $('#cardW').textContent = s.key === 'boss' ? '비서가 아침마다 브리핑을 들고 와요' : s.lot ? '' : `직원: ${JOB(s.key)}`;
  const go = $('#cardGo'); go.hidden = !!s.lot; go.href = '../#' + (s.key === 'boss' ? 'boss' : s.key);
  $('#card').hidden = false;
}
$('#cardX').onclick = () => ($('#card').hidden = true);
let toastT = 0;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2200); }

// 아래 줄: 건물로 바로 가기
$('#places').innerHTML = [...ORDER.map(([k]) => k), 'boss'].map((k) => `<button class="b" data-go="${k}">${NAME(k)}</button>`).join('');
$('#places').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (!b) return; const s = SPOTS.find((x) => x.key === b.dataset.go); walkTo(door(s)); openCard(s); });
document.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => setAct(b.dataset.act)));
$('#timeBtn').onclick = () => { timeMode = TIMES[(TIMES.indexOf(timeMode) + 1) % TIMES.length]; applySky(); toast(timeMode === 'now' ? '지금 시각에 맞춰요' : `${TIME_NAME[timeMode]} 하늘로 바꿨어요`); };
setInterval(() => { if (timeMode === 'now') applySky(); }, 60000);   // 지금 시각이면 1분마다 하늘을 맞춰요

// ───────── 동네 바꾸기 ─────────
let theme = ['andaz', 'maldives', 'kyoto'].includes(new URLSearchParams(location.search).get('theme')) ? new URLSearchParams(location.search).get('theme') : store.get('theme', 'andaz');
if (!THEMES[theme]) theme = 'andaz';
function setTheme(id) {
  theme = id; store.set('theme', id); if (me?.act) setAct(me.act);
  L = LAYOUTS[id](); SPOTS = L.spots; LOBBY = SPOTS.find((s) => s.key === 'lobby');
  buildWorld(id); spawnPeople();
  document.querySelectorAll('[data-theme]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === id)));
  $('#title').textContent = `AI 연구소 마을 · ${THEMES[id].name}`;
  $('#card').hidden = true;
}
document.querySelectorAll('[data-theme]').forEach((b) => (b.onclick = () => setTheme(b.dataset.theme)));
await document.fonts.load('50px "Ownglyph_UNZ-Rg"').catch(() => {});   // 이름표 글씨가 언즈체로 그려지게
setTheme(theme);

// ───────── 매 프레임 ─────────
const clock = new THREE.Clock(), tmp = new THREE.Vector3();
function tick() {
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  const g = me.g, before = g.position.clone();
  // 방향키
  let dx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  let dz = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  let moving = false;
  if (dx || dz) {
    if (me.act && me.act !== 'wave') setAct(me.act); me.target = null;
    const yaw = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
    tmp.set(dx * Math.cos(yaw) + dz * Math.sin(yaw), 0, -dx * Math.sin(yaw) + dz * Math.cos(yaw)).normalize();
    g.position.addScaledVector(tmp, 5 * dt); g.rotation.y = Math.atan2(tmp.x, tmp.z); moving = true;
  } else if (me.target) { moving = !stepPerson(g, me.target, 5, dt); if (!moving) me.target = null; }
  else if (loop) { const p = loop.pts[loop.i]; if (stepPerson(g, p, loop.speed, dt)) loop.i = (loop.i + 1) % loop.pts.length; moving = true; }
  g.position.y = gy(g.position.x, g.position.z);   // 언덕 · 부두 높이를 따라가요
  animate(g, dt, moving && me.act !== 'bike', me.act === 'bike' ? 'bike' : me.act);
  if (kite) {
    kite.h += ((moving ? 11 : 6) - kite.h) * dt * 0.5;
    const back = new THREE.Vector3(-Math.sin(g.rotation.y), 0, -Math.cos(g.rotation.y));
    kite.obj.position.copy(g.position).addScaledVector(back, 6 + kite.h * 0.5).add(new THREE.Vector3(Math.sin(t) * 1.5, 2 + kite.h, 0));
    kite.obj.rotation.set(0, g.rotation.y, Math.sin(t * 1.6) * 0.3);
    kite.line.geometry.setFromPoints([g.position.clone().add(new THREE.Vector3(0, 2.2, 0)), kite.obj.position]);
  }
  // 카메라는 사장님을 따라가요
  const delta = g.position.clone().sub(before); camera.position.add(delta); controls.target.add(delta);
  controls.target.lerp(g.position.clone().add(new THREE.Vector3(0, 1.4, 0)), Math.min(1, dt * 2));
  // 직원
  for (const n of npcs) {
    let mv = false;
    if (n.wave > 0) { n.wave -= dt; animate(n.g, dt, false, 'wave'); continue; }
    if (n.doing) {   // 광장에서 쉬는 중
      const d = n.doing; d.t += dt;
      if (d.seat) { n.g.position.copy(d.seat.pos); n.g.position.y += 0.2; n.g.rotation.y = d.seat.rot; }
      if (d.act === 'npckite' && d.obj) { const back = new THREE.Vector3(-Math.sin(n.g.rotation.y), 0, -Math.cos(n.g.rotation.y)), t = performance.now() / 1000; d.obj.position.copy(n.g.position).addScaledVector(back, 6).add(new THREE.Vector3(Math.sin(t * 0.8 + d.t) * 1.5, 7 + Math.sin(t * 1.3) * 0.6, 0)); d.obj.rotation.z = Math.sin(t * 1.7) * 0.3; d.line.geometry.setFromPoints([n.g.position.clone().add(new THREE.Vector3(0, 2.1, 0)), d.obj.position]); }
      animate(n.g, dt, false, d.act);
      if (d.t >= d.dur) {
        if (d.seat) d.seat.taken = null; if (d.spot) d.spot.kite = null;
        if (d.obj) scene.remove(d.obj, d.line); dropIt(n);
        n.doing = null; go(n, [n.home]); n.wait = 0;
      }
      continue;
    }
    if (n.wait > 0) { n.wait -= dt; if (n.wait <= 0 && !n.path.length) nextPlan(n); }
    else if (n.path.length) {
      if (stepPerson(n.g, n.path[0], n.speed, dt)) {
        const p = n.path.shift();
        if (p.mark === 'pickup') n.holding = true;
        if (p.mark === 'order' && n.stall) { const st = n.stall; n.stall = null; holdIt(n, dish(st.food)); n.wait = 1.6; say(n, `${st.food.name} 하나 주세요!`, 2.2); say(st.vendor, `${st.food.name} 나왔어요~`, 2.4); }
        if (!n.path.length) { n.holding = false; if (n.then) startDoing(n); else { nextPlan(n); n.wait = 3 + rnd() * 6; } }
      }
      mv = true;
    }
    else if (n.then) startDoing(n);
    else nextPlan(n);
    if (!n.doing) n.g.position.y = gy(n.g.position.x, n.g.position.z);
    animate(n.g, dt, mv, n.holding ? 'carry' : n.hand ? 'hold' : null);
    if (n.holding && !n.paper) { n.paper = box(n.g, 0.5, 0.08, 0.36, 0xf8f6ee, 0, 1.25, 0.45); }
    if (!n.holding && n.paper) { n.g.remove(n.paper); n.paper = null; }
  }
  for (const v of VENDORS) animate(v.g, dt, false, 'cook');
  chatter(dt);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.__village = { camera, controls, me: () => me, L: () => L };   // 화면 점검용
