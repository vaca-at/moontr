// AI 연구소 마을 — 방 하나 = 단층 건물 한 채. 직원은 블록 캐릭터 NPC, 나는 사장님.
// 동네 3곳: 파타야(해변 리조트) · 몰디브(수상 빌라) · 교토(옛 절집 거리). 건물 자리는 같고 모양만 바뀌어요.
// 직원 머리 위 말풍선: 지금 시각(아침 · 점심 · 저녁 …)과 자기 방 일에 맞는 인사. 푸드코트: 그 나라에서 꼭 먹어야 하는 음식 노점 4곳.
// 건물을 누르면 연구소의 그 방(../#방이름)으로 가요. 자료는 연구소 화면 그대로 써요.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ROOMS } from '../rooms.js';
import { drawPlate } from './plates.js';

const $ = (s) => document.querySelector(s);
const store = { get(k, d) { try { return localStorage.getItem('ailab-village:' + k) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('ailab-village:' + k, v); } catch {} } };
const rnd = (() => { let s = 7; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();

// ───────── 건물 자리 (모든 테마 같음): C자 말굽 모양 ─────────
// 건물 11채가 반지름 R 의 큰 C자(위쪽이 막히고 아래 물가 쪽이 열림)로 둘러서고, 가운데는 넓은 잔디 마당.
// 열린 쪽 오른편 물가에 사장님 집. 접수처가 C의 맨 위 가운데예요
const R = 26, ARC = 125;   // 반지름, 가운데에서 양쪽 끝까지 각도(도)
const ORDER = [['security', 4, 4], ['moral', 5, 4.5], ['others', 5, 4.5], ['links', 6, 5], ['train', 6, 5], ['lobby', 7, 5], ['archive', 5, 4], ['aiedu', 6, 5], ['task', 6, 5], ['plans', 6, 5], ['store2', 5, 4]];
const SPOTS = ORDER.map(([key, w, d], i) => {
  const a = (-ARC + (2 * ARC * i) / (ORDER.length - 1)) * Math.PI / 180;
  return { key, x: Math.round(Math.sin(a) * R * 10) / 10, z: Math.round(-Math.cos(a) * R * 10) / 10, w, d, lot: key === 'store2' };
});
SPOTS.push({ key: 'boss', x: 17, z: 23, w: 8, d: 6, boss: true });
const LOBBY = SPOTS.find((s) => s.key === 'lobby');
const NAME = (k) => (k === 'boss' ? '사장님 집' : k === 'store2' ? '빈 터' : ROOMS[k]?.name || k);
const JOB = (k) => ROOMS[k]?.role || '';
const DESC = {
  boss: '사장님 집이에요. 계기판 · 브리핑 · 일정은 연구소의 사장실에서 열려요.',
  store2: '아직 비어 있는 터예요. 새 방이 생기면 여기에 건물이 올라가요.',
};

// ───────── 테마 ─────────
const THEMES = {
  andaz: {
    name: '파타야', hello: '사와디캅~', sky: 0x9fd3ea, fog: 0xcfe9f2, sun: 0xfff3dc, hemiG: 0x8aa070,
    ground: 0x8fc46a, plaza: 0xeee8da, path: 0xeee8da, shore: 20, sand: 0xeadcb1, water: 0x3fb0cf, waterNear: 0x5fcbd8,
  },
  maldives: {
    name: '몰디브', hello: '아쌀라무 알라이쿰~', sky: 0x8fd0f0, fog: 0xd5f1f6, sun: 0xffffff, hemiG: 0x9ad6c8,
    ground: 0xbfe08a, plaza: 0xf6eed6, path: 0xf6eed6, island: 31, sand: 0xf7efd8, water: 0x2aa6c8, waterNear: 0x7fe0dc,
  },
  kyoto: {
    name: '교토', hello: '곤니치와~', sky: 0xb9d4e4, fog: 0xe6ece8, sun: 0xffeccc, hemiG: 0x6f8a5a,
    ground: 0x6f9a52, plaza: 0xd9d4c6, path: 0xcfc6b2, shore: 20, sand: 0x8f8a7c, water: 0x5f8f8a, waterNear: 0x6fa19a,
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
let world = null;
const pickables = [];
function clearWorld() { if (world) { scene.remove(world); world.traverse((o) => { o.geometry?.dispose(); }); } pickables.length = 0; }

function buildWorld(id) {
  clearWorld();
  const T = THEMES[id]; world = new THREE.Group(); scene.add(world);
  scene.background = new THREE.Color(T.sky); scene.fog = new THREE.Fog(T.fog, 110, 320);
  world.add(new THREE.HemisphereLight(0xffffff, T.hemiG, 1.1));
  const sun = new THREE.DirectionalLight(T.sun, 2.2); sun.position.set(30, 50, 20); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, far: 200 }); world.add(sun);

  // 바다 · 호수
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), M(T.water, { roughness: 0.25, metalness: 0.1 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.35; sea.receiveShadow = true; world.add(sea);
  // 땅
  const land = new THREE.Group(); world.add(land);
  if (id === 'maldives') {
    const near = new THREE.Mesh(new THREE.CircleGeometry(52, 64), M(T.waterNear, { roughness: 0.2 })); near.rotation.x = -Math.PI / 2; near.position.y = -0.3; world.add(near);
    const sand = new THREE.Mesh(new THREE.CylinderGeometry(T.island + 1.5, T.island + 3, 0.6, 64), M(T.sand)); sand.position.y = -0.33; sand.scale.z = 1.05; sand.receiveShadow = true; land.add(sand);
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(T.island - 2.5, T.island - 2.5, 0.62, 64), M(T.ground)); grass.position.y = -0.31; grass.receiveShadow = true; land.add(grass);
  } else {
    const g = new THREE.Mesh(new THREE.BoxGeometry(130, 0.6, 60 + T.shore), M(T.ground)); g.position.set(0, -0.3, (T.shore - 60) / 2); g.receiveShadow = true; land.add(g);
    const b = new THREE.Mesh(new THREE.BoxGeometry(130, 0.5, 6), M(T.sand)); b.position.set(0, -0.33, T.shore + 3); b.receiveShadow = true; land.add(b);
  }
  // 광장 · 길
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.08, 40), M(T.plaza)); plaza.position.y = 0.02; plaza.receiveShadow = true; world.add(plaza);
  for (const s of SPOTS) {
    const len = Math.hypot(s.x, s.z) - 7, a = Math.atan2(s.x, s.z);
    const p = new THREE.Mesh(new THREE.BoxGeometry(2, 0.06, len), M(T.path)); p.position.set(Math.sin(a) * (7 + len / 2), 0.03, Math.cos(a) * (7 + len / 2)); p.rotation.y = a; p.receiveShadow = true;
    if (!(id === 'maldives' && Math.hypot(s.x, s.z) > T.island)) world.add(p);
  }

  // 건물
  for (const s of SPOTS) {
    const g = new THREE.Group(); g.position.set(s.x, 0, s.z); g.rotation.y = Math.atan2(-s.x, -s.z); world.add(g);
    const over = id === 'maldives' && Math.hypot(s.x, s.z) > T.island - 1;   // 몰디브: 섬 밖이면 물 위 기둥 빌라
    if (s.lot) buildLot(g, s, id);
    else ({ andaz: buildAndaz, maldives: buildMaldives, kyoto: buildKyoto }[id])(g, s, over);
    if (over) jetty(s);
    // 문패: 문 앞 기둥에 방마다 다른 정사각형 문패
    { const tex = new THREE.CanvasTexture(drawPlate(s.key, 256)); tex.colorSpace = THREE.SRGBColorSpace;
      const post = new THREE.Group(); post.position.set(s.w / 2 - 0.4, (over ? 0.9 : 0), s.d / 2 + 1.3); g.add(post);
      box(post, 0.14, 1.5, 0.14, 0x6e4c30, 0, 0.75, 0);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })); pl.position.set(0, 2.15, 0.09); pl.castShadow = true; post.add(pl);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), M(0x6e4c30)); back.rotation.y = Math.PI; back.position.set(0, 2.15, 0.07); post.add(back); }
    const tag = label(NAME(s.key), s.boss); tag.position.set(0, (s.boss ? 7.4 : 6.2), 0); g.add(tag);
    g.traverse((o) => { if (o.isMesh) o.userData.spot = s; });
    pickables.push(g);
  }
  ({ andaz: decoAndaz, maldives: decoMaldives, kyoto: decoKyoto }[id])();
  buildPlaza(id);
  buildFoodCourt(id);

  function jetty(s) {
    const a = Math.atan2(s.x, s.z), r0 = T.island - 1, r1 = Math.hypot(s.x, s.z) - s.d / 2 - 0.5, len = r1 - r0;
    if (len <= 0) return;
    const j = new THREE.Group(); j.position.set(Math.sin(a) * (r0 + len / 2), 0, Math.cos(a) * (r0 + len / 2)); j.rotation.y = a; world.add(j);
    box(j, 1.8, 0.15, len, 0xc49a6a, 0, 0.25, 0);
    for (let i = -len / 2; i <= len / 2; i += 2) for (const sx of [-0.85, 0.85]) cyl(j, 0.08, 0.08, 1, 0x6e4c30, sx, -0.2, i);
  }
}

// 파타야(안다즈 느낌): 하얀 벽 · 티크 처마의 모던 빌라(평지붕), 접수처 · 교과실 · 사장님 집은 태국식 높은 지붕
function buildAndaz(g, s) {
  const thai = ['lobby', 'moral', 'others', 'boss'].includes(s.key);
  const h = s.boss ? 3.4 : 3;
  box(g, s.w + 1, 0.3, s.d + 1, 0xd9cfbd, 0, 0.15, 0);   // 돌 기단
  box(g, s.w, h, s.d, 0xf6f3ec, 0, 0.3 + h / 2, 0);
  for (let i = -s.w / 2 + 0.9; i < s.w / 2 - 0.5; i += 1.4) box(g, 0.9, h * 0.6, 0.06, 0x9fc9d6, i, 0.3 + h * 0.5, s.d / 2 + 0.01, { roughness: 0.1, metalness: 0.3 });
  box(g, 1.2, h * 0.75, 0.08, 0x7a4e2c, 0, 0.3 + h * 0.38, s.d / 2 + 0.03);   // 티크 문
  if (thai) { hipRoof(g, s.w, s.d, s.boss ? 3.4 : 2.8, 0x3a2a20, 0.3 + h, { eave: 0.9 }); box(g, s.w + 1.6, 0.25, 0.25, 0x8a5a34, 0, 0.3 + h, s.d / 2 + 0.75); }
  else { box(g, s.w + 1.6, 0.35, s.d + 1.6, 0xefeae0, 0, 0.3 + h + 0.17, 0); box(g, s.w + 1.6, 0.3, 0.1, 0x8a5a34, 0, 0.3 + h + 0.05, s.d / 2 + 0.8); }
  if (s.boss) { const pool = box(g, s.w + 1, 0.12, 2.4, 0x43c9dc, 0, 0.08, s.d / 2 + 2.2, { roughness: 0.1 }); pool.receiveShadow = true; box(g, s.w + 1.6, 0.1, 3, 0xe6dfcf, 0, 0.02, s.d / 2 + 2.2); }
  if (s.key === 'security') { box(g, 0.4, 0.4, 0.4, 0xff4b3a, 0, 0.3 + h + 0.6, 0, { emissive: 0xff2a1a, emissiveIntensity: 0.6 }); }
}
// 몰디브: 연한 나무 벽 · 이엉 모임지붕. 섬 밖은 기둥 위 수상 빌라 + 넓은 데크
function buildMaldives(g, s, over) {
  const h = 2.6, base = over ? 0.9 : 0.2;
  if (over) { for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [1, 0]]) cyl(g, 0.14, 0.14, 1.6, 0x6e4c30, x * (s.w / 2 + 0.6), base - 0.8, z * (s.d / 2 + 0.6)); }
  box(g, s.w + 2.2, 0.2, s.d + 2.2, 0xc49a6a, 0, base, 0);   // 데크
  box(g, s.w, h, s.d, 0xf1e4c8, 0, base + h / 2 + 0.1, 0);
  for (let i = -s.w / 2 + 0.9; i < s.w / 2 - 0.5; i += 1.4) box(g, 0.9, h * 0.65, 0.06, 0xbfe6ef, i, base + h * 0.55, s.d / 2 + 0.01, { roughness: 0.1 });
  box(g, 1.2, h * 0.8, 0.08, 0x8a6a46, 0, base + h * 0.45, s.d / 2 + 0.03);
  hipRoof(g, s.w, s.d, s.boss ? 4 : 3.2, 0xc9a46a, base + h + 0.1, { eave: 1 });
  if (s.boss || over) { const p = box(g, s.boss ? 3.4 : 1.8, 0.1, 1.4, 0x4fd3e4, s.w / 2 - (s.boss ? 1.8 : 1), base + 0.12, s.d / 2 + 0.9, { roughness: 0.1 }); p.castShadow = false; }
  if (over) { for (let i = 0; i < 3; i++) box(g, 0.5, 0.15, 1, 0xf4f1ea, -s.w / 2 + 0.6 + i * 0.8, base + 0.2, s.d / 2 + 0.8); }
}
// 교토: 흰 회벽 · 나무 기둥 · 짙은 기와 모임지붕(처마가 넓게). 사장님 집은 연못가 금각
function buildKyoto(g, s) {
  const h = 2.8;
  box(g, s.w + 1, 0.4, s.d + 1, 0x9a9488, 0, 0.2, 0);   // 돌 기단
  if (s.boss) {   // 금각사처럼 금빛 2층 누각
    const gold = M(0xd4a12e, { metalness: 0.7, roughness: 0.35 });
    box(g, s.w, h, s.d, gold, 0, 0.4 + h / 2, 0);
    hipRoof(g, s.w, s.d, 0.9, 0x2e2a26, 0.4 + h, { eave: 1.1, flare: true });
    box(g, s.w * 0.7, h * 0.8, s.d * 0.7, gold, 0, 0.4 + h + 0.9 + h * 0.4, 0);
    hipRoof(g, s.w * 0.7, s.d * 0.7, 1.8, 0x2e2a26, 0.4 + h + 0.9 + h * 0.8, { eave: 0.9, flare: true });
    box(g, 0.5, 0.6, 0.5, gold, 0, 0.4 + h * 1.8 + 3, 0);
    return;
  }
  box(g, s.w, h, s.d, 0xf3efe6, 0, 0.4 + h / 2, 0);
  for (const x of [-s.w / 2, -s.w / 6, s.w / 6, s.w / 2]) box(g, 0.22, h, 0.22, 0x4a2f22, x, 0.4 + h / 2, s.d / 2 + 0.02);
  box(g, s.w + 0.1, 0.22, 0.24, 0x4a2f22, 0, 0.4 + h - 0.1, s.d / 2 + 0.02);
  for (let i = -s.w / 2 + 0.7; i < s.w / 2 - 0.4; i += 1.1) box(g, 0.7, h * 0.4, 0.05, 0xe8dfc8, i, 0.4 + h * 0.62, s.d / 2 + 0.04);   // 장지문
  box(g, 1.3, h * 0.72, 0.06, 0x5a3a26, 0, 0.4 + h * 0.36, s.d / 2 + 0.05);
  hipRoof(g, s.w, s.d, s.key === 'lobby' ? 3 : 2.4, 0x3a3836, 0.4 + h, { eave: 1.2, flare: true });
  if (s.key === 'security') { const l = new THREE.PointLight(0xffb35a, 3, 10); l.position.set(0, 2, s.d / 2 + 1); g.add(l); }
}
function buildLot(g, s, id) {
  const c = id === 'kyoto' ? 0x6e4c30 : 0xc9a06b;
  for (let i = -s.w / 2; i <= s.w / 2; i += 0.8) { box(g, 0.12, 0.8, 0.12, c, i, 0.4, -s.d / 2); box(g, 0.12, 0.8, 0.12, c, i, 0.4, s.d / 2); }
  for (let i = -s.d / 2; i <= s.d / 2; i += 0.8) { box(g, 0.12, 0.8, 0.12, c, -s.w / 2, 0.4, i); box(g, 0.12, 0.8, 0.12, c, s.w / 2, 0.4, i); }
  box(g, 1.6, 1, 0.1, 0xf2c94c, 0, 1.2, 0); cyl(g, 0.06, 0.06, 1.2, c, 0, 0.6, 0);
}

// 마을 가운데 광장: 둥근 벤치 6개(앉을 자리 12) · 아이스크림 수레 · 꽃밭 · 연 날리는 잔디밭
const SEATS = [], KITE_SPOTS = [];
let CART = null;
function buildPlaza(id) {
  SEATS.length = 0; KITE_SPOTS.length = 0;
  const wood = id === 'kyoto' ? 0x6e4c30 : 0xb98a5a, stone = id === 'kyoto' ? 0x9a9488 : 0xe8e2d4;
  // 광장 바닥을 넓게: 돌판 원 + 가운데 분수(교토는 돌 연못)
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 0.07, 48), M(stone)); floor.position.set(0, 0.035, 0); floor.receiveShadow = true; world.add(floor);
  const f = new THREE.Group(); world.add(f);
  cyl(f, 2.4, 2.6, 0.6, id === 'kyoto' ? 0x7a7468 : 0xd9d2c0, 0, 0.3, 0, 24);
  cyl(f, 2.1, 2.1, 0.62, id === 'kyoto' ? 0x4f7a72 : 0x5fcbe0, 0, 0.32, 0, 24);
  if (id !== 'kyoto') { cyl(f, 0.25, 0.35, 1.8, 0xd9d2c0, 0, 0.9, 0); cyl(f, 0.9, 0.5, 0.25, 0xd9d2c0, 0, 1.85, 0, 16); const w = cyl(f, 0.2, 0.6, 0.9, 0x9fe6f2, 0, 2.4, 0, 12); w.material.transparent = true; w.material.opacity = 0.6; }
  else { for (const [x, z, k] of [[-0.6, 0.3, 0.6], [0.7, -0.4, 0.45]]) box(f, k, k * 0.8, k, 0x6e6a62, x, 0.6 + k * 0.4, z, { flatShading: true }); }
  // 벤치: 분수 둘레 6개, 벤치마다 두 자리
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6, r = 5.2, x = Math.sin(a) * r, z = Math.cos(a) * r;
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = a + Math.PI; world.add(b);
    box(b, 2.4, 0.12, 0.7, wood, 0, 0.55, 0); box(b, 2.4, 0.6, 0.1, wood, 0, 0.9, -0.33);
    for (const sx of [-1, 1]) box(b, 0.12, 0.55, 0.6, 0x3a3a3a, sx * 1.05, 0.27, 0);
    for (const sx of [-0.55, 0.55]) { const p = new THREE.Vector3(sx, 0, 0.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), a + Math.PI).add(new THREE.Vector3(x, 0, z)); SEATS.push({ pos: p, rot: a, taken: null }); }
  }
  // 꽃밭 넷
  const fc = id === 'kyoto' ? [0xc0392b, 0xe67e22] : id === 'maldives' ? [0xff8fb1, 0xffd166] : [0xe8789a, 0xf2c94c];
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4, r = 9.4; const g = new THREE.Group(); g.position.set(Math.sin(a) * r, 0, Math.cos(a) * r); world.add(g); box(g, 2.6, 0.3, 1.4, 0x8a6a46, 0, 0.15, 0); for (let j = 0; j < 8; j++) box(g, 0.35, 0.35, 0.35, fc[j % 2], -1 + (j % 4) * 0.66, 0.45, j < 4 ? -0.3 : 0.3, { flatShading: true }); }
  // 아이스크림 수레 (줄무늬 차양)
  const c = new THREE.Group(); c.position.set(-7.5, 0, 6.5); c.rotation.y = 0.7; world.add(c);
  box(c, 2, 1.1, 1.1, 0xf4f1ea, 0, 0.75, 0); box(c, 2.05, 0.2, 1.15, 0xff8fb1, 0, 1.0, 0);
  for (const x of [-0.7, 0.7]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 6, 14), M(0x333333)); w.position.set(x, 0.28, 0.6); c.add(w); }
  for (const x of [-0.95, 0.95]) box(c, 0.07, 1.2, 0.07, 0xb0b0b0, x, 1.9, 0);
  for (let i = 0; i < 6; i++) box(c, 0.36, 0.08, 1.4, i % 2 ? 0xffffff : 0xff6b8a, -0.9 + i * 0.36, 2.5, 0);
  for (const [x, col] of [[-0.5, 0xffd1dc], [0, 0xfff1b8], [0.5, 0xbfe8d0]]) { cyl(c, 0.14, 0.14, 0.18, col, x, 1.4, 0, 10); }
  const cl = label('아이스크림'); cl.scale.multiplyScalar(0.55); cl.position.y = 3.3; c.add(cl);
  CART = c.position.clone().add(new THREE.Vector3(0.9, 0, 1.6));
  // 연 날리는 잔디밭: 마당 물가 쪽 빈 곳
  for (const [x, z] of [[-12, 12], [-4, 14], [5, 13], [11, 10]]) KITE_SPOTS.push({ pos: new THREE.Vector3(x, 0, z), kite: null });
}

// 소품
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
// 자리: C 안쪽, 타교과실과 링크 서재 사이 (길 두 갈래가 푸드코트 바닥을 지나가요)
const FC = (() => { const a = -62.5 * Math.PI / 180, r = 18; return { x: Math.sin(a) * r, z: -Math.cos(a) * r, ry: Math.atan2(Math.sin(a) * r * -1, Math.cos(a) * r) }; })();
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
  const T = THEMES[id], foods = FOODS[id];
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.07, 40), M(id === 'kyoto' ? 0xa8a294 : T.plaza)); floor.position.set(FC.x, 0.04, FC.z); floor.receiveShadow = true; world.add(floor);
  const sign = label('푸드코트'); sign.scale.multiplyScalar(0.8); sign.position.copy(FCW(0, -1.5)).setY(5.4); world.add(sign);
  // 노점: 뒤쪽 2곳(가운데를 보고), 양옆 2곳(안쪽을 보고)
  [[-1.7, -3.6, 0], [1.7, -3.6, 0], [-6.2, -1, Math.PI / 2], [6.2, -1, -Math.PI / 2]].forEach(([x, z, r], i) => {
    const f = foods[i], s = new THREE.Group(); s.position.copy(FCW(x, z)); s.rotation.y = FC.ry + r; world.add(s);
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
    const p = FCW(tx, tz);
    cyl(world, 0.85, 0.85, 0.08, top, p.x, 0.85, p.z, 16); cyl(world, 0.1, 0.1, 0.85, 0x555555, p.x, 0.42, p.z, 6);
    cyl(world, 0.05, 0.05, 2.2, 0xdddddd, p.x, 1.95, p.z, 6);
    const u = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.6, 8), M(para[i % para.length], { side: THREE.DoubleSide })); u.position.set(p.x, 3.1, p.z); u.castShadow = true; world.add(u);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4, sx = p.x + Math.sin(a) * 1.15, sz = p.z + Math.cos(a) * 1.15;
      cyl(world, 0.25, 0.22, 0.5, id === 'kyoto' ? 0x3a2a1a : 0xb98a5a, sx, 0.25, sz, 8);
      FOOD_SEATS.push({ pos: new THREE.Vector3(sx, 0, sz), rot: Math.atan2(p.x - sx, p.z - sz), taken: null });
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
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g); const lean = (rnd() - 0.5) * 0.5;
  for (let i = 0; i < 7; i++) box(g, 0.32, 0.8, 0.32, 0x8a6a46, lean * i * 0.4, 0.4 + i * 0.75 * k, 0);
  const top = new THREE.Group(); top.position.set(lean * 2.8, 5.6 * k, 0); g.add(top);
  for (let i = 0; i < 6; i++) { const f = box(top, 3.2 * k, 0.12, 0.7, i % 2 ? 0x3f8f4a : 0x4f9f52, 1.4 * k, 0, 0); f.geometry.translate(0, 0, 0); const p = new THREE.Group(); p.add(f); p.rotation.y = (i / 6) * Math.PI * 2; p.rotation.z = -0.35; top.add(p); }
  return g;
}
function tree(x, z, c, k = 1) { const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g); box(g, 0.4 * k, 1.6 * k, 0.4 * k, 0x6e4a2c, 0, 0.8 * k, 0); box(g, 2.4 * k, 1.8 * k, 2.4 * k, c, 0, 2.4 * k, 0, { flatShading: true }); box(g, 1.6 * k, 1.2 * k, 1.6 * k, c, 0, 3.6 * k, 0); return g; }
const freeAt = (x, z, pad = 2.5) => Math.hypot(x, z) > 8 && Math.hypot(x - FC.x, z - FC.z) > 8.5 && !SPOTS.some((s) => Math.abs(x - s.x) < s.w / 2 + pad && Math.abs(z - s.z) < s.d / 2 + pad);

function decoAndaz() {
  const T = THEMES.andaz;
  // 해변과 나란한 인피니티 풀 (광장 남쪽), 선베드 · 파라솔 · 야자수
  const pool = box(world, 30, 0.15, 3, 0x43c9dc, -4, 0.05, 16, { roughness: 0.08 }); pool.castShadow = false; box(world, 31, 0.06, 4.4, 0xe6dfcf, -4, 0.01, 16);
  for (let x = -46; x <= 46; x += 4.5) palm(x + rnd(), T.shore + 1.5 + rnd() * 2, 0.9 + rnd() * 0.3);
  for (let x = -36; x <= 36; x += 3) { if (Math.abs(x - 17) < 6) continue; box(world, 0.9, 0.25, 2, 0xf4f1ea, x, 0.15, T.shore + 3.6); }
  for (const x of [-30, -12, 4, 32]) { cyl(world, 0.06, 0.06, 2.6, 0xb98a5a, x, 1.3, T.shore + 4.6); hipRoof(world, 2.4, 2.4, 0.6, 0xf4f1ea, 2.6, { eave: 0 }).position.set(x, 2.6, T.shore + 4.6); }
  // 정원 가운데 태국식 정자(살라)
  const sala = new THREE.Group(); sala.position.set(-15, 0, 10);   // 광장 옆 (가운데 두면 처음 보는 화면을 가려요) world.add(sala);
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) cyl(sala, 0.15, 0.15, 3, 0x7a5232, x, 1.5, z);
  box(sala, 5, 0.25, 5, 0xc49a6a, 0, 0.12, 0); hipRoof(sala, 4.4, 4.4, 2.6, 0x3a2a20, 3, { eave: 0.7 });
  for (let i = 0; i < 70; i++) { const x = (rnd() - 0.5) * 110, z = -50 + rnd() * 66; if (Math.hypot(x, z) < R - 5 && z > -R + 6) continue; if (freeAt(x, z)) (rnd() < 0.5 ? palm(x, z, 0.8 + rnd() * 0.3) : tree(x, z, 0x3f8a44, 0.9)); }
  for (let i = 0; i < 24; i++) { const x = (rnd() - 0.5) * 60, z = -30 + rnd() * 44; if (freeAt(x, z, 1.5)) box(world, 1.2, 0.8, 1.2, 0xe8789a, x, 0.4, z, { flatShading: true }); }
}
function decoMaldives() {
  const T = THEMES.maldives;
  for (let i = 0; i < 60; i++) { const a = rnd() * Math.PI * 2, r = (rnd() < 0.15 ? 10 + rnd() * 8 : R + 4 + rnd() * (T.island - R - 5)), x = Math.sin(a) * r, z = Math.cos(a) * r; if (freeAt(x, z, 1.8)) palm(x, z, 0.85 + rnd() * 0.35); }
  for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2, r = T.island + 0.3; const x = Math.sin(a) * r, z = Math.cos(a) * r; if (freeAt(x, z, 2)) palm(x, z, 0.9); }
  for (let i = 0; i < 8; i++) { const a = Math.PI * 0.2 + i * 0.28, r = T.island - 0.5; box(world, 0.9, 0.25, 2, 0xf4f1ea, Math.sin(a) * r, 0.25, Math.cos(a) * r).rotation.y = a; }
  // 광장 가운데 모래 둥근 정자
  const g = new THREE.Group(); g.position.set(-15, 0, 10); world.add(g); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; cyl(g, 0.15, 0.15, 3, 0x8a6a46, Math.sin(a) * 2.4, 1.5, Math.cos(a) * 2.4); }
  hipRoof(g, 5, 5, 2.4, 0xc9a46a, 3, { eave: 0.6 });
}
function decoKyoto() {
  const T = THEMES.kyoto;
  // 접수처에서 광장까지 붉은 도리이 줄 (후시미 이나리)
  for (let z = -LOBBY.z * 0 + LOBBY.z + 4.5; z <= -8.5; z += 2.2) { const g = new THREE.Group(); g.position.set(0, 0, z); world.add(g); const red = 0xd8402a; box(g, 0.3, 3.4, 0.3, red, -1.4, 1.7, 0); box(g, 0.3, 3.4, 0.3, red, 1.4, 1.7, 0); box(g, 3.8, 0.3, 0.4, 0x2a2a2a, 0, 3.55, 0); box(g, 3.2, 0.22, 0.3, red, 0, 3.05, 0); }
  // 오층탑 (야사카)
  const pg = new THREE.Group(); pg.position.set(-36, 0, -22); world.add(pg); box(pg, 4, 0.6, 4, 0x9a9488, 0, 0.3, 0);
  for (let i = 0; i < 5; i++) { const k = 1 - i * 0.12, y = 0.6 + i * 2.4; box(pg, 2.6 * k, 1.8, 2.6 * k, 0x7a2e24, 0, y + 0.9, 0); hipRoof(pg, 2.6 * k, 2.6 * k, 0.5, 0x2e2a26, y + 1.8, { eave: 1, flare: true }); }
  cyl(pg, 0.08, 0.08, 3, 0xb08a3a, 0, 13.6, 0);
  // 대숲 (아라시야마)
  for (let i = 0; i < 140; i++) { const x = -52 + rnd() * 16, z = -40 + rnd() * 44; if (!freeAt(x, z, 1.5)) continue; const h = 6 + rnd() * 4; box(world, 0.25, h, 0.25, 0x6f9a42, x, h / 2, z); box(world, 1.2, 0.6, 0.4, 0x7fb04a, x + 0.4, h - 0.4, z); }
  // 단풍 · 석등
  for (let i = 0; i < 60; i++) { const x = (rnd() - 0.5) * 100, z = -48 + rnd() * 64; if (Math.hypot(x, z) < R - 5 && z > -R + 6) continue; if (freeAt(x, z) && x > -34) tree(x, z, [0xc0392b, 0xd35400, 0xe67e22, 0x5a8a3a][i % 4], 0.8 + rnd() * 0.3); }
  for (const [x, z] of [[-3, -4.5], [3, -4.5], [-5, 5], [5, 5]]) { box(world, 0.5, 1, 0.5, 0xa8a294, x, 0.5, z); box(world, 0.9, 0.6, 0.9, 0xb8b2a4, x, 1.3, z); box(world, 1.1, 0.25, 1.1, 0x8a8478, x, 1.75, z); }
  // 광장: 흰 자갈 + 가레산스이 바위
  for (const [x, z, k] of [[-2, 1, 1], [2.2, -1, 0.7], [0.5, 2.6, 0.5]]) box(world, 1.4 * k, 0.9 * k, 1.1 * k, 0x6e6a62, x, 0.4 * k, z, { flatShading: true });
  // 연못가 소나무
  for (const x of [-30, -12, 6, 28]) tree(x, T.shore + 0.5, 0x2f5a3c, 1);
}

// ───────── 사람들 ─────────
const STAFF_KEYS = SPOTS.filter((s) => !s.lot && s.key !== 'boss').map((s) => s.key);
const SHIRTS = [0x3f6b55, 0x2f7a96, 0xc9822a, 0x6b5a9a, 0xa33b2a, 0x5a7a3a, 0x2f5d8a, 0x9a5a7a, 0x4a6a6a, 0x8a6a3a];
const door = (s) => { const a = Math.atan2(s.x, s.z), r = Math.hypot(s.x, s.z) - s.d / 2 - 1.6; return new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r); };
const npcs = [];
let me = null;
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
  const bossDoor = door(SPOTS.find((s) => s.key === 'boss')); sec.position.copy(bossDoor).add(new THREE.Vector3(2, 0, 0));
  npcs.push({ g: sec, key: 'secretary', home: sec.position.clone(), path: [], wait: 3, act: null, speed: 1.3 });
  for (let i = 0; i < 3; i++) { const f = person({ shirt: [0xe2603d, 0xf2c94c, 0x7fb3d5][i], hair: 0x4a3020, long: i === 1 }); const a = i * 2.1; f.position.set(Math.sin(a) * 5, 0, Math.cos(a) * 5); scene.add(f); npcs.push({ g: f, key: 'friend', home: f.position.clone(), path: [], wait: rnd() * 4, act: null, speed: 0.9 }); }
  // 사장님
  const g = person({ shirt: 0xf2c94c, pants: 0x3a4a6a, hair: 0x3a2418, long: true });
  const tag = label('사장님', true); tag.scale.multiplyScalar(0.6); tag.position.y = 2.85; g.add(tag);
  g.position.set(0, 0, 10); g.rotation.y = Math.PI; scene.add(g);   // C 가운데 마당에서 시작
  me = { g, target: null, act: null, t: 0 };
  controls.target.copy(g.position).add(new THREE.Vector3(0, 1.4, 0));
  camera.position.copy(g.position).add(new THREE.Vector3(-4, 22, 30));   // 물가 쪽 위에서: C자로 둘러선 마을 전체가 한눈에
}
// 직원 하루: 문 앞 → 광장 → 접수처(서류 받기) → 광장 → 문 앞. 비서는 사장님 집 ↔ 접수처, 친구는 광장 둘레
function nextPlan(n) {
  const lobby = door(LOBBY), plazaPt = () => new THREE.Vector3((rnd() - 0.5) * 12, 0, (rnd() - 0.5) * 12);
  if (n.key === 'friend') { if (rnd() < (slot() === 'lunch' ? 0.6 : 0.25) && foodPlan(n)) return; const a = rnd() * Math.PI * 2, r = 5 + rnd() * 8; n.path = [new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r)]; n.wait = 2 + rnd() * 5; return; }
  if (n.key === 'secretary') { n.path = [new THREE.Vector3(0, 0, 4), lobby, new THREE.Vector3(0, 0, 4), n.home]; n.carry = 1; n.wait = 6 + rnd() * 6; return; }
  // 광장에서 쉬는 일 (앉기 · 아이스크림 · 연날리기) 아니면 서류 배달
  const r = rnd();
  if ((slot() === 'lunch' ? r < 0.7 : r > 0.62 && r < 0.78) && foodPlan(n)) return;   // 점심때는 푸드코트가 북적여요
  if (r < 0.3) { const seat = SEATS.filter((x) => !x.taken)[Math.floor(rnd() * 12)] || SEATS.find((x) => !x.taken); if (seat) { seat.taken = n; n.path = [seat.pos.clone()]; n.then = { act: 'sit', seat, dur: 14 + rnd() * 16 }; n.carry = 0; n.wait = 0; return; } }
  if (r < 0.5 && CART) { n.path = [CART.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.5, 0, rnd())), plazaPt()]; n.then = { act: 'icecream', dur: 12 + rnd() * 10, cone: true }; n.carry = 0; n.wait = 0; return; }
  if (r < 0.62) { const k = KITE_SPOTS.filter((x) => !x.kite)[0]; if (k) { k.kite = n; n.path = [k.pos.clone()]; n.then = { act: 'npckite', spot: k, dur: 18 + rnd() * 14 }; n.carry = 0; n.wait = 0; return; } }
  if (rnd() < 0.55) { n.path = [plazaPt(), lobby, plazaPt(), n.home]; n.carry = 2; }
  else { n.path = [plazaPt(), n.home]; n.carry = 0; }
  n.wait = 4 + rnd() * 8;
}
// 푸드코트: 노점에서 주문 → 음식 받아 들고 → 빈 의자에 앉아 먹기
function foodPlan(n) {
  const free = FOOD_SEATS.filter((x) => !x.taken); if (!free.length || !STALLS.length) return false;
  const seat = free[Math.floor(rnd() * free.length)], st = STALLS[Math.floor(rnd() * STALLS.length)];
  seat.taken = n; n.path = [st.order.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.6, 0, (rnd() - 0.5) * 0.6)), seat.pos.clone()];
  n.stall = st; n.then = { act: 'eat', seat, food: st.food, dur: 16 + rnd() * 14 }; n.carry = 0; n.wait = 0; return true;
}
function holdIt(n, obj) { obj.position.set(0, -0.78, 0.16); n.g.userData.armR.add(obj); n.hand = obj; n.g.userData.hand = obj; }
function dropIt(n) { if (n.hand) { n.hand.removeFromParent(); n.hand = null; n.g.userData.hand = null; } }
function startDoing(n) {
  const d = { ...n.then, t: 0 }; n.then = null; n.doing = d;
  if (d.cone) { const cone = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 8), M(0xd9a35a)); c.rotation.x = Math.PI; cone.add(c); ball(cone, 0.13, [0xffd1dc, 0xfff1b8, 0xbfe8d0][Math.floor(rnd() * 3)], 0, 0.2, 0); holdIt(n, cone); }
  if (d.act === 'npckite') {
    d.obj = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 4), M([0x2f7a96, 0xf2c94c, 0x9a5a7a][Math.floor(rnd() * 3)], { side: THREE.DoubleSide })); d.obj.scale.z = 0.1;
    d.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff })); scene.add(d.obj, d.line);
    n.g.rotation.y = 0;   // 물 쪽을 바라보고 날려요
  }
}
function stepPerson(p, target, speed, dt) {
  const d = target.clone().sub(p.position).setY(0), L = d.length();
  if (L < 0.15) return true;
  p.position.addScaledVector(d.normalize(), Math.min(L, speed * dt));
  const want = Math.atan2(d.x, d.z), diff = Math.atan2(Math.sin(want - p.rotation.y), Math.cos(want - p.rotation.y)); p.rotation.y += diff * Math.min(1, dt * 8);
  return false;
}

// ───────── 사장님 동작: 손 흔들기 · 연날리기 · 자전거 · 산책(자동) ─────────
let kite = null, bike = null, loop = null;
function shoreLoop() {   // 물가를 따라 도는 길 (몰디브는 섬 둘레)
  const T = THEMES[theme], pts = [];
  if (theme === 'maldives') { for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; pts.push(new THREE.Vector3(Math.sin(a) * (T.island - 1.5), 0, Math.cos(a) * (T.island - 1.5))); } }
  else { for (let x = -36; x <= 36; x += 3) pts.push(new THREE.Vector3(x, 0, T.shore + 2.4)); for (let x = 36; x >= -36; x -= 3) pts.push(new THREE.Vector3(x, 0, T.shore + 0.8)); }
  return pts;
}
function plazaLoop() { return Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * Math.PI * 2; return new THREE.Vector3(Math.sin(a) * 15, 0, Math.cos(a) * 15 - 2); }); }
function setAct(a) {
  const was = me.act; me.act = was === a ? null : a; me.t = 0; me.target = null; loop = null;
  if (kite) { scene.remove(kite.obj, kite.line); kite = null; }
  if (bike) { me.g.remove(bike); bike = null; }
  if (me.act === 'kite') {
    const obj = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 4), M(0xe2603d, { side: THREE.DoubleSide })); obj.scale.z = 0.1;
    const tail = box(obj, 0.08, 2.4, 0.05, 0xf2c94c, 0, -2, 0); tail.castShadow = false;
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff }));
    scene.add(obj, line); kite = { obj, line, h: 3 }; loop = { pts: shoreLoop(), i: 0, speed: 3.6 };
    toast('물가를 달리며 연을 날려요');
  }
  if (me.act === 'bike') {
    bike = new THREE.Group(); for (const z of [-0.65, 0.65]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 18), M(0x222222)); w.rotation.y = Math.PI / 2; w.position.set(0, 0.42, z); bike.add(w); }
    box(bike, 0.08, 0.08, 1.4, 0x2f7a96, 0, 0.75, 0); box(bike, 0.3, 0.08, 0.4, 0x222222, 0, 1.0, -0.35); box(bike, 0.7, 0.06, 0.06, 0x222222, 0, 1.15, 0.6); box(bike, 0.45, 0.3, 0.35, 0xc9a86a, 0, 1.0, 0.85);
    me.g.add(bike); loop = { pts: shoreLoop(), i: 0, speed: 6 }; toast('물가 자전거길을 달려요');
  }
  if (me.act === 'walk') { loop = { pts: plazaLoop(), i: 0, speed: 2.2 }; toast('광장 둘레를 천천히 걸어요'); }
  if (me.act === 'wave') { setTimeout(() => { if (me.act === 'wave') setAct('wave'); }, 2600); const near = npcs.filter((n) => n.g.position.distanceTo(me.g.position) < 6); if (near.length) { near.forEach((n) => { n.wave = 2.2; n.g.lookAt(me.g.position.x, 0, me.g.position.z); say(n, hello(n), 2.6); n.queue = lineFor(n); n.metT = 45; }); toast('직원들이 손을 흔들어 인사해요'); } else toast('손을 흔들었어요'); }
  if (loop) { let best = 0, bd = 1e9; loop.pts.forEach((p, i) => { const d = p.distanceTo(me.g.position); if (d < bd) { bd = d; best = i; } }); loop.i = best; }
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
$('#places').innerHTML = SPOTS.map((s) => `<button class="b" data-go="${s.key}">${NAME(s.key)}</button>`).join('');
$('#places').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (!b) return; const s = SPOTS.find((x) => x.key === b.dataset.go); walkTo(door(s)); openCard(s); });
document.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => setAct(b.dataset.act)));

// ───────── 테마 바꾸기 ─────────
let theme = ['andaz', 'maldives', 'kyoto'].includes(new URLSearchParams(location.search).get('theme')) ? new URLSearchParams(location.search).get('theme') : store.get('theme', 'andaz');
if (!THEMES[theme]) theme = 'andaz';
function setTheme(id) {
  theme = id; store.set('theme', id); if (me?.act) setAct(me.act);
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
      if (d.seat) { n.g.position.copy(d.seat.pos).setY(0.2); n.g.rotation.y = d.seat.rot; }
      if (d.act === 'npckite' && d.obj) { const back = new THREE.Vector3(-Math.sin(n.g.rotation.y), 0, -Math.cos(n.g.rotation.y)), t = performance.now() / 1000; d.obj.position.copy(n.g.position).addScaledVector(back, 6).add(new THREE.Vector3(Math.sin(t * 0.8 + d.t) * 1.5, 7 + Math.sin(t * 1.3) * 0.6, 0)); d.obj.rotation.z = Math.sin(t * 1.7) * 0.3; d.line.geometry.setFromPoints([n.g.position.clone().add(new THREE.Vector3(0, 2.1, 0)), d.obj.position]); }
      animate(n.g, dt, false, d.act);
      if (d.t >= d.dur) {
        if (d.seat) d.seat.taken = null; if (d.spot) d.spot.kite = null;
        if (d.obj) scene.remove(d.obj, d.line); dropIt(n);
        n.g.position.y = 0; n.doing = null; n.path = [n.home]; n.wait = 0;
      }
      continue;
    }
    if (n.wait > 0) { n.wait -= dt; if (n.wait <= 0 && !n.path.length) nextPlan(n); }
    else if (n.path.length) { if (stepPerson(n.g, n.path[0], n.speed, dt)) { n.path.shift(); if (n.carry && n.path.length === n.carry) n.holding = true; if (n.stall && n.path.length === 1) { const st = n.stall; n.stall = null; holdIt(n, dish(st.food)); n.wait = 1.6; say(n, `${st.food.name} 하나 주세요!`, 2.2); say(st.vendor, `${st.food.name} 나왔어요~`, 2.4); } if (!n.path.length) { n.holding = false; if (n.then) { startDoing(n); } else { nextPlan(n); n.wait = 3 + rnd() * 6; } } } mv = true; }
    else if (n.then) startDoing(n);
    else nextPlan(n);
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
window.__village = { camera, controls, me: () => me, FC };   // 화면 점검용
