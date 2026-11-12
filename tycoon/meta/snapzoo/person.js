// 주인공 · 친구 사람 (2026-11-05 결정): 사람 시안 A(극장판 자연형) · B(꼬마 2.5등신) 를 섞어 체형 셋.
//  체형 1 = 키 큰(극장판) · 2 = 보통 · 3 = 꼬마(가장 작음, 처음 시작). 번호는 꾸미기 화면 순서예요. 성별 · 옷(LOOKS) · 모자(HATS) 는 꾸미기에서.
// 돌려주는 st 는 예전 walker 와 같아요: { root, walk, rate, waveT, aim, aimK, snapT, update(t, dt), look, g, hat, body }
import { THREE, LOOKS, J } from './zoo3d.js?v=20261108o';
const { sin, cos, PI, abs, max, min } = Math;

// 비율 (미터). 2 는 1 과 3 의 가운데
const P1 = { leg: 0.36, legR: 0.068, hipW: 0.08, foot: 0.13, torso: 0.3, waist: 0.15, chest: 0.17, armR: 0.044, arm: 0.36, hand: 0.05, neck: 0.012, neckR: 0.05, head: 0.26, headY: 0.96, skirtLen: 0.27, skirtFlare: 0.12, stride: 1.3, bounce: 0.05 };
const P3 = { leg: 0.78, legR: 0.056, hipW: 0.075, foot: 0.12, torso: 0.41, waist: 0.12, chest: 0.15, armR: 0.037, arm: 0.58, hand: 0.042, neck: 0.05, neckR: 0.042, head: 0.13, headY: 1.06, skirtLen: 0.5, skirtFlare: 0.17, stride: 1, bounce: 0.025 };
const mixP = (k) => Object.fromEntries(Object.keys(P1).map((n) => [n, P1[n] + (P3[n] - P1[n]) * k]));
export const BODIES = [{ name: '키 큰', P: P3, face: 'film' }, { name: '보통', P: mixP(0.5), face: 'film' }, { name: '꼬마', P: P1, face: 'chibi' }];
export const START_BODY = 2;   // 처음엔 꼬마

const TEX = new Map();
function faceTex(kind, skin) {
  const key = kind + skin; if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = skin; x.fillRect(0, 0, 1024, 512);
  const cx = 256, ey = 268;
  const blush = (dx, dy, r, a) => { for (const s of [-1, 1]) { const g = x.createRadialGradient(cx + s * dx, ey + dy, 1, cx + s * dx, ey + dy, r); g.addColorStop(0, `rgba(238,128,118,${a})`); g.addColorStop(1, 'rgba(238,128,118,0)'); x.fillStyle = g; x.fillRect(cx + s * dx - r, ey + dy - r, r * 2, r * 2); } };
  if (kind === 'chibi') {
    blush(54, 40, 38, 0.5);
    for (const s of [-1, 1]) { const X = cx + s * 50; x.fillStyle = '#24160f'; x.beginPath(); x.ellipse(X, ey + 4, 16, 22, 0, 0, 7); x.fill(); x.fillStyle = '#5a3a24'; x.beginPath(); x.ellipse(X, ey + 12, 11, 10, 0, 0, PI); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.ellipse(X - 5, ey - 5, 6, 7, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(X + 6, ey + 14, 2.6, 2.6, 0, 0, 7); x.fill();
      x.strokeStyle = '#5a3a28'; x.lineWidth = 3.5; x.lineCap = 'round'; x.beginPath(); x.moveTo(X - 12, ey - 34); x.quadraticCurveTo(X, ey - 39, X + 12, ey - 34); x.stroke(); }
    x.strokeStyle = '#a4483e'; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx - 9, ey + 44); x.quadraticCurveTo(cx, ey + 52, cx + 9, ey + 44); x.stroke();
  } else {   // 극장판: 눈은 조금 작고 아래로 · 윗눈꺼풀 선 · 작은 코 그림자 · 작은 미소
    blush(56, 40, 30, 0.38);
    for (const s of [-1, 1]) {
      const X = cx + s * 42, Y = ey + 6;
      x.fillStyle = '#fbf7f2'; x.beginPath(); x.ellipse(X, Y, 15, 17, 0, 0, 7); x.fill();
      const g = x.createLinearGradient(0, Y - 14, 0, Y + 14); g.addColorStop(0, '#2e1c12'); g.addColorStop(1, '#7a4e2c'); x.fillStyle = g; x.beginPath(); x.ellipse(X, Y + 2, 11, 13.5, 0, 0, 7); x.fill();
      x.fillStyle = '#140c08'; x.beginPath(); x.ellipse(X, Y + 2, 5.5, 6.5, 0, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.ellipse(X - 4.5, Y - 5, 4, 4.6, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(X + 4.5, Y + 7, 1.8, 1.8, 0, 0, 7); x.fill();
      x.strokeStyle = '#2a1a12'; x.lineWidth = 4.2; x.lineCap = 'round'; x.beginPath(); x.moveTo(X - 16, Y - 5); x.quadraticCurveTo(X - 2, Y - 21, X + 16, Y - 9); x.stroke();   // 윗눈꺼풀
      x.lineWidth = 2; x.beginPath(); x.moveTo(X + 15, Y - 9); x.lineTo(X + 20, Y - 13); x.stroke();
      x.strokeStyle = 'rgba(90,58,40,.9)'; x.lineWidth = 3.2; x.beginPath(); x.moveTo(X - 14, Y - 34); x.quadraticCurveTo(X, Y - 40, X + 14, Y - 35); x.stroke();   // 눈썹: 가늘고 부드럽게
    }
    const ng = x.createRadialGradient(cx + 3, ey + 34, 1, cx + 3, ey + 34, 9); ng.addColorStop(0, 'rgba(190,120,100,.55)'); ng.addColorStop(1, 'rgba(190,120,100,0)'); x.fillStyle = ng; x.fillRect(cx - 8, ey + 24, 22, 20);   // 코: 그림자만
    x.strokeStyle = '#a4483e'; x.lineWidth = 3.4; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx - 8, ey + 56); x.quadraticCurveTo(cx, ey + 61, cx + 8, ey + 56); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; TEX.set(key, t); return t;
}
const MATS = new Map();
const mat = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, ...(o || {}) })); return MATS.get(k); };
const SPH = (r, sy = 1, sz = 1, seg = 28) => { const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)); g.scale(1, sy, sz); return g; };
const CAP = (r0, r1, len, seg = 18) => { const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1); g.translate(0, -len / 2, 0); return g; };
const DOME = (r, sy, back) => { const g = new THREE.SphereGeometry(r, 32, 16, 0, PI * 2, 0, PI * 0.5); g.scale(1, sy, 1); g.rotateX(-back); return g; };
const SKIN = '#f4d6bc';
// 📷 사진기 종류 (🛍 상점): 확대 배율 · 사진 색감 · 모양
export const CAMERAS = [
  { id: 'basic', name: '기본 필름 사진기', price: 0, zoom: 4, filter: '', frame: '#fbf8f0', body: '#2e2a28', top: '#c8b490', lens: 0.045, icon: '📷', desc: '확대 4배 · 있는 그대로' },
  { id: 'instant', name: '즉석 사진기', price: 1200, zoom: 3, filter: 'saturate(1.15) contrast(0.95) brightness(1.05)', frame: '#ffffff', body: '#f2ece0', top: '#e86a5a', lens: 0.035, icon: '🖼', desc: '확대 3배 · 맑고 화사하게' },
  { id: 'vintage', name: '빈티지 사진기', price: 1800, zoom: 4, filter: 'sepia(0.55) contrast(1.05) saturate(0.9)', frame: '#f2e6c8', body: '#6a4a32', top: '#d8b878', lens: 0.05, icon: '🎞', desc: '확대 4배 · 옛날 사진 빛깔' },
  { id: 'mono', name: '흑백 사진기', price: 2000, zoom: 5, filter: 'grayscale(1) contrast(1.15)', frame: '#f6f6f2', body: '#1e1e20', top: '#a8a8a8', lens: 0.05, icon: '⚫', desc: '확대 5배 · 흑백' },
  { id: 'pastel', name: '파스텔 사진기', price: 2400, zoom: 4, filter: 'saturate(0.8) brightness(1.1) hue-rotate(-8deg)', frame: '#fde8ee', body: '#f2b8c8', top: '#a8d8e8', lens: 0.04, icon: '🌸', desc: '확대 4배 · 부드러운 파스텔' },
  { id: 'tele', name: '망원 사진기', price: 3600, zoom: 8, filter: 'contrast(1.05)', frame: '#fbf8f0', body: '#3a3e42', top: '#e8e2d4', lens: 0.11, icon: '🔭', desc: '확대 8배 · 먼 동물도 크게' },
];

// 💇 머리색: 앞 다섯은 처음부터 있고, 나머지는 🛍 상점에서 사요 (순서를 바꾸면 고른 색이 뒤바뀌니 늘 맨 뒤에 붙여요)
export const HAIRS = [
  { name: '검정', c: '#1e1a1c', price: 0 }, { name: '먹빛 갈색', c: '#2e2420', price: 0 }, { name: '짙은 갈색', c: '#3b2a22', price: 0 }, { name: '밤색', c: '#5a3a28', price: 0 }, { name: '갈색', c: '#6a4a30', price: 0 },
  { name: '밝은 갈색', c: '#9a6a3e', price: 200 }, { name: '꿀빛 금발', c: '#d8a850', price: 300 }, { name: '밀빛 금발', c: '#f0d890', price: 300 },
  { name: '빨강', c: '#b8402e', price: 400 }, { name: '주황', c: '#e07a30', price: 400 }, { name: '분홍', c: '#f29ab8', price: 400 }, { name: '보라', c: '#9a70d0', price: 400 },
  { name: '파랑', c: '#4f86d8', price: 400 }, { name: '민트', c: '#6ed0b8', price: 400 }, { name: '은색', c: '#c8ccd4', price: 500 }, { name: '흰색', c: '#f2f0ea', price: 500 },
];
// 🎀 액세서리: 한 번에 하나만 해요. 0 = 없이 (늘 맨 뒤에 붙여요)
export const ACCS = [
  { name: '없이', price: 0 }, { name: '동그란 안경', price: 500 }, { name: '선글라스', price: 700 }, { name: '목도리', price: 600 }, { name: '나비넥타이', price: 500 }, { name: '머리 리본', price: 500 },
  { name: '꽃 목걸이', price: 800 }, { name: '배낭', price: 900 }, { name: '크로스백', price: 800 }, { name: '망토', price: 1400 }, { name: '나비 날개', price: 2000 }, { name: '어깨 위 작은 새', price: 2400 },
];
// 줄무늬 · 땡땡이 옷감
function patTex(kind, base, ink) {
  const key = 'pat' + kind + base + ink; if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, 64, 64); x.fillStyle = ink;
  if (kind === 'stripe') { x.fillRect(0, 0, 64, 16); x.fillRect(0, 32, 64, 16); } else for (const [a, b] of [[16, 16], [48, 48]]) { x.beginPath(); x.arc(a, b, 8, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (kind === 'stripe') t.repeat.set(1, 3); else t.repeat.set(5, 3); TEX.set(key, t); return t;
}

export function person(look = 0, opts = {}) {
  const L = LOOKS[look % LOOKS.length], F = opts.g !== 'm', HAT = opts.hat ?? 0, BI = Math.min(2, Math.max(0, opts.body ?? START_BODY)), B = BODIES[BI], P = B.P;
  const root = new THREE.Group(), add = (p, g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; p.add(o); return o; };
  const C = { top: L.shirt, low: L.skirt, shoe: F ? '#7a4a32' : '#5a3a28', hair: HAIRS[opts.hair]?.c ?? L.hair };
  const KIND = L.kind || '', SK = L.low ? L.low === 'skirt' : F, ACC = opts.acc ?? 0;   // SK: 치마를 입었는지
  const TOP = L.pat ? new THREE.MeshStandardMaterial({ map: patTex(KIND, L.shirt, L.pat), roughness: 0.62 }) : mat(C.top);
  const skin = mat(SKIN), hip = P.leg;
  const hips = J(root, 0, hip, 0), body = J(hips);
  // 다리: 여자는 맨다리 + 치마, 남자는 바지
  const legs = [-1, 1].map((s) => {
    const l = J(hips, s * P.hipW, 0, 0), th = P.leg * 0.5, sh = P.leg * 0.5, lm = mat(SK ? SKIN : C.low);
    add(l, CAP(P.legR * 1.15, P.legR * 0.88, th), lm); add(l, SPH(P.legR * 0.9, 1, 1, 12), lm, 0, -th, 0);
    const k = J(l, 0, -th, 0); add(k, CAP(P.legR * 0.88, P.legR * 0.64, sh - P.foot * 0.5), lm);
    add(k, SPH(P.foot * 0.55, 0.55, 1.45, 18), mat(C.shoe), 0, -sh + P.foot * 0.26, P.foot * 0.32);
    return { l, k };
  });
  // 몸통 (둥근 어깨)
  const tl = P.torso;
  add(body, CAP(P.waist, P.chest, tl, 26), TOP, 0, tl, 0).scale.z = 0.78;
  add(body, SPH(P.chest * 1.02, 0.5, 0.8, 26), TOP, 0, tl, 0);
  // 몸통을 감싸는 옷감 조각: y0~y1 높이, 앞(+z) 가운데에서 양쪽으로 th 만큼. off 로 돌려요 (PI = 등쪽)
  const rAt = (y) => P.waist + (P.chest - P.waist) * y / tl;
  const wrap = (y0, y1, th, m, k = 1.05, off = 0) => { const o = add(body, new THREE.CylinderGeometry(rAt(y1) * k, rAt(y0) * k, y1 - y0, 22, 1, true, off - th, th * 2), m, 0, (y0 + y1) / 2, 0); o.scale.z = 0.8; return o; };
  const two = (c) => mat(c, { side: THREE.DoubleSide }), fz = (y) => rAt(y) * 0.84;
  // 치마 · 우비 자락 (허리보다 높은 곳에서 시작할 수도 있어요)
  const flare = (y0, len, wide, c) => { const r0 = rAt(Math.max(0, y0)) * 1.03, pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(r0 + wide * Math.pow(t, 1.2) + (i === 12 ? -0.006 : 0), -t * len)); } const o = add(body, new THREE.LatheGeometry(pts, 36), two(c), 0, y0, 0); o.scale.z = 0.86; o.userData.fit = { y0, len }; return o; };
  let skirt = null; const hanbokF = KIND === 'hanbok' && SK;
  if (hanbokF) skirt = flare(tl * 0.68, tl * 0.68 + P.leg * 0.8, P.skirtFlare * 1.5, C.low);
  else if (SK) skirt = flare(P.waist * 0.45, P.skirtLen * (KIND === 'dress' ? 1.2 : 1), P.skirtFlare, C.low);
  else add(body, SPH(P.waist * 1.1, 0.62, 0.82, 22), mat(C.low), 0, 0.01, 0);
  if (KIND === 'rain') skirt = flare(P.waist * 0.5, P.leg * 0.62, P.skirtFlare * 0.9, C.top);
  if (KIND === 'hanbok' && !SK) flare(P.waist * 0.5, P.leg * 0.3, P.skirtFlare * 0.3, C.top);   // 남자 한복: 저고리 자락
  if (!['dress', 'rain', 'hanbok', 'suit'].includes(KIND)) add(body, new THREE.TorusGeometry(P.waist * 1.0, P.waist * 0.07, 8, 26), mat(L.bag), 0, P.waist * 0.45, 0).rotation.x = PI / 2;   // 허리띠
  // 팔: 어깨에서 몸 가까이 내려오고, 팔꿈치가 살짝 굽어 있어요. 이음매는 둥근 공으로 감춰요
  const arms = [-1, 1].map((s) => {
    const a = J(body, s * (P.chest * 0.9), tl - P.armR * 0.4, 0), up = P.arm * 0.48, lo = P.arm * 0.44;
    const low = L.long ? TOP : skin;   // 긴소매면 아래팔까지 옷
    add(a, SPH(P.armR * 1.45, 1.05, 1, 16), TOP);
    add(a, CAP(P.armR * 1.2, P.armR * 0.98, up), TOP);
    add(a, SPH(P.armR * 0.98, 1, 1, 12), low, 0, -up, 0);   // 팔꿈치
    const f = J(a, 0, -up, 0); add(f, CAP(P.armR * 0.95, P.armR * (KIND === 'hanbok' ? 1.25 : 0.72), lo), low);
    if (KIND === 'hanbok') add(f, new THREE.CylinderGeometry(P.armR * 1.3, P.armR * 1.3, lo * 0.14, 14), mat(L.band), 0, -lo * 0.93, 0);   // 소매 끝동
    const h = J(f, 0, -lo, 0); add(h, SPH(P.hand, 1.2, 0.62, 14), skin, 0, -P.hand * 0.75, 0); add(h, SPH(P.hand * 0.38, 0.9, 0.7, 10), skin, -s * P.hand * 0.55, -P.hand * 0.35, P.hand * 0.2);   // 손 · 엄지
    a.rotation.z = s * 0.06; return { a, f, s, h };
  });
  // 목 · 머리
  const nTop = tl + P.chest * 0.3;
  add(body, CAP(P.neckR, P.neckR * 1.05, P.neck + 0.04), skin, 0, nTop + P.neck, 0);
  const head = J(body, 0, nTop + P.neck + P.head * 0.88, 0);
  add(head, SPH(P.head, P.headY, 0.96, 36), new THREE.MeshStandardMaterial({ map: faceTex(B.face, SKIN), roughness: 0.72 }));
  if (BI < 2) { for (const s of [-1, 1]) add(head, SPH(P.head * 0.16, 1.3, 0.6, 10), skin, s * P.head * 0.98, -P.head * 0.05, 0); add(head, SPH(P.head * 0.08, 0.85, 0.75, 10), skin, 0, -P.head * 0.16, P.head * 0.95); }
  // 머리카락: 정수리 반구 + 뒤통수 + 앞머리 갈래 (+ 여자는 긴 머리)
  const H = mat(C.hair), hairG = J(head), tips = [];
  add(hairG, DOME(P.head * 1.08, 1.0, 0.32), H, 0, P.head * 0.05, -P.head * 0.02);
  add(hairG, SPH(P.head * 1.02, F ? 1.12 : 0.8, 0.85, 26), H, 0, F ? -P.head * 0.2 : 0, -P.head * 0.32);
  const nB = F ? 9 : 7; for (let i = 0; i < nB; i++) { const a = -0.9 + i * (1.8 / (nB - 1)), b = J(hairG, sin(a) * P.head * 0.86, P.head * 0.66, cos(a) * P.head * 0.66); b.rotation.set(1.05, a, -a * 0.3); add(b, SPH(P.head * 0.19, F ? 0.8 : 0.6, 0.4, 12), H, 0, -P.head * 0.1, 0); tips.push(b); }
  if (F) for (let i = 0; i < 7; i++) { const a = PI * 0.62 + i * (PI * 0.76 / 6), t = J(hairG, sin(a) * P.head * 0.88, -P.head * 0.1, cos(a) * P.head * 0.88); add(t, CAP(P.head * 0.22, P.head * 0.12, P.head * (BI < 2 ? 1.5 : 1.1), 10), H); t.rotation.x = -0.12; tips.push(t); }
  else for (const s of [-1, 1]) add(hairG, SPH(P.head * 0.32, 0.6, 0.6, 12), H, s * P.head * 0.9, P.head * 0.2, -P.head * 0.05);
  // 옷 모양마다 덧붙이는 것
  const dark = mat(L.band);
  if (KIND === 'hood' || KIND === 'rain') { add(body, SPH(P.chest * 0.78, 0.72, 0.62, 18), mat(C.top), 0, nTop + P.neck * 0.5, -P.chest * 0.72); }
  if (KIND === 'hood') { wrap(tl * 0.08, tl * 0.36, 0.72, two(L.band), 1.05); for (const s of [-1, 1]) add(body, CAP(P.chest * 0.03, P.chest * 0.03, tl * 0.26, 6), mat('#fbf8f0'), s * P.chest * 0.16, tl * 1.0, fz(tl)); }
  if (KIND === 'overall') { wrap(tl * 0.02, tl * 0.74, 0.8, two(C.low), 1.05); for (const s of [-1, 1]) { wrap(tl * 0.7, tl * 0.99, 0.13, two(C.low), 1.05, s * 0.62); wrap(tl * 0.2, tl * 0.99, 0.13, two(C.low), 1.05, PI + s * 0.5); add(body, SPH(P.chest * 0.06, 1, 0.6, 8), mat('#e8c860'), s * P.chest * 0.42, tl * 0.72, fz(tl * 0.72) + 0.006); } }
  if (KIND === 'dress') add(body, new THREE.TorusGeometry(P.neckR * 1.5, P.neckR * 0.34, 8, 22), mat(L.band), 0, nTop - P.chest * 0.02, 0).rotation.x = PI / 2;
  if (KIND === 'vest') { wrap(tl * 0.02, tl * 0.98, 2.62, two(L.band), 1.07, PI); for (const s of [-1, 1]) wrap(tl * 0.14, tl * 0.36, 0.26, two(L.bag), 1.09, s * 0.92); }
  if (KIND === 'rain') for (let i = 0; i < 3; i++) add(body, SPH(P.chest * 0.07, 1, 0.5, 8), mat('#fbf8f0'), 0, tl * (0.2 + i * 0.26), fz(tl * (0.2 + i * 0.26)) + 0.004);
  if (KIND === 'sailor') { wrap(tl * 0.68, tl * 1.0, 1.75, two(L.band), 1.07, PI); wrap(tl * 0.72, tl * 1.0, 0.42, two(L.band), 1.07, 0.74); wrap(tl * 0.72, tl * 1.0, 0.42, two(L.band), 1.07, -0.74); for (const s of [-1, 1]) add(body, SPH(P.chest * 0.2, 0.62, 0.34, 10), mat('#c84a3e'), s * P.chest * 0.18, tl * 0.74, fz(tl * 0.74) + 0.008); }
  if (KIND === 'suit') { wrap(tl * 0.58, tl * 1.0, 0.36, two('#fbf8f0'), 1.04); add(body, new THREE.BoxGeometry(P.chest * 0.2, tl * 0.4, 0.008), dark, 0, tl * 0.78, fz(tl * 0.78) + 0.012); }
  if (KIND === 'hanbok') { for (const s of [-1, 1]) wrap(tl * 0.72, tl * 1.0, 0.14, two(L.band), 1.06, s * 0.3); add(body, SPH(P.chest * 0.16, 0.7, 0.4, 10), dark, P.chest * 0.2, tl * 0.76, fz(tl * 0.76) + 0.008); for (const s of [-1, 1]) { const r = add(body, new THREE.BoxGeometry(P.chest * 0.13, tl * 0.5, 0.006), dark, P.chest * (0.2 + s * 0.09), tl * 0.5, fz(tl * 0.5) + 0.01); r.rotation.z = s * 0.14; } }
  // 🎀 액세서리 (ACCS 순서)
  let cape = null, wings = null, bird = null; const hs = P.head;
  if (ACC === 1 || ACC === 2) { const g = J(head, 0, -hs * P.headY * 0.09, 0), fm = mat(ACC === 1 ? '#5a3a28' : '#1e1e22');
    for (const s of [-1, 1]) { add(g, new THREE.TorusGeometry(hs * 0.23, hs * 0.03, 8, 24), fm, s * hs * 0.31, 0, hs * 0.92).rotation.y = s * 0.3; if (ACC === 2) add(g, new THREE.CircleGeometry(hs * 0.23, 20), new THREE.MeshStandardMaterial({ color: '#23262e', roughness: 0.15, metalness: 0.4 }), s * hs * 0.31, 0, hs * 0.925).rotation.y = s * 0.3; const t = add(g, new THREE.BoxGeometry(hs * 0.03, hs * 0.03, hs * 0.8), fm, s * hs * 0.77, hs * 0.02, hs * 0.46); t.rotation.y = -s * 0.5; }
    add(g, new THREE.BoxGeometry(hs * 0.18, hs * 0.03, hs * 0.03), fm, 0, hs * 0.02, hs * 0.97); }
  if (ACC === 3) { const sc = add(body, new THREE.TorusGeometry(P.chest * 0.72, P.chest * 0.24, 10, 26), mat('#c8504a'), 0, tl + P.chest * 0.12, 0); sc.rotation.x = PI / 2; sc.scale.y = 0.86; add(body, new THREE.BoxGeometry(P.chest * 0.42, tl * 0.56, P.chest * 0.12), mat('#c8504a'), P.chest * 0.62, tl * 0.76, fz(tl * 0.76) + 0.03); add(body, new THREE.BoxGeometry(P.chest * 0.44, tl * 0.05, P.chest * 0.14), mat('#fbe8d0'), P.chest * 0.62, tl * 0.58, fz(tl * 0.76) + 0.03); }
  if (ACC === 4) { const y = nTop - P.chest * 0.08; for (const s of [-1, 1]) add(body, new THREE.ConeGeometry(P.chest * 0.2, P.chest * 0.42, 4), mat('#c8404a'), s * P.chest * 0.2, y, fz(tl) + 0.02).rotation.z = s * PI / 2; add(body, SPH(P.chest * 0.08, 1, 1, 8), mat('#a02a38'), 0, y, fz(tl) + 0.03); }
  if (ACC === 5) { const g = J(head, hs * 0.46, hs * 0.98, -hs * 0.12); g.rotation.z = -0.45; for (const s of [-1, 1]) add(g, SPH(hs * 0.27, 0.7, 0.4, 12), mat('#ee7a9a'), s * hs * 0.26, 0, 0); add(g, SPH(hs * 0.1, 1, 0.8, 8), mat('#c84a70')); }
  if (ACC === 6) { const fc = ['#f2a0b8', '#fff2a8', '#ffffff', '#c8a8f0', '#f6b07a']; for (let i = 0; i < 14; i++) { const a = i / 14 * PI * 2, dip = (cos(a) + 1) / 2; add(body, SPH(P.chest * 0.17, 0.8, 1, 8), mat(fc[i % 5]), sin(a) * P.chest * 0.88, tl + P.chest * 0.3 - dip * P.chest * 0.16, cos(a) * P.chest * 0.86); } }
  if (ACC === 7) { add(body, SPH(P.chest * 0.82, 1.15, 0.6, 18), mat('#c8604a'), 0, tl * 0.56, -P.chest * 1.0); add(body, SPH(P.chest * 0.5, 0.7, 0.34, 12), mat('#a84a3a'), 0, tl * 0.42, -P.chest * 1.32); for (const s of [-1, 1]) wrap(tl * 0.5, tl * 1.0, 0.13, two('#8a4030'), 1.06, s * 0.6); }
  if (ACC === 8) { const r = add(body, new THREE.TorusGeometry(P.chest * 1.12, P.chest * 0.05, 6, 30), mat('#7a4e32'), 0, tl * 0.52, 0); r.rotation.order = 'ZYX'; r.rotation.set(0, PI / 2, 0.72); r.scale.set(0.78, 1.45, 1); add(body, SPH(P.chest * 0.42, 0.85, 0.42, 14), mat('#a0683e'), P.chest * 1.04, tl * 0.08, 0); }
  if (ACC === 9) { const len = tl + P.leg * 0.62; cape = J(body, 0, tl * 1.02, 0); const g = new THREE.CylinderGeometry(P.chest * 1.0, Math.max(P.chest * 1.5, (P.waist + P.skirtFlare) * 1.3), len, 18, 1, true, PI - 1.25, 2.5); g.translate(0, -len / 2, 0); add(cape, g, two('#b83a4a')); add(body, new THREE.TorusGeometry(P.neckR * 1.4, P.neckR * 0.3, 8, 20), mat('#e0b040'), 0, nTop - P.chest * 0.04, 0).rotation.x = PI / 2; }
  if (ACC === 10) { wings = [-1, 1].map((s) => { const w = J(body, s * P.chest * 0.2, tl * 0.74, -P.chest * 0.72), m = new THREE.MeshStandardMaterial({ color: '#b8a0f0', roughness: 0.4, transparent: true, opacity: 0.82, side: THREE.DoubleSide }), m2 = mat('#f2a8d0', { side: THREE.DoubleSide }); add(w, SPH(hs + P.chest * 0.5, 0.68, 0.04, 16), m, s * (hs + P.chest * 0.42), (hs + P.chest) * 0.28, 0); add(w, SPH((hs + P.chest * 0.5) * 0.66, 0.8, 0.04, 14), m2, s * (hs + P.chest * 0.2) * 0.72, -(hs + P.chest) * 0.3, 0); return { w, s }; }); }
  if (ACC === 11) { bird = J(body, P.chest * 1.25, tl + P.armR * 0.9, 0); const b = hs * 0.42 + 0.03; add(bird, SPH(b * 0.7, 0.85, 1.1, 12), mat('#f2c82a'), 0, b * 0.6, 0); add(bird, SPH(b * 0.5, 1, 1, 12), mat('#f2c82a'), 0, b * 1.2, b * 0.44); add(bird, new THREE.ConeGeometry(b * 0.16, b * 0.34, 8), mat('#e8803a'), 0, b * 1.16, b * 1.02).rotation.x = PI / 2; for (const s of [-1, 1]) { add(bird, SPH(b * 0.09, 1, 1, 6), mat('#1e1a1c'), s * b * 0.3, b * 1.3, b * 0.78); add(bird, SPH(b * 0.38, 0.7, 1.1, 8), mat('#e0a818'), s * b * 0.62, b * 0.6, -b * 0.06); } }
  // 모자: 머리 크기에 맞춰 키워요
  const hat = J(head, 0, P.head * P.headY * 0.74, -P.head * 0.02), k = P.head / 0.116; hat.scale.setScalar(k); hat.rotation.x = -0.14;
  const half = (r, sy, c) => { const m = add(hat, new THREE.SphereGeometry(r, 30, 12, 0, PI * 2, 0, PI * 0.5), mat(c)); m.scale.y = sy; return m; };
  let rib = J(hat);
  if (HAT === 0) { add(hat, new THREE.CylinderGeometry(0.2, 0.205, 0.01, 44), mat('#e6c98a')); half(0.118, 0.72, '#ecd296'); add(hat, new THREE.CylinderGeometry(0.119, 0.12, 0.026, 32, 1, true), mat(L.band, { side: THREE.DoubleSide }), 0, 0.016, 0); rib = J(hat, 0.05, 0.015, -0.11); add(rib, new THREE.BoxGeometry(0.03, 0.15, 0.006), mat(L.band, { side: THREE.DoubleSide }), 0, -0.07, 0); }
  else if (HAT === 1) { hat.position.y -= P.head * 0.25; half(0.122, 0.78, L.band); const bl = add(hat, new THREE.CylinderGeometry(0.11, 0.11, 0.01, 24, 1, false, -PI / 2, PI), mat(L.band), 0, 0, 0.07); bl.scale.z = 1.2; }
  else if (HAT === 2) { hat.position.y -= P.head * 0.28; half(0.125, 1.05, L.skirt); add(hat, new THREE.TorusGeometry(0.118, 0.022, 10, 30), mat(L.shirt), 0, 0.01, 0).rotation.x = PI / 2; add(hat, SPH(0.035, 1, 1, 12), mat(L.shirt), 0, 0.135, 0); }
  else if (HAT === 3) { hat.position.y -= P.head * 0.25; add(hat, new THREE.CylinderGeometry(0.18, 0.185, 0.01, 36), mat('#c8b48a')); add(hat, new THREE.CylinderGeometry(0.1, 0.12, 0.1, 30), mat('#d4c098'), 0, 0.05, 0); add(hat, new THREE.CylinderGeometry(0.121, 0.121, 0.022, 30, 1, true), mat('#6a5038', { side: THREE.DoubleSide }), 0, 0.02, 0); }
  else if (HAT === 4) { hat.position.y -= P.head * 0.32; const fc = ['#f2a0b8', '#fff2a8', '#ffffff', '#c8a8f0', '#f6b07a']; for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; add(hat, SPH(0.026, 0.8, 1, 10), mat(fc[i % 5]), sin(a) * 0.112, 0.02, cos(a) * 0.105); } }
  else if (HAT === 6) { hat.position.y -= P.head * 0.22; hat.rotation.z = 0.24; half(0.142, 0.42, '#8a3a4a'); add(hat, new THREE.CylinderGeometry(0.008, 0.012, 0.03, 8), mat('#8a3a4a'), 0, 0.068, 0); }
  else if (HAT === 7) { hat.position.y -= P.head * 0.14; const au = mat('#e8b838', { metalness: 0.45, roughness: 0.35 }); add(hat, new THREE.CylinderGeometry(0.098, 0.094, 0.036, 28, 1, true), mat('#e8b838', { metalness: 0.45, roughness: 0.35, side: THREE.DoubleSide }), 0, 0.016, 0); for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; add(hat, new THREE.ConeGeometry(0.024, 0.06, 6), au, sin(a) * 0.096, 0.062, cos(a) * 0.096); add(hat, SPH(0.012, 1, 1, 8), mat(['#d83a4a', '#3a7ad8'][i % 2]), sin(a) * 0.1, 0.018, cos(a) * 0.1); } }
  else if (HAT === 8) { hat.position.y -= P.head * 0.25; add(hat, new THREE.CylinderGeometry(0.2, 0.205, 0.01, 36), mat('#3f3a78')); const c = add(hat, new THREE.ConeGeometry(0.118, 0.3, 28), mat('#3f3a78'), 0, 0.15, 0); c.rotation.x = -0.1; add(hat, new THREE.CylinderGeometry(0.114, 0.12, 0.024, 28, 1, true), mat('#e8c84a', { side: THREE.DoubleSide }), 0, 0.02, 0); add(hat, SPH(0.016, 1, 0.5, 8), mat('#f2d860'), 0.03, 0.12, 0.078); add(hat, SPH(0.012, 1, 0.5, 8), mat('#f2d860'), -0.035, 0.07, 0.092); }
  else if (HAT === 9 || HAT === 10 || HAT === 11) { hat.position.y = 0; const c = HAT === 9 ? '#fbf6ee' : HAT === 10 ? '#3a3238' : '#e85a7a', band = add(hat, new THREE.TorusGeometry(0.131, 0.007, 8, 28, PI), mat(HAT === 9 ? '#f2a8c0' : c));
    if (HAT === 9) for (const s of [-1, 1]) { const e = J(hat, s * 0.058, 0.118, 0); e.rotation.z = -s * 0.2; add(e, SPH(0.034, 3.1, 0.42, 14), mat(c), 0, 0.096, 0); add(e, SPH(0.019, 3.5, 0.3, 12), mat('#f2a8c0'), 0, 0.096, 0.01); }
    else if (HAT === 10) for (const s of [-1, 1]) { const e = add(hat, new THREE.ConeGeometry(0.05, 0.085, 4), mat(c), s * 0.086, 0.13, 0); e.rotation.z = -s * 0.42; add(hat, new THREE.ConeGeometry(0.03, 0.055, 4), mat('#f2a8c0'), s * 0.085, 0.124, 0.022).rotation.z = -s * 0.42; }
    else { const b = J(hat, 0.07, 0.112, 0.016); b.rotation.z = -0.5; for (const s of [-1, 1]) add(b, SPH(0.042, 0.72, 0.42, 12), mat(c), s * 0.042, 0, 0); add(b, SPH(0.016, 1, 0.8, 8), mat('#c83a5a')); } }
  else if (HAT === 12) { hat.position.y -= P.head * 0.27; const c = add(hat, new THREE.ConeGeometry(0.115, 0.22, 26), mat('#c8383a'), -0.012, 0.11, -0.012); c.rotation.z = 0.2; c.rotation.x = -0.24; add(hat, new THREE.TorusGeometry(0.115, 0.026, 10, 30), mat('#fbf8f0'), 0, 0.012, 0).rotation.x = PI / 2; add(hat, SPH(0.032, 1, 1, 12), mat('#fbf8f0'), -0.05, 0.215, -0.062); }
  else if (HAT === 13) { hat.position.y = 0; add(hat, new THREE.TorusGeometry(0.132, 0.011, 8, 28, PI), mat('#34343c')); for (const s of [-1, 1]) { const m = add(hat, new THREE.CylinderGeometry(0.046, 0.046, 0.03, 20), mat('#e85a5a'), s * 0.126, -0.004, 0); m.rotation.z = PI / 2; add(hat, new THREE.CylinderGeometry(0.03, 0.03, 0.01, 16), mat('#34343c'), s * 0.144, -0.004, 0).rotation.z = PI / 2; } }
  else if (HAT === 14) { hat.position.y -= P.head * 0.24; add(hat, new THREE.CylinderGeometry(0.112, 0.116, 0.09, 28), mat('#fbf8f0'), 0, 0.04, 0); for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; add(hat, SPH(0.062, 0.85, 1, 12), mat('#fbf8f0'), sin(a) * 0.072, 0.108, cos(a) * 0.072); } add(hat, SPH(0.07, 0.9, 1, 12), mat('#fbf8f0'), 0, 0.128, 0); }
  else if (HAT === 15) { hat.position.y -= P.head * 0.22; half(0.17, 0.74, '#d0403a'); for (const [a, b, r] of [[0.06, 0.09, 0.026], [-0.08, 0.075, 0.03], [0.02, 0.118, 0.02], [0.12, 0.05, 0.02], [-0.03, 0.05, 0.024]]) { add(hat, SPH(r, 0.6, 1, 10), mat('#fbf8f0'), a, b, Math.sqrt(Math.max(0, 0.0289 - a * a - (b / 0.74) ** 2)) + 0.002); } }
  else if (HAT === 16) { hat.position.y -= P.head * 0.24; add(hat, SPH(0.22, 0.42, 0.42, 22), mat('#2a262c'), 0, 0.05, 0); add(hat, new THREE.TorusGeometry(0.2, 0.006, 6, 30), mat('#e8c84a'), 0, 0.012, 0).rotation.x = PI / 2; add(hat, SPH(0.022, 1, 0.5, 10), mat('#fbf8f0'), 0, 0.066, 0.09); }
  else if (HAT === 17) { hat.position.y -= P.head * 0.25; half(0.122, 0.78, '#c8403a'); const bl = add(hat, new THREE.CylinderGeometry(0.11, 0.11, 0.01, 24, 1, false, -PI / 2, PI), mat('#fbf8f0'), 0, 0, 0.07); bl.scale.z = 1.2; add(hat, SPH(0.03, 1, 0.3, 10), mat('#fbf8f0'), 0, 0.054, 0.104); }
  // 📷 목에 건 사진기 · 끈
  const CM = CAMERAS.find((c) => c.id === opts.cam) || CAMERAS[0];
  const cs = P.head / 0.116, cz = P.chest * 0.84 + 0.04 * cs * 0.8, camG = J(body, 0, tl * 0.62, cz), cb = J(camG);
  add(cb, new THREE.BoxGeometry(0.13 * cs * 0.8, 0.085 * cs * 0.8, 0.06 * cs * 0.8), mat(CM.body)); add(cb, new THREE.BoxGeometry(0.13 * cs * 0.8, 0.026 * cs * 0.8, 0.062 * cs * 0.8), mat(CM.top), 0, 0.036 * cs, 0);
  add(cb, new THREE.CylinderGeometry(0.028 * cs, 0.031 * cs, CM.lens * cs, 18), mat('#1a1818'), 0, -0.004, (0.018 + CM.lens / 2) * cs).rotation.x = PI / 2;
  add(cb, new THREE.CylinderGeometry(0.02 * cs, 0.02 * cs, 0.004 * cs, 16), new THREE.MeshStandardMaterial({ color: '#5a7a98', roughness: 0.05, metalness: 0.6 }), 0, -0.004, (0.02 + CM.lens) * cs).rotation.x = PI / 2;
  // 목줄: 사진기 양옆 고리에서 어깨를 지나 목 뒤로 (사진기를 들면 같이 따라 올라가요)
  const strapM = mat('#6a4430'), strapPts = (lift) => { const yC = tl * 0.62 + lift, zC = cz, w = 0.06 * cs, nY = nTop + P.neck * 0.6; return [[-w, yC + 0.02 * cs, zC], [-P.chest * 0.55, (yC + nY) / 2 + 0.02, P.chest * 0.7], [-P.neckR * 1.25, nY, P.neckR * 0.2], [0, nY + 0.01, -P.neckR * 1.35], [P.neckR * 1.25, nY, P.neckR * 0.2], [P.chest * 0.55, (yC + nY) / 2 + 0.02, P.chest * 0.7], [w, yC + 0.02 * cs, zC]].map(([x, y, z]) => new THREE.Vector3(x, y, z)); };
  const strap = add(body, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strapPts(0)), 40, 0.007 * cs, 6), strapM); let strapLift = 0;
  const st = { root, walk: 0, step: 0, waveT: 0, aim: 0, aimK: 0, snapT: 0, rate: 1, sit: 0, sitK: 0, look, g: F ? 'f' : 'm', hat: HAT, body: BI, cam: CM.id, hair: opts.hair ?? -1, acc: ACC, hold: 0, handR: arms[1].h, torch: 0, handL: arms[0].h, net: 0, netBig: 0, sip: 0, read: 0 };   // sip: 찻잔을 들고 마셔요 · read: 두 손으로 책을 펴 들어요   // torch: 왼손에 손전등을 들고 앞을 비춰요   // hold: 오른손을 높이 들어요 (불꽃 막대)
  st.update = (t, dt) => {
    st.step += dt * st.walk * 8.4 * P.stride * (st.rate || 1); const p = st.step, w = st.walk;
    legs.forEach(({ l, k: kn }, i) => { const q = p + i * PI; l.rotation.x = sin(q) * 0.44 * w; kn.rotation.x = max(0, -sin(q - 0.9)) * 0.7 * w; });
    // 팔: 걸을 땐 앞뒤로 · 서 있을 땐 숨 쉬듯 살짝. 팔꿈치는 늘 조금 굽혀요
    arms.forEach(({ a, f, s }, i) => { a.rotation.x = -sin(p + i * PI) * 0.36 * w + sin(t * 0.8 + i) * 0.025; a.rotation.z = s * (0.06 + 0.02 * sin(t * 1.3)); f.rotation.x = -0.22 - 0.18 * w - max(0, sin(p + i * PI)) * 0.25 * w; f.rotation.z = 0; });
    if (st.waveT > 0) st.waveT = max(0, st.waveT - dt);
    const wv = st.waveT > 0 ? min(1, st.waveT * 4, (2.4 - st.waveT) * 5) : 0;
    if (wv > 0) { const R = arms[1]; R.a.rotation.z = 0.06 + wv * 2.5; R.a.rotation.x *= 1 - wv; R.f.rotation.x = -0.3 * (1 - wv) - 0.25 * wv; R.f.rotation.z = wv * sin(t * 12) * 0.5; }
    st.aimK += ((st.aim ? 1 : 0) - st.aimK) * min(1, dt * 7); const ak = st.aimK * st.aimK * (3 - 2 * st.aimK);
    if (st.snapT > 0) st.snapT = max(0, st.snapT - dt);
    if (ak > 0.01) arms.forEach(({ a, f, s }) => { a.rotation.x = a.rotation.x * (1 - ak) - 1.0 * ak; a.rotation.z = a.rotation.z * (1 - ak) - s * 0.4 * ak; f.rotation.x = f.rotation.x * (1 - ak) - 1.65 * ak; f.rotation.z = -s * 0.7 * ak; });
    camG.position.set(0, tl * 0.62 + (P.neck + P.head * 0.9 + P.chest * 0.38) * ak, cz + P.head * 0.7 * ak);
    const lift = Math.round(ak * 6) / 6; if (lift !== strapLift) { strapLift = lift; strap.geometry.dispose(); const pts = strapPts((P.neck + P.head * 0.9 + P.chest * 0.38) * lift); pts[0].z += P.head * 0.7 * lift; pts[6].z += P.head * 0.7 * lift; strap.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.007 * cs, 6); } camG.rotation.x = sin(t * 2.2) * 0.1 * (1 - ak) - 0.1 * ak;
    cb.position.y = st.snapT > 0 ? -0.015 : 0;
    hips.position.y = hip + abs(sin(p)) * P.bounce * w + sin(t * 1.5) * 0.003 * (1 - w);
    // 🪑 앉기 (st.sit 0/1): 통나무 의자 높이 st.seat 에 엉덩이를 내리고, 허벅지는 앞으로 · 정강이는 아래로
    st.sitK += ((st.sit ? 1 : 0) - st.sitK) * min(1, dt * 5); const sk = st.sitK * st.sitK * (3 - 2 * st.sitK);
    if (sk > 0.01) { hips.position.y = hips.position.y * (1 - sk) + ((st.seat ?? 0.3) + P.legR) * sk; legs.forEach(({ l, k: kn }) => { l.rotation.x = l.rotation.x * (1 - sk) - 1.45 * sk; kn.rotation.x = kn.rotation.x * (1 - sk) + 1.45 * sk; }); if (!ak) arms.forEach(({ a, f }) => { a.rotation.x = a.rotation.x * (1 - sk) - 0.35 * sk; f.rotation.x = f.rotation.x * (1 - sk) - 0.7 * sk; }); }
    // 손에 드는 동작(손전등 · 잠자리채 · 찻잔 · 책 · 불꽃 막대)은 앉기 자세 다음에 덮어써요
    if (st.torch && ak < 0.5) { const Lf = arms[0]; Lf.a.rotation.x = -0.35 + Lf.a.rotation.x * 0.3; Lf.a.rotation.z = -0.12; Lf.f.rotation.x = -1.25; Lf.f.rotation.z = 0; }
    if (st.net) { const R = arms[1], sw = Math.sin(t * (st.netBig > 0 ? 9 : 3.2)), big = st.netBig > 0 ? 1 : 0; R.a.rotation.x = -1.25 - big * 0.5 + sw * (0.45 + big * 0.5); R.a.rotation.z = 0.2 + sw * (0.35 + big * 0.4); R.f.rotation.x = -0.25; R.f.rotation.z = 0; }   // 🦋 잠자리채: 걸으며 살랑, 잡을 땐 크게 휙휙
    if (st.sip) { const R = arms[1], c = (t % 4) / 4, up = c < 0.25 ? c / 0.25 : c < 0.55 ? 1 : c < 0.75 ? 1 - (c - 0.55) / 0.2 : 0, e = up * up * (3 - 2 * up);   // 4초마다 한 모금
      R.a.rotation.x = -0.55 - e * 0.75; R.a.rotation.z = 0.12 - e * 0.15; R.f.rotation.x = -1.15 - e * 0.55; R.f.rotation.z = 0; head.rotation.x += e * -0.18; }
    if (st.read) arms.forEach(({ a, f, s }) => { a.rotation.x = -0.75; a.rotation.z = -s * 0.32; f.rotation.x = -1.05; f.rotation.z = -s * 0.25; });
    if (st.hold) { const R = arms[1]; R.a.rotation.x = -2.55; R.a.rotation.z = 0.16; R.f.rotation.x = -0.12; R.f.rotation.z = 0; }
    body.rotation.y = sin(p) * 0.05 * w;
    if (skirt) { skirt.rotation.x = sin(p * 2) * 0.04 * w + sin(t * 1.9) * 0.02; skirt.rotation.z = sin(p) * 0.04 * w; }
    // 치마 · 한복 · 우비 자락이 바닥에 끌리지 않게: 자락 끝이 늘 바닥보다 조금 위에 오도록 길이를 줄여요. 앉으면 무릎 위로 살짝 퍼져요
    if (skirt?.userData.fit) { const { y0, len } = skirt.userData.fit, room = hips.position.y + y0 - 0.035, k = Math.max(0.2, Math.min(1, room / len));
      skirt.scale.y = k; skirt.scale.x = 1 + 0.3 * sk; skirt.scale.z = 0.86 * (1 + 0.45 * sk); }
    head.rotation.set(sin(t * 0.5) * 0.03 * (1 - ak) + 0.08 * ak, sin(t * 0.33) * 0.18 * (1 - w) * (1 - ak), sin(t * 0.7) * 0.02);
    rib.rotation.x = 0.3 + sin(t * 3.4) * 0.25 + w * 0.4;
    if (cape) cape.rotation.x = -(0.08 + 0.34 * w + sin(t * 2.2) * 0.04);   // 걸으면 망토가 뒤로 날려요
    if (wings) wings.forEach(({ w: g, s }) => { g.rotation.y = s * (0.34 + sin(t * (w > 0.1 ? 9 : 2.4)) * 0.26); });
    if (bird) { bird.position.y = tl + P.armR * 0.9 + abs(sin(t * 1.7)) * 0.008; bird.rotation.y = sin(t * 0.8) * 0.5; }
    tips.forEach((b, i) => { b.rotation.z = (b.userData.z0 ??= b.rotation.z) + sin(t * 2.1 + i) * 0.04; });
  };
  return st;
}
