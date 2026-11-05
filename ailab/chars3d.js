// AI 연구소 캐릭터 — 사장님 · 직원 12명 · 내 옆 친구 14명의 설계도와 3D 만들기
// 방(building3d.js)과 마을(village/village.js)이 이 파일 하나를 같이 써요. 그래서 두 곳의 캐릭터 모습이 늘 같아요.
// 모양을 고치려면 여기만 고치면 돼요.
//   CH.look   : 캐릭터 느낌 (0 각진 복셀 · 2 반질 비닐) → 바꿀 때는 setLook(n)
//   CH.gender : 사장님이 여자('f')인지 남자('m')인지 알려 주는 함수 (부르는 쪽이 자기 설정을 이어 줘요)
//   makeChar(def) : 설계도로 3D 캐릭터 만들기 → { root, lift, head, armL, armR, legL, legR, groups }
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export const CH = { look: 0, gender: () => 'f' };
// 처음 설정: 방마다 직원 번호(assign) · 사장님 8번 베이지 재킷(여자) · 친구 11번 클로드 · 느낌 0 각진 복셀
// 고른 설정은 브라우저 'ailab3d' 와 Firebase ailab_meta/building 에 저장돼요 (방 화면 메뉴에서 바꿔요)
export const CHAR_DEFAULT = { assign: { train: 3, links: 3, moral: 1, others: 1, plans: 4, task: 4, lobby: 2, archive: 5, security: 3, aiedu: 11 }, me: 8, friend: 11, gender: 'f', look: 0 };

// ---------- 색 ----------
const P = {
  wall: '#efe4d3', wall2: '#e3d4bf', wallB1: '#cbbfae', slab: '#ddd2c2', edge: '#353c44', wood: '#c99a5c', woodD: '#8e6640',
  glass: '#bfe0ee', frame: '#f7f3ec', grass: '#9cc87a', dirt: '#9b7653', dirtD: '#7f5f42', trunk: '#8a5a35', leaf: '#6fae4f', leaf2: '#5c9a40',
  skin: '#e8925f', cap: '#62b0d0', gold: '#e3b23a', eye: '#2a2522', white: '#eef4f6', blush: '#f27a7a', shirt: '#2b7ea1', pants: '#2f3e5c',
  coat: '#f1f3f2', steel: '#a9b4bb', panel: '#14202a', glow: '#5fe0e6', red: '#e0693f', teal: '#2f9c8f', screen: '#26313a', monitor: '#7cc3e0',
  pot: '#c8693f', paper: '#fbfaf6', crate: '#c08a52', crateD: '#8f6337', belt: '#2f353b', metal: '#7d878f', book: ['#62b0d0', '#e0693f', '#2f9c8f', '#e3b23a', '#6e5ea0'],
};
const shade = (hex, k) => { const c = new THREE.Color(hex); return '#' + (k > 0 ? c.lerp(new THREE.Color('#ffffff'), k) : c.lerp(new THREE.Color('#000000'), -k)).getHexString(); };

// 상자 하나 = 같은 정육면체 모양을 늘려서 씁니다. 'holo:' · 'ghost:' 로 시작하는 색은 비치는 재질
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const mats = new Map();
function mat(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`;
  if (!mats.has(key)) {
    let m;
    if (color.startsWith('holo:')) m = new THREE.MeshStandardMaterial({ color: color.slice(5), emissive: color.slice(5), emissiveIntensity: .7, transparent: true, opacity: .55, depthWrite: false });
    else if (color.startsWith('ghost:')) m = new THREE.MeshStandardMaterial({ color: color.slice(6), roughness: .6, transparent: true, opacity: .82 });
    else m = new THREE.MeshStandardMaterial({ color, roughness: .85, metalness: 0, ...opts });
    mats.set(key, m);
  }
  return mats.get(key);
}
function B(parent, w, h, d, color, x, y, z, { shadow = true, m = null } = {}) {
  const mesh = new THREE.Mesh(UNIT, m || mat(color));
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow && !String(color).startsWith('holo:');
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// ---------- 캐릭터 설계 (복셀, 1칸 = 0.1, y는 아래로 +) ----------
const V = .1;
const group = (name, pivot, parts) => ({ group: name, pivot, parts });
const smile = [[1.5, 1.7, .8, 1.1, P.eye], [3.7, 1.7, .8, 1.1, P.eye], [1.3, 3.4, .6, .5, P.eye], [1.9, 3.9, 2.2, .5, P.eye], [4.1, 3.4, .6, .5, P.eye]];
// back: 등에 붙는 것, itemL / itemR: 손에 든 것(팔과 함께 움직여요)
function person({ head, headFront = smile, hat = [], torso, torsoFront = [], arm, hand = null, leg, back = [], itemL = [], itemR = [], under = [] }) {
  const limb = (x, c, name, items) => group(name, [x, -3.4, 0], [{ x, y: 0, w: 3.6, h: 8, d: 4, c }, ...(hand ? [{ x, y: 3.2, w: 3.65, h: 1.6, d: 4.05, c: hand }] : []), ...items]);
  return [
    group('head', [0, -4, 0], [{ y: -6.85, w: 6, h: 5.5, d: 5.5, c: head, front: headFront }, ...hat]),
    { w: 8, h: 8, d: 4, c: torso, front: torsoFront },
    ...back,
    limb(-5.85, arm, 'armL', itemL), limb(5.85, arm, 'armR', itemR),
    group('legL', [-2, 4, 0], [{ x: -2, y: 8.05, w: 3.95, h: 8, d: 4, c: leg }]),
    group('legR', [2, 4, 0], [{ x: 2, y: 8.05, w: 3.95, h: 8, d: 4, c: leg }]),
    ...under,
  ];
}
const smallCap = (c) => [{ y: -9.1, w: 6.4, h: 1.8, d: 6.4, c, front: [[2, .6, 2.4, .35, P.white]] }, { y: -8.4, z: 4.55, w: 6.4, h: .5, d: 2.8, c }];
const PERSON = { foot: 12.05, desk: .98 };

// --- 직원 10명. desk: 책상 높이, stool: 의자 높이(키가 작으면), sway: 팔 없이 몸을 돌리는 직원 ---
const STAFF = [
  { id: 1, name: '기본 직원', note: '모자 쓴 큐브', def: () => ({ foot: 4.5, desk: .36, stool: .34, sway: true, parts: [
    { w: 10, h: 9, d: 10, c: P.skin, front: [[2.5, 4.4, 1.3, 1.7, P.eye], [6.2, 4.4, 1.3, 1.7, P.eye]] },
    { x: -5.6, y: .8, w: 1.4, h: 2.4, d: 2, c: shade(P.skin, -.1) }, { x: 5.6, y: .8, w: 1.4, h: 2.4, d: 2, c: shade(P.skin, -.1) },
    { y: -4.7, w: 10.6, h: 3, d: 10.6, c: P.cap, front: [[3.3, 1.1, 4, .55, P.white]] },
    { y: -6.5, w: 1.4, h: .6, d: 1.4, c: shade(P.cap, -.12) },
    { y: -3.6, z: 7.5, w: 10.6, h: .8, d: 4.4, c: P.cap },
  ] }) },
  { id: 2, name: '블록 사람', note: '파란 티셔츠', def: () => ({ ...PERSON, parts: person({ head: P.skin, torso: P.shirt, arm: P.skin, leg: P.pants }) }) },
  { id: 3, name: '연구원', note: '흰 가운', def: () => ({ ...PERSON, parts: person({
    head: P.skin, hat: smallCap(P.cap), torso: P.coat, arm: P.coat, hand: P.skin, leg: P.pants,
    torsoFront: [[2.6, 0, 2.8, 3.4, P.shirt], [3.4, 0, 1.2, 1.4, P.white], [5.4, 3.2, 1.6, 1, P.red], [3.85, 3.6, .3, 4.4, shade(P.coat, -.12)]],
  }) }) },
  { id: 4, name: '꼬마 직원', note: '2등신', def: () => ({ foot: 5.4, desk: .5, parts: [
    { y: -6.5, w: 9, h: 8, d: 9, c: P.skin, front: [[2.2, 3.4, 1.2, 1.6, P.eye], [5.6, 3.4, 1.2, 1.6, P.eye], [1, 5.6, 1.6, .7, P.blush], [6.4, 5.6, 1.6, .7, P.blush]] },
    { y: -10.7, w: 9.6, h: 2.6, d: 9.6, c: P.cap, front: [[3, 1, 3.6, .5, P.white]] },
    { y: -9.75, z: 6.5, w: 9.6, h: .7, d: 3.8, c: P.cap },
    { w: 5.5, h: 4.5, d: 4, c: P.shirt, front: [[2.2, .3, 1.1, 1.2, P.white]] },
    group('armL', [-3.7, -1.8, 0], [{ x: -3.7, y: 0, w: 1.8, h: 4, d: 2.4, c: P.shirt }, { x: -3.7, y: 2.3, w: 1.6, h: 1, d: 2.2, c: P.skin }]),
    group('armR', [3.7, -1.8, 0], [{ x: 3.7, y: 0, w: 1.8, h: 4, d: 2.4, c: P.shirt }, { x: 3.7, y: 2.3, w: 1.6, h: 1, d: 2.2, c: P.skin }]),
    group('legL', [-1.3, 2.2, 0], [{ x: -1.3, y: 3.8, w: 2.4, h: 3.2, d: 2.8, c: P.pants }]),
    group('legR', [1.3, 2.2, 0], [{ x: 1.3, y: 3.8, w: 2.4, h: 3.2, d: 2.8, c: P.pants }]),
  ] }) },
  { id: 5, name: 'AI 로봇', note: '화면 얼굴', def: () => ({ ...PERSON, parts: person({
    head: P.steel, torso: P.teal, arm: P.steel, leg: shade(P.steel, -.18),
    headFront: [[.6, .8, 4.8, 3.8, P.panel], [1.5, 1.8, 1, 1.1, P.glow], [3.5, 1.8, 1, 1.1, P.glow], [2, 3.6, 2, .35, P.glow]],
    hat: [{ y: -10.4, w: .5, h: 1.6, d: .5, c: P.steel }, { y: -11.6, w: 1.1, h: 1.1, d: 1.1, c: P.red }],
    torsoFront: [[1.5, 1.4, 5, 3, P.panel], [2.2, 2.2, 1, 1, P.glow], [3.6, 2.2, 1, 1, P.red], [5, 2.2, .8, 1, P.gold]],
  }) }) },
  { id: 6, name: '부엉이 사서', note: '큰 눈, 귀깃', def: () => ({ foot: 5.7, desk: .5, parts: [
    { w: 8, h: 9, d: 7, c: '#9a6b45', front: [[1.5, 5.2, 5, 3.6, '#d9b98c'], [.9, 1, 2.8, 2.8, P.white], [4.3, 1, 2.8, 2.8, P.white], [1.8, 1.8, 1.2, 1.3, P.eye], [5.1, 1.8, 1.2, 1.3, P.eye], [3.5, 3.5, 1, 1.2, P.gold], [.6, .8, 6.8, .3, '#2a2522']] },
    { x: -3, y: -5.2, w: 1.5, h: 1.5, d: 1.5, c: '#7a5135' }, { x: 3, y: -5.2, w: 1.5, h: 1.5, d: 1.5, c: '#7a5135' },
    group('armL', [-4.2, -2, 0], [{ x: -4.6, y: 1, w: 1.2, h: 6, d: 5, c: '#7a5135' }]),
    group('armR', [4.2, -2, 0], [{ x: 4.6, y: 1, w: 1.2, h: 6, d: 5, c: '#7a5135' }]),
    group('legL', [-1.8, 4.5, 0], [{ x: -1.8, y: 5.1, w: 1.8, h: 1.2, d: 2.2, c: P.gold }]),
    group('legR', [1.8, 4.5, 0], [{ x: 1.8, y: 5.1, w: 1.8, h: 1.2, d: 2.2, c: P.gold }]),
  ] }) },
  { id: 7, name: '곰 직원', note: '조끼 입은 곰', def: () => ({ ...PERSON, parts: person({
    head: '#8a5a3a', headFront: [[1.4, 1.5, .8, 1.1, P.eye], [3.8, 1.5, .8, 1.1, P.eye], [1.9, 2.9, 2.2, 1.8, '#c99a6e'], [2.6, 3, .8, .6, P.eye]],
    hat: [{ x: -2.4, y: -9.9, w: 1.5, h: 1.3, d: 1, c: '#8a5a3a' }, { x: 2.4, y: -9.9, w: 1.5, h: 1.3, d: 1, c: '#8a5a3a' }],
    torso: '#3f8f6b', torsoFront: [[2.8, 0, 2.4, 8, P.coat], [3.6, 4, .8, .8, P.gold]], arm: P.coat, hand: '#8a5a3a', leg: '#5b3f2a',
  }) }) },
  { id: 8, name: '펭귄 직원', note: '나비넥타이', def: () => ({ foot: 4.8, desk: .4, stool: .16, parts: [
    { w: 7, h: 8, d: 6, c: '#2a2f38', front: [[1.2, 2.2, 4.6, 5.6, '#f4f6f7'], [1.6, 1.4, 1.1, 1.3, P.white], [4.3, 1.4, 1.1, 1.3, P.white], [2, 1.9, .6, .7, P.eye], [4.6, 1.9, .6, .7, P.eye], [2.8, 4.4, 1.4, .8, P.red]] },
    { y: -1.1, z: 3.5, w: 1.6, h: .9, d: 1.2, c: P.gold },
    group('armL', [-3.5, -2.5, 0], [{ x: -3.9, y: .3, w: .8, h: 5, d: 3, c: '#2a2f38' }]),
    group('armR', [3.5, -2.5, 0], [{ x: 3.9, y: .3, w: .8, h: 5, d: 3, c: '#2a2f38' }]),
    group('legL', [-1.5, 4, 0], [{ x: -1.5, y: 4.4, w: 1.8, h: .8, d: 2.6, c: P.gold }]),
    group('legR', [1.5, 4, 0], [{ x: 1.5, y: 4.4, w: 1.8, h: .8, d: 2.6, c: P.gold }]),
  ] }) },
  { id: 9, name: '홀로그램', note: '빛으로 된 직원', def: () => ({ foot: 12.75, desk: .98, parts: person({
    head: 'holo:#5fe0e6', headFront: [[1.5, 1.7, .8, 1.1, '#e8fbff'], [3.7, 1.7, .8, 1.1, '#e8fbff'], [1.9, 3.8, 2.2, .45, '#e8fbff']],
    torso: 'holo:#5fe0e6', torsoFront: [[3, 1.5, 2, 2, '#e8fbff']], arm: 'holo:#5fe0e6', leg: 'holo:#5fe0e6',
    under: [{ y: 12.4, w: 7, h: .7, d: 6, c: P.metal, front: [[1, .2, 5, .3, P.glow]] }],
  }) }) },
  { id: 10, name: '공룡 인턴', note: '꼬리 흔드는', def: () => ({ foot: 6.5, desk: .8, parts: [
    { w: 7, h: 7, d: 7, c: '#6dbb5a', front: [[1.5, 1.6, 4, 5, '#cfe8a8'], [2.6, .4, 1.8, 1, P.white]] },
    group('head', [0, -3.5, 1], [
      { y: -6.6, z: 1.6, w: 7, h: 6, d: 7.6, c: '#6dbb5a', front: [[1.3, 1.2, 1.1, 1.4, P.eye], [4.6, 1.2, 1.1, 1.4, P.eye], [.8, 4.5, .7, .6, P.white], [2.2, 4.5, .7, .6, P.white], [3.6, 4.5, .7, .6, P.white], [5, 4.5, .7, .6, P.white]] },
      { y: -10, z: -.5, w: 1.2, h: 1.2, d: 1.2, c: P.gold }, { y: -9.6, z: -2.4, w: 1, h: 1, d: 1, c: P.gold },
    ]),
    group('armL', [-3.5, -1.5, 2], [{ x: -3.9, y: .2, z: 2.8, w: 1, h: 2.6, d: 1, c: '#5aa549' }]),
    group('armR', [3.5, -1.5, 2], [{ x: 3.9, y: .2, z: 2.8, w: 1, h: 2.6, d: 1, c: '#5aa549' }]),
    group('legL', [-2, 3.5, 0], [{ x: -2, y: 5, w: 2.6, h: 3, d: 3.4, c: '#5aa549' }]),
    group('legR', [2, 3.5, 0], [{ x: 2, y: 5, w: 2.6, h: 3, d: 3.4, c: '#5aa549' }]),
    group('tail', [0, 1, -3.5], [{ y: 1.6, z: -5.4, w: 3, h: 2.4, d: 4, c: '#6dbb5a' }, { y: 2.4, z: -8, w: 1.8, h: 1.4, d: 2.4, c: '#6dbb5a' }, { y: .3, z: -5, w: .9, h: .9, d: .9, c: P.gold }]),
  ] }) },
  { id: 11, name: '레고 개발자', note: '큰 네모 머리 · 사각 안경 · 초록 니트', def: () => legoDev() },
  { id: 12, name: '클로드 짝꿍', note: '팔 벌린 주황 네모 일꾼', def: () => ({ foot: 5.9, desk: .5, parts: [
    { w: 7, h: 6.4, d: 6, c: '#e08a4c', front: [[1.8, 2, .9, 1.6, '#1a1a1a'], [4.3, 2, .9, 1.6, '#1a1a1a'], [2.9, 4.2, 1.2, .3, '#8a3b22']] },
    group('armL', [-3.5, -.5, 0], [{ x: -4.7, y: .6, w: 2.4, h: 1.6, d: 2.2, c: '#e08a4c' }]),
    group('armR', [3.5, -.5, 0], [{ x: 4.7, y: .6, w: 2.4, h: 1.6, d: 2.2, c: '#e08a4c' }]),
    group('legL', [-1.4, 3.2, 0], [{ x: -1.4, y: 4.6, w: 1.8, h: 2.6, d: 2, c: '#cf7a3e' }]),
    group('legR', [1.4, 3.2, 0], [{ x: 1.4, y: 4.6, w: 1.8, h: 2.6, d: 2, c: '#cf7a3e' }]),
  ] }) },
];
const staffById = (id) => STAFF.find((s) => s.id === id) || STAFF[0];

// --- 나 (지난번 시안 5개) ---
const HAIR = '#3a2a22';
const hairTop = (c = HAIR, extra = []) => [
  { y: -9.55, w: 6.3, h: 1.1, d: 5.9, c }, { y: -7.9, z: -2.65, w: 6.3, h: 3.2, d: .7, c },
  { x: -3.1, y: -8.3, w: .5, h: 1.6, d: 5, c }, { x: 3.1, y: -8.3, w: .5, h: 1.6, d: 5, c }, ...extra,
];
const face = (c = HAIR) => [[0, 0, 6, .7, c], [0, .7, 1.8, .5, c], ...smile];
// 사장님 여자 모습: 어깨까지 오는 긴 머리, 양쪽으로 나눈 앞머리, 빨간 머리핀
const hairLong = (c = HAIR, extra = []) => [
  { y: -9.55, w: 6.3, h: 1.1, d: 5.9, c }, { y: -6.5, z: -2.75, w: 6.5, h: 6.8, d: .9, c },
  { x: -3.15, y: -7.1, w: .6, h: 4.6, d: 5.2, c }, { x: 3.15, y: -7.1, w: .6, h: 4.6, d: 5.2, c },
  { x: -1.9, y: -9.75, z: 2.5, w: 1.1, h: .6, d: .5, c: P.red }, ...extra,
];
const faceLong = (c = HAIR) => [[0, 0, 6, .8, c], [0, .8, 1.3, .7, c], [4.7, .8, 1.3, .7, c], ...smile];
const meDef = (o) => {
  const f = CH.gender() === 'f';
  return { ...PERSON, parts: person({ head: P.skin, headFront: f ? faceLong() : face(), hand: P.skin, ...o, hat: (f ? hairLong : hairTop)(HAIR, o.hat || []) }) };
};
// 동그란 안경 쓴 얼굴 (안경테는 얇은 막대 네 개씩, 눈은 그 안에) · 곱슬머리 덩어리
const GLASSES = [
  [0, 0, 6, .7, HAIR],
  [.7, 1.3, 2, .28, '#1a1a1a'], [.7, 3, 2, .28, '#1a1a1a'], [.7, 1.3, .28, 2, '#1a1a1a'], [2.42, 1.3, .28, 2, '#1a1a1a'],
  [3.3, 1.3, 2, .28, '#1a1a1a'], [3.3, 3, 2, .28, '#1a1a1a'], [3.3, 1.3, .28, 2, '#1a1a1a'], [5.02, 1.3, .28, 2, '#1a1a1a'],
  [2.7, 1.8, .6, .22, '#1a1a1a'], [1.4, 1.9, .65, .8, P.eye], [4, 1.9, .65, .8, P.eye], [2.5, 4.2, 1, .5, '#7a3a2a'],
];
const CURLS = [
  { x: -2.2, y: -10.4, w: 1.8, h: 1, d: 1.8, c: HAIR }, { x: 0, y: -10.6, w: 2, h: 1.2, d: 2, c: HAIR }, { x: 2.2, y: -10.4, w: 1.8, h: 1, d: 1.8, c: HAIR },
  { x: -1.1, y: -10.3, z: -1.8, w: 2, h: 1, d: 1.8, c: HAIR }, { x: 1.3, y: -10.3, z: 1.6, w: 1.8, h: .9, d: 1.6, c: HAIR },
  { x: -3.4, y: -8.6, w: .9, h: 1.6, d: 3, c: HAIR }, { x: 3.4, y: -8.6, w: .9, h: 1.6, d: 3, c: HAIR },
];
// 레고처럼: 큰 네모 머리 · 층층이 쌓인 검은 머리와 삐죽 앞머리 · 굵은 초록빛 사각 안경 · 밝은 초록 니트에 어두운 세로줄 두 개
// 사장 6번이면서 직원 11번으로도 써요
function legoDev() {
  const SK = '#f1d9bd', G = '#46a86a', HR = '#1d1a19', F = '#2f4a3a';
  const parts = person({
    head: SK, torso: G, arm: G, hand: SK, leg: '#3a3f47',
    torsoFront: [[2.6, .6, .45, 3.2, '#2e6b45'], [4.95, .6, .45, 3.2, '#2e6b45'], [1.8, 0, 4.4, .7, shade(G, -.15)]],
    itemR: [{ x: 5.85, y: 4.7, z: 2.6, w: 4.8, h: .35, d: 1.8, c: '#d8dde2', front: [[.3, .05, 4.2, .25, '#9aa3ab']] }],
  });
  parts[0] = group('head', [0, -4, 0], [
    { y: -7.5, w: 7, h: 6.6, d: 6.4, c: SK, front: [
      [0, 0, 7, 1.1, HR], [.4, 1.1, 1.3, .7, HR], [2.9, 1.1, 1.5, .55, HR], [5.5, 1.1, 1.1, .75, HR],
      [.7, 2.2, 2.5, .45, F], [.7, 4.1, 2.5, .45, F], [.7, 2.2, .45, 2.35, F], [2.75, 2.2, .45, 2.35, F],
      [3.8, 2.2, 2.5, .45, F], [3.8, 4.1, 2.5, .45, F], [3.8, 2.2, .45, 2.35, F], [5.85, 2.2, .45, 2.35, F],
      [3.2, 2.9, .6, .3, F], [1.7, 3, .6, .85, P.eye], [4.8, 3, .6, .85, P.eye], [3, 5.4, 1, .3, '#a8644a'],
    ] },
    { y: -11.3, w: 7.6, h: 1.6, d: 7, c: HR }, { y: -12.4, w: 6.4, h: .9, d: 6, c: HR }, { x: -1.6, y: -13.1, w: 2.2, h: .7, d: 3, c: HR },
    { y: -8.6, z: -3.3, w: 7.6, h: 5.2, d: 1.2, c: HR },
    { x: -3.75, y: -9.4, w: .9, h: 3.2, d: 6.2, c: HR }, { x: 3.75, y: -9.4, w: .9, h: 3.2, d: 6.2, c: HR },
  ]);
  return { ...PERSON, parts };
}
// 사장 8번 (캡쳐 그대로): 큰 네모 얼굴 · 까만 점 눈 · 짧은 입 · 베이지 재킷(옷깃) 안에 검은 상의 · 검은 바지 · 네모 손
// 여자: 삼각형 면이 보이는 긴 갈색 웨이브 머리(어깨 아래까지) / 남자: 짧은 갈색 머리
function beigeBoss() {
  const SK = '#f3d6bf', J = '#d9c7ad', JD = shade('#d9c7ad', -.14), BK = '#1f1f22', HR = '#5b3a26', HR2 = '#6e4630';
  const female = CH.gender() === 'f';
  const parts = person({
    head: SK, torso: J, arm: J, hand: SK, leg: BK,
    torsoFront: [[2.3, 0, 3.4, 8, BK], [1.5, 0, .8, 3.8, JD], [5.7, 0, .8, 3.8, JD], [1.9, 3.8, .6, .6, JD], [5.5, 3.8, .6, .6, JD]],
  });
  const face = [[1.7, 3, .75, .85, '#141414'], [4.15, 3, .75, .85, '#141414'], [2.85, 4.75, 1, .22, '#9a5a44']];
  const hair = female
    ? [
      ...[[0, -11.2, -.4, 2.6], [-2.3, -10.8, .4, 2.1], [2.3, -10.6, .2, 2], [-3.7, -9, -.4, 1.9], [3.7, -9, -.6, 1.8], [0, -9.6, -3, 2.8],
        [-4, -6.6, -.8, 1.9], [4, -6.6, -1, 1.9], [-4.2, -4.4, -1.4, 1.8], [4.2, -4.4, -1.6, 1.7], [-3.8, -2.4, -1.8, 1.6], [3.9, -2.5, -1.9, 1.5],
        [0, -6.5, -3.4, 3], [-2.2, -3.6, -3.1, 2.2], [2.2, -3.6, -3.1, 2.2], [-1.8, -11.2, 2.3, 1.5]]
        .map(([x, y, z, r], i) => ({ geo: 'lump', r, x, y, z, c: i % 3 ? HR : HR2 })),
    ]
    : [
      { y: -10.9, w: 7, h: 1.5, d: 6.6, c: HR }, { y: -8.6, z: -3.1, w: 7, h: 3.8, d: 1, c: HR },
      { x: -3.45, y: -9.3, w: .8, h: 2, d: 5.6, c: HR }, { x: 3.45, y: -9.3, w: .8, h: 2, d: 5.6, c: HR }, { x: -1.4, y: -11.8, w: 2.6, h: .7, d: 3.2, c: HR2 },
    ];
  parts[0] = group('head', [0, -4, 0], [
    { y: -7.4, w: 6.6, h: 6.4, d: 6, c: SK, front: [...(female ? [[0, 0, 6.6, 1, HR], [0, 1, 2.4, .9, HR], [4.9, 1, 1.7, .5, HR]] : [[0, 0, 6.6, .9, HR], [0, .9, 1.4, .5, HR]]), ...face] },
    ...hair,
  ]);
  return { ...PERSON, parts };
}
const ME = [
  { id: 1, name: '도덕 선생님', hold: 'L', note: '초록 가디건에 교사 명찰, 하트 그려진 도덕 교과서', def: () => meDef({
    torso: '#4a9a74', arm: '#4a9a74', leg: '#c9b79a',
    torsoFront: [[2.9, 0, 2.2, 2.6, P.white], [3.85, 2.4, .3, 1.4, P.red], [3, 3.8, 2, 2.4, P.white], [3, 3.8, 2, .6, P.shirt]],
    itemL: [{ x: -5.85, y: 4.6, z: 2.7, w: 3, h: 3.8, d: .9, c: P.red, front: [[.9, 1.2, .5, .5, P.white], [1.6, 1.2, .5, .5, P.white], [1, 1.6, 1, .6, P.white], [1.25, 2.2, .5, .4, P.white]] }],
  }) },
  { id: 2, name: '앱 만드는 선생님', hold: 'R', note: '남색 후드티, 헤드셋, 노트북', def: () => meDef({
    torso: '#34476b', arm: '#34476b', leg: '#4b6a92',
    torsoFront: [[2.6, 0, .3, 2.4, P.white], [5.1, 0, .3, 2.4, P.white], [2, 4.6, 4, 2, shade('#34476b', -.15)]],
    back: [{ y: -4.4, z: -2.6, w: 6, h: 2, d: 1.4, c: '#34476b' }],
    hat: [{ y: -10, w: 6.9, h: .5, d: 1, c: P.belt }, { x: -3.35, y: -7.2, w: .8, h: 1.9, d: 1.9, c: P.belt }, { x: 3.35, y: -7.2, w: .8, h: 1.9, d: 1.9, c: P.belt }, { x: 3.1, y: -6, z: 1.8, w: .3, h: .3, d: 2.4, c: P.belt }],
    itemR: [{ x: 5.85, y: 4.5, z: 2.9, w: 4.6, h: .4, d: 3.2, c: P.steel }, { x: 5.85, y: 2.7, z: 1.4, w: 4.6, h: 3.2, d: .3, c: P.steel, front: [[2, 1.2, .7, .7, P.white]] }],
  }) },
  { id: 3, name: '타이쿤 사장님', hold: 'R', note: '정장, 금색 넥타이와 사장 배지, 커피 머그', def: () => meDef({
    torso: '#2f3e5c', arm: '#2f3e5c', leg: '#26324a',
    torsoFront: [[2.8, 0, 2.4, 3, P.white], [3.6, .4, .8, 3.8, P.gold], [.9, 1.2, 1.1, .7, P.gold]],
    itemR: [{ x: 5.85, y: 4.9, z: 2.5, w: 1.9, h: 2.1, d: 1.9, c: P.paper, front: [[.4, .8, 1.1, .4, P.red]] }, { x: 7.05, y: 4.9, z: 2.5, w: .5, h: 1.2, d: .4, c: P.paper }],
  }) },
  { id: 4, name: '연수 듣는 선생님', hold: 'R', note: '하늘색 셔츠, 빨간 배낭, 이수증', def: () => meDef({
    torso: '#9cc3e0', arm: '#9cc3e0', leg: '#3a4a5e',
    torsoFront: [[1.4, 0, .7, 5, P.red], [5.9, 0, .7, 5, P.red], [3.7, 0, .3, 3, P.shirt], [3.2, 3, 1.4, 1.8, P.white]],
    back: [{ y: -.4, z: -3, w: 6, h: 6.4, d: 2, c: P.red }, { y: 1.6, z: -4.1, w: 4, h: 2.2, d: .3, c: shade(P.red, -.15) }],
    itemR: [{ x: 5.85, y: 4.6, z: 2.4, w: 3.4, h: 2.6, d: .2, c: P.paper, front: [[.3, .3, 2.8, .4, P.gold], [.3, 1, 2, .25, '#9aabb6'], [.3, 1.5, 1.6, .25, '#9aabb6'], [2.4, 1.6, .7, .7, P.red]] }],
  }) },
  { id: 6, name: '초록 니트 개발자', hold: 'R', note: '레고처럼 큰 네모 머리, 층층 검은 머리, 굵은 사각 안경, 초록 니트, 키보드', def: legoDev },
  { id: 7, name: '초록 후드 사장님', hold: 'R', note: '삼각형 면으로 만든 둥근 얼굴, 곱슬머리, 동그란 안경, 끈 달린 초록 후드, 녹음기', def: () => {
    const SK = '#ecd9bf', G = '#2f6b4b', HR = '#2a221e';
    const parts = person({
      head: SK, torso: G, arm: G, leg: '#2a2f38',
      torsoFront: [[2.5, .3, .4, 3.2, '#e9e4da'], [5.1, .3, .4, 3.2, '#e9e4da']],
      back: [{ y: -4.4, z: -2.5, w: 7, h: 2.2, d: 1.6, c: shade(G, -.12) }],
      itemL: [{ geo: 'ball', r: 1.6, x: -5.85, y: 4.6, c: SK }],
      itemR: [{ geo: 'ball', r: 1.6, x: 5.85, y: 4.6, c: SK }, { x: 5.85, y: 5.2, z: 1.8, w: 1.4, h: 2.2, d: .5, c: '#2a2f38', front: [[.3, .3, .8, .5, P.red]] }],
    });
    parts[0] = group('head', [0, -4, 0], [
      { geo: 'ico', r: 4.4, y: -7.9, c: SK }, // 삼각형 면이 보이는 둥근 얼굴
      { geo: 'ball', r: 1.1, x: -4.3, y: -7.5, c: SK }, { geo: 'ball', r: 1.1, x: 4.3, y: -7.5, c: SK },
      ...[[0, -11.6, -.6, 2.7], [-2.7, -11, 0, 2.2], [2.7, -11, 0, 2.2], [-3.8, -9.2, -1.1, 1.9], [3.8, -9.2, -1.1, 1.9], [0, -10.2, -2.9, 2.7], [-1.5, -11.2, 1.9, 1.7], [1.6, -11.1, 2, 1.6], [-3.4, -7, -2.2, 1.6], [3.4, -7, -2.2, 1.6]]
        .map(([x, y, z, r]) => ({ geo: 'lump', r, x, y, z, c: HR })),
      { geo: 'ring', r: 1.3, x: -1.6, y: -8.6, z: 4.1, c: '#141414' }, { geo: 'ring', r: 1.3, x: 1.6, y: -8.6, z: 4.1, c: '#141414' },
      { x: 0, y: -8.7, z: 4.3, w: .9, h: .25, d: .25, c: '#141414' },
      { geo: 'ball', r: .8, x: -1.6, y: -8.6, z: 3.7, c: '#6b7888', shiny: true }, { geo: 'ball', r: .8, x: 1.6, y: -8.6, z: 3.7, c: '#6b7888', shiny: true },
      { geo: 'ball', r: .26, x: -1.35, y: -8.95, z: 4.45, c: '#ffffff' }, { geo: 'ball', r: .26, x: 1.85, y: -8.95, z: 4.45, c: '#ffffff' },
      { geo: 'cone', r: .45, x: 0, y: -7.5, z: 4.45, rx: Math.PI / 2, c: SK },
      { geo: 'ball', sx: .75, sy: .55, sz: .3, x: 0, y: -6.3, z: 4.1, c: '#3a1f1a' },
    ]);
    return { ...PERSON, parts };
  } },
  { id: 8, name: '베이지 재킷 사장님', hold: 'R', note: '큰 네모 얼굴, 긴 갈색 웨이브 머리(남자는 짧은 머리), 베이지 재킷 · 검은 상의 · 검은 바지', def: beigeBoss },
  { id: 5, name: '시안 고르는 기획자', hold: 'R', note: '줄무늬 셔츠, 귀에 꽂은 연필, 색깔 시안 카드 다섯 장', def: () => meDef({
    torso: '#f4f1ea', arm: '#f4f1ea', leg: '#3a4a5e',
    torsoFront: [[0, .8, 8, .7, P.shirt], [0, 2.8, 8, .7, P.shirt], [0, 4.8, 8, .7, P.shirt], [0, 6.8, 8, .7, P.shirt]],
    hat: [{ x: 3.25, y: -7.6, z: .3, w: .45, h: .45, d: 3.6, c: P.gold }, { x: 3.25, y: -7.6, z: 2.25, w: .45, h: .45, d: .5, c: P.eye }],
    itemR: ['#62b0d0', '#e0693f', '#2f9c8f', '#e3b23a', '#6e5ea0'].map((c, i) => ({ x: 5.85 + (i - 2) * .95, y: 4.3 + Math.abs(i - 2) * .35, z: 2.4 + i * .06, w: 1.7, h: 2.4, d: .1, c })),
  }) },
];

// --- 내 옆 친구 10명. move: float(떠 있기) · pet(바닥에 앉기) · hop(깡총), lift: 바닥에서 띄우는 높이 ---
const FRIENDS = [
  { id: 1, name: 'AI 짝꿍', note: '화면 얼굴 로봇', move: 'float', lift: 1.45, def: () => ({ foot: 2.2, parts: [
    { w: 5, h: 4.4, d: 4.4, c: P.white, front: [[.5, .6, 4, 3.2, P.panel], [1.2, 1.4, .8, 1, P.glow], [3, 1.4, .8, 1, P.glow], [1.6, 2.8, 1.8, .3, P.glow]] },
    { y: -3, w: .4, h: 1.6, d: .4, c: P.metal }, { y: -4.1, w: .9, h: .9, d: .9, c: P.cap },
    { x: -2.8, w: .6, h: 1.6, d: 1.6, c: P.cap }, { x: 2.8, w: .6, h: 1.6, d: 1.6, c: P.cap },
  ] }) },
  { id: 2, name: '강아지', note: '꼬리를 흔들어요', move: 'pet', lift: 0, def: () => ({ foot: 2.7, parts: [
    { w: 4, h: 3.6, d: 4.6, c: '#f1e3c8', front: [[0, 0, 4, .6, P.red], [1.6, .5, .8, .8, P.gold]] },
    group('head', [0, -1.8, 1.5], [
      { y: -3.8, z: 1.6, w: 4, h: 3.4, d: 3.6, c: '#f1e3c8', front: [[.8, .9, .7, .9, P.eye], [2.5, .9, .7, .9, P.eye]] },
      { y: -3, z: 3.9, w: 2, h: 1.4, d: 1, c: '#fff7ea', front: [[.5, .1, 1, .6, P.eye], [.7, .9, .6, .5, P.blush]] },
      { x: -2.2, y: -3.6, z: 1.4, w: .8, h: 2.4, d: 1.8, c: '#c48a52' }, { x: 2.2, y: -3.6, z: 1.4, w: .8, h: 2.4, d: 1.8, c: '#c48a52' },
    ]),
    { x: -1.1, y: 1.9, z: 1.8, w: 1, h: 1.6, d: 1, c: '#f1e3c8' }, { x: 1.1, y: 1.9, z: 1.8, w: 1, h: 1.6, d: 1, c: '#f1e3c8' },
    group('wag', [0, .5, -2.3], [{ y: -.7, z: -2.7, w: .7, h: 2.4, d: .7, c: '#c48a52' }]),
  ] }) },
  { id: 3, name: '햄스터', note: '볼 빵빵, 해바라기씨', move: 'hop', lift: 0, def: () => ({ foot: 4.6, parts: [
    { y: 3.6, w: 4.4, h: 2, d: 4.4, c: P.cap, front: [[0, .7, 4.4, .3, P.white]] },
    { y: 1.5, w: 4, h: 2.2, d: 4, c: P.red, front: [[0, .9, 4, .3, P.white]] },
    { y: -1.2, w: 3.4, h: 3, d: 3.6, c: '#e8b77a', front: [[.7, .8, .5, .6, P.eye], [2.2, .8, .5, .6, P.eye], [1.45, 1.4, .5, .4, P.blush], [-.1, 1.4, .9, .8, '#f7d4a8'], [2.6, 1.4, .9, .8, '#f7d4a8']] },
    { x: -1.1, y: -3, w: .8, h: .8, d: .5, c: '#d89a5a' }, { x: 1.1, y: -3, w: .8, h: .8, d: .5, c: '#d89a5a' },
    { y: -.4, z: 2.1, w: .7, h: 1.1, d: .5, c: '#3a2a22' },
  ] }) },
  { id: 4, name: '화분 친구', note: '꽃이 살랑살랑', move: 'pet', lift: 0, def: () => ({ foot: 3, parts: [
    { y: 1.5, w: 3.6, h: 3, d: 3.6, c: P.pot, front: [[.8, .7, .6, .7, P.eye], [2.2, .7, .6, .7, P.eye], [1.2, 1.7, 1.2, .35, P.eye], [.3, 1.4, .6, .4, P.blush], [2.7, 1.4, .6, .4, P.blush]] },
    { y: -.1, w: 3.4, h: .3, d: 3.4, c: '#6b4a33' },
    group('leaves', [0, 0, 0], [
      { y: -1.6, w: .6, h: 3.2, d: .6, c: P.leaf2 }, { x: -1.4, y: -2.2, w: 2.2, h: .6, d: 1.4, c: P.leaf }, { x: 1.4, y: -3, w: 2.2, h: .6, d: 1.4, c: P.leaf },
      { y: -4.2, w: 1.8, h: 1.8, d: 1.8, c: P.blush }, { y: -4.2, z: .95, w: .8, h: .8, d: .1, c: P.gold },
    ]),
  ] }) },
  { id: 5, name: '드론', note: '프로펠러가 쌩쌩', move: 'float', lift: 1.75, def: () => ({ foot: 1, parts: [
    { w: 3.6, h: 1.4, d: 3.6, c: P.white, front: [[.8, .3, 2, .8, P.panel], [1.4, .45, .8, .5, P.glow]] },
    { y: -.5, w: 7.4, h: .35, d: .5, c: P.metal }, { y: -.5, w: .5, h: .35, d: 7.4, c: P.metal },
    ...[[-3.4, 0], [3.4, 0], [0, -3.4], [0, 3.4]].flatMap(([x, z]) => [
      { x, y: -.9, z, w: .5, h: .6, d: .5, c: P.belt },
      group('prop', [x, -1.3, z], [{ x, y: -1.3, z, w: 2.6, h: .12, d: .45, c: P.red }]),
    ]),
  ] }) },
  { id: 6, name: '토끼', note: '귀가 쫑긋', move: 'hop', lift: 0, def: () => ({ foot: 1.9, parts: [
    { w: 4, h: 3.4, d: 4.4, c: '#f4f1ea', front: [[1.4, .8, 1.2, 1.6, '#ffffff']] },
    { y: -3, z: .8, w: 3.6, h: 3, d: 3.2, c: '#f4f1ea', front: [[.7, .9, .6, .8, P.eye], [2.3, .9, .6, .8, P.eye], [1.45, 1.8, .7, .4, P.blush], [.2, 1.9, .6, .4, P.blush], [2.8, 1.9, .6, .4, P.blush]] },
    group('ear', [0, -4.5, .6], [
      { x: -.8, y: -6.3, z: .6, w: .9, h: 3.6, d: .6, c: '#f4f1ea', front: [[.2, .4, .5, 2.6, P.blush]] },
      { x: .8, y: -6.3, z: .6, w: .9, h: 3.6, d: .6, c: '#f4f1ea', front: [[.2, .4, .5, 2.6, P.blush]] },
    ]),
    { y: .5, z: -2.5, w: 1.2, h: 1.2, d: 1, c: '#ffffff' },
  ] }) },
  { id: 7, name: '커피잔', note: '김이 모락모락', move: 'pet', lift: 0, def: () => ({ foot: 9.3, parts: [
    { y: 2.4, w: 5.4, h: .6, d: 5.4, c: P.wood }, { y: 6, w: 1, h: 6.6, d: 1, c: P.woodD }, { y: 9, w: 3.4, h: .6, d: 3.4, c: P.woodD },
    { w: 4, h: 4.2, d: 4, c: P.paper, front: [[.9, 1.2, .6, .8, P.eye], [2.5, 1.2, .6, .8, P.eye], [1.3, 2.4, 1.4, .35, P.eye], [.3, 2, .6, .4, P.blush], [3.1, 2, .6, .4, P.blush]] },
    { y: -1.95, w: 3.4, h: .4, d: 3.4, c: '#6b4226' },
    { x: 2.4, w: .8, h: 2.4, d: .8, c: P.paper },
    group('steam', [0, -2, 0], [
      { x: -.7, y: -3.2, w: .5, h: .8, d: .5, c: '#ffffff' }, { x: .5, y: -3.9, w: .5, h: .8, d: .5, c: '#ffffff' }, { x: -.1, y: -4.6, w: .5, h: .8, d: .5, c: '#ffffff' },
    ]),
  ] }) },
  { id: 8, name: '책 친구', note: '책장을 펄럭', move: 'float', lift: 1.2, def: () => ({ foot: 2.4, parts: [
    { w: .5, h: 4.8, d: .6, c: P.red },
    group('flapL', [0, 0, 0], [{ x: -1.9, z: -.1, w: 3.8, h: 4.8, d: .3, c: P.red }, { x: -1.8, z: .15, w: 3.5, h: 4.5, d: .2, c: P.paper, front: [[1.4, 1.2, .7, .9, P.eye], [.4, 2.8, 2.6, .25, '#9aabb6'], [.4, 3.4, 2, .25, '#9aabb6']] }]),
    group('flapR', [0, 0, 0], [{ x: 1.9, z: -.1, w: 3.8, h: 4.8, d: .3, c: P.red }, { x: 1.8, z: .15, w: 3.5, h: 4.5, d: .2, c: P.paper, front: [[1.4, 1.2, .7, .9, P.eye], [.4, 2.8, 2.6, .25, '#9aabb6'], [.4, 3.4, 2, .25, '#9aabb6']] }]),
  ] }) },
  { id: 9, name: '꼬마 유령', note: '살짝 비쳐요', move: 'float', lift: 1.3, def: () => ({ foot: 3, parts: [
    { w: 4.6, h: 5, d: 4.4, c: 'ghost:#f7fafb', front: [[1, 1.4, .8, 1.2, P.eye], [2.8, 1.4, .8, 1.2, P.eye], [1.9, 3, .8, .8, P.eye], [.3, 2.7, .7, .4, P.blush], [3.6, 2.7, .7, .4, P.blush]] },
    { y: -3, w: 3.4, h: 1.2, d: 3.2, c: 'ghost:#f7fafb' },
    { x: -1.6, y: 3, w: 1.2, h: 1, d: 4.2, c: 'ghost:#f7fafb' }, { x: 0, y: 3.2, w: 1.2, h: 1.4, d: 4.2, c: 'ghost:#f7fafb' }, { x: 1.6, y: 3, w: 1.2, h: 1, d: 4.2, c: 'ghost:#f7fafb' },
    group('flapL', [-2.3, 0, 0], [{ x: -2.8, y: .4, w: 1, h: 1.6, d: 1.4, c: 'ghost:#f7fafb' }]),
    group('flapR', [2.3, 0, 0], [{ x: 2.8, y: .4, w: 1, h: 1.6, d: 1.4, c: 'ghost:#f7fafb' }]),
  ] }) },
  { id: 10, name: '꼬마 로켓', note: '불꽃이 일렁', move: 'float', lift: 1.5, def: () => ({ foot: 4.6, parts: [
    { w: 2.8, h: 5, d: 2.8, c: P.white, front: [[.5, 1, 1.8, 1.8, P.cap], [.8, 1.5, .4, .6, P.eye], [1.6, 1.5, .4, .6, P.eye], [0, 3.6, 2.8, .5, P.red]] },
    { y: -3.1, w: 2, h: 1.2, d: 2, c: P.red }, { y: -4, w: 1, h: .7, d: 1, c: P.red },
    { x: -1.8, y: 1.8, w: .8, h: 2, d: 1.6, c: P.red }, { x: 1.8, y: 1.8, w: .8, h: 2, d: 1.6, c: P.red },
    group('flame', [0, 2.5, 0], [{ y: 3.2, w: 1.5, h: 1.4, d: 1.5, c: P.gold }, { y: 4.2, w: .8, h: 1, d: .8, c: P.red }]),
  ] }) },
  // 클로드: 주황 네모 몸통에 세로로 긴 눈 두 개 (11번은 다리 넷, 12번은 팔 · 입 · 짧은 다리 둘)
  { id: 11, name: '클로드', note: '주황 네모, 다리 넷', move: 'hop', lift: 0, def: () => ({ foot: 5.4, parts: [
    { w: 8, h: 6, d: 6, c: '#d97757', front: [[2.2, 1.6, .9, 2, '#1a1a1a'], [4.9, 1.6, .9, 2, '#1a1a1a']] },
    { x: -4.6, y: .5, w: 1.4, h: 1.6, d: 2.4, c: '#c96a4b' }, { x: 4.6, y: .5, w: 1.4, h: 1.6, d: 2.4, c: '#c96a4b' },
    ...[-2.8, -1, 1, 2.8].map((x) => ({ x, y: 4.2, w: 1.1, h: 2.4, d: 1.4, c: '#c96a4b' })),
  ] }) },
  // 아이스커피: 투명 컵 · 커피 · 우유층 · 얼음 가득 · 초록 빨대 (7번 따뜻한 커피잔과 같은 작은 탁자 위)
  { id: 13, name: '아이스커피', note: '얼음 가득, 초록 빨대', move: 'pet', lift: 0, def: () => ({ foot: 9.3, parts: [
    { y: 2.4, w: 5.4, h: .6, d: 5.4, c: P.wood }, { y: 6, w: 1, h: 6.6, d: 1, c: P.woodD }, { y: 9, w: 3.4, h: .6, d: 3.4, c: P.woodD },
    { y: .4, w: 3.6, h: 3.4, d: 3.6, c: '#6b4226' }, { y: -1.6, w: 3.6, h: .8, d: 3.6, c: '#c99a6b' },
    group('ice', [0, -3, 0], [
      { x: -.9, y: -2.6, z: .6, w: 1.3, h: 1.3, d: 1.3, c: 'ghost:#ffffff' }, { x: .8, y: -2.9, z: -.5, w: 1.3, h: 1.3, d: 1.3, c: 'ghost:#ffffff' },
      { x: -.6, y: -3.4, z: -.9, w: 1.2, h: 1.2, d: 1.2, c: 'ghost:#ffffff' }, { x: .9, y: -2.5, z: .9, w: 1.1, h: 1.1, d: 1.1, c: 'ghost:#ffffff' },
      { x: 0, y: -3.6, z: .1, w: 1.2, h: 1.2, d: 1.2, c: 'ghost:#ffffff' }, { x: -1.1, y: -3.9, z: .2, w: 1, h: 1, d: 1, c: 'ghost:#ffffff' },
    ]),
    { y: -1, w: 4.2, h: 6.2, d: 4.2, c: 'ghost:#e8f6fb', front: [[1.1, 2.4, .6, .8, P.eye], [2.5, 2.4, .6, .8, P.eye], [1.5, 3.5, 1.2, .35, P.eye], [.4, 3.1, .6, .4, P.blush], [3.2, 3.1, .6, .4, P.blush]] },
    { x: 1, y: -5.4, w: .45, h: 5.2, d: .45, c: '#3fa564' }, { x: 1.55, y: -7.9, w: 1.4, h: .45, d: .45, c: '#3fa564' },
  ] }) },
  // 뻐끔이: 동글동글 하늘색 물고기 친구 (삼각형 면 로우폴리). 꼬리를 살랑, 머리 위로 물방울이 뽀글뽀글
  { id: 14, name: '뻐끔이', note: '동글동글 하늘색 물고기', move: 'hop', lift: 0, def: () => ({ foot: .5, parts: [
    { geo: 'ico', r: 3.2, y: -3.3, c: '#7fc4d6' },
    { geo: 'ico', sx: 2.2, sy: 2, sz: 1, y: -2.5, z: 2.5, c: '#e9f6f8' },
    { geo: 'ball', r: .95, x: -1.3, y: -4.5, z: 2.5, c: '#ffffff' }, { geo: 'ball', r: .95, x: 1.3, y: -4.5, z: 2.5, c: '#ffffff' },
    { geo: 'ball', r: .48, x: -1.25, y: -4.45, z: 3.3, c: '#1a1a1a', shiny: true }, { geo: 'ball', r: .48, x: 1.25, y: -4.45, z: 3.3, c: '#1a1a1a', shiny: true },
    { geo: 'ball', sx: 1.1, sy: .6, sz: .6, y: -3.1, z: 3.1, c: '#f2a1a8' },
    { geo: 'ball', r: .38, x: -2.2, y: -3.4, z: 2.3, c: '#f6b3bd' }, { geo: 'ball', r: .38, x: 2.2, y: -3.4, z: 2.3, c: '#f6b3bd' },
    { geo: 'cone', r: .9, y: -6.7, z: -.3, c: '#4fa3bd' },
    { geo: 'ball', sx: .4, sy: 1.1, sz: .9, x: -3.3, y: -2.8, c: '#4fa3bd' }, { geo: 'ball', sx: .4, sy: 1.1, sz: .9, x: 3.3, y: -2.8, c: '#4fa3bd' },
    group('tail', [0, -3.2, -2.8], [{ geo: 'cone', r: 1.2, y: -3.2, z: -3.8, rx: -Math.PI / 2, c: '#4fa3bd' }]),
    { geo: 'ball', r: .6, x: -1.2, y: -.1, z: .6, c: '#4fa3bd' }, { geo: 'ball', r: .6, x: 1.2, y: -.1, z: .6, c: '#4fa3bd' },
    group('steam', [0, -7.5, 0], [
      { geo: 'ball', r: .35, x: .8, y: -7.8, z: .6, c: 'ghost:#dff4fb' }, { geo: 'ball', r: .28, x: 1.3, y: -8.6, z: .7, c: 'ghost:#dff4fb' }, { geo: 'ball', r: .22, x: .9, y: -9.3, z: .6, c: 'ghost:#dff4fb' },
    ]),
  ] }) },
];
const friendById = (id) => FRIENDS.find((f) => f.id === id) || FRIENDS[0];

// 둥근 모양 조각 (삼각형 면이 보이는 로우폴리): ico 둥근 공 · ball 각진 작은 공 · lump 머리카락 덩어리 · ring 안경테 · cone 코
const GEO = new Map();
const geoOf = (k) => {
  if (!GEO.has(k)) GEO.set(k, { ico: () => new THREE.IcosahedronGeometry(1, 1), ball: () => new THREE.IcosahedronGeometry(1, 0), smooth: () => new THREE.IcosahedronGeometry(1, 4), lump: () => new THREE.DodecahedronGeometry(1, 0), ring: () => new THREE.TorusGeometry(1, .16, 6, 16), cone: () => new THREE.ConeGeometry(1, 1.6, 5) }[k]());
  return GEO.get(k);
};

// --- 느낌 시안: 모양은 그대로, 모서리를 둥글리고 재질만 바꿔요 (말랑 클레이 · 반질 비닐 · 파스텔 만화) ---
const LOOKS = { 1: { r: .42, pastel: .18, glow: .3 }, 2: { r: .34, pastel: .08, glow: .2 }, 3: { r: .24, pastel: .3, glow: .22 } }; // glow: 방이 어두워도 캐릭터가 밝게
const roundGeos = new Map();
// 크기마다 둥근 상자를 만들어 둬요 (늘려 쓰면 모서리가 찌그러져서). 아주 얇은 조각(눈 · 입)은 각진 그대로
function roundGeo(w, h, d) {
  const min = Math.min(w, h, d);
  if (min < .03) return null;
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
  if (roundGeos.has(key)) return roundGeos.get(key);
  const r = min * LOOKS[CH.look].r, g = new THREE.BoxGeometry(w, h, d, 6, 6, 6);
  const p = g.attributes.position, nrm = g.attributes.normal;
  const lim = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r), neg = lim.clone().negate(), v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.copy(v).clamp(neg, lim);
    v.sub(c);
    if (v.lengthSq() > 1e-12) { v.normalize(); nrm.setXYZ(i, v.x, v.y, v.z); v.multiplyScalar(r); }
    v.add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  roundGeos.set(key, g);
  return g;
}
let toonGrad = null;
const charMats = new Map();
function charMat(color) {
  if (!CH.look || /^(holo|ghost):/.test(color)) return null;
  if (!charMats.has(color)) {
    const base = new THREE.Color(color), hsl = base.getHSL({});
    const c = hsl.l < .2 ? base : base.clone().lerp(new THREE.Color('#ffffff'), LOOKS[CH.look].pastel); // 눈 · 입 같은 어두운 색은 그대로
    const glow = LOOKS[CH.look].glow;
    let m;
    if (CH.look === 1) m = new THREE.MeshStandardMaterial({ color: c, roughness: .95, emissive: c, emissiveIntensity: glow });
    else if (CH.look === 2) m = new THREE.MeshPhysicalMaterial({ color: c, roughness: .35, clearcoat: 1, clearcoatRoughness: .18, sheen: .4, emissive: c, emissiveIntensity: glow });
    else {
      if (!toonGrad) {
        toonGrad = new THREE.DataTexture(new Uint8Array([150, 215, 255]), 3, 1, THREE.RedFormat);
        toonGrad.minFilter = toonGrad.magFilter = THREE.NearestFilter;
        toonGrad.needsUpdate = true;
      }
      m = new THREE.MeshToonMaterial({ color: c, gradientMap: toonGrad, emissive: c, emissiveIntensity: glow });
    }
    charMats.set(color, m);
  }
  return charMats.get(color);
}
function charBox(into, w, h, d, c, x, y, z) {
  const geo = CH.look ? roundGeo(w, h, d) : null, m = charMat(c);
  if (!geo) return B(into, w, h, d, c, x, y, z, { m });
  const mesh = new THREE.Mesh(geo, m || mat(c));
  mesh.position.set(x, y, z);
  mesh.castShadow = !String(c).startsWith('holo:');
  mesh.receiveShadow = true;
  into.add(mesh);
  return mesh;
}
function buildParts(parts, into, origin, named, groups) {
  const [ox, oy, oz] = origin;
  for (const p of parts) {
    if (p.geo) { // { geo, r (또는 sx · sy · sz), x, y, z, c, rx · ry · rz, shiny }
      const { x = 0, y = 0, z = 0, r = 1 } = p;
      const round = CH.look && (p.geo === 'ico' || p.geo === 'ball');
      const m = new THREE.Mesh(geoOf(round ? 'smooth' : p.geo), charMat(p.c) || mat(p.c, p.shiny ? { flatShading: true, roughness: .15, metalness: .15 } : { flatShading: true }));
      m.scale.set((p.sx ?? r) * V, (p.sy ?? r) * V, (p.sz ?? r) * V);
      m.position.set((x - ox) * V, -(y - oy) * V, (z - oz) * V);
      m.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
      m.castShadow = true; m.receiveShadow = true;
      into.add(m);
      continue;
    }
    if (p.group) {
      const g = new THREE.Group();
      const [px, py, pz] = p.pivot;
      g.position.set((px - ox) * V, -(py - oy) * V, (pz - oz) * V);
      named[p.group] = g;
      groups.push({ name: p.group, g });
      buildParts(p.parts, g, p.pivot, named, groups);
      into.add(g);
      continue;
    }
    const { x = 0, y = 0, z = 0, w, h, d, c, front = [] } = p;
    charBox(into, w * V, h * V, d * V, c, (x - ox) * V, -(y - oy) * V, (z - oz) * V);
    for (const [l, t, mw, mh, mc] of front) {
      const cx = x - w / 2 + l + mw / 2, cy = y - h / 2 + t + mh / 2;
      B(into, mw * V, mh * V, .12 * V, mc, (cx - ox) * V, -(cy - oy) * V, (z + d / 2 + .06 - oz) * V, { shadow: false, m: charMat(mc) });
    }
  }
}
function makeChar(def) {
  const root = new THREE.Group();
  const lift = new THREE.Group();
  const named = {}, groups = [];
  buildParts(def.parts, lift, [0, def.foot, 0], named, groups);
  root.add(lift);
  return { root, lift, groups, ...named, sway: !!def.sway };
}

// 느낌이 바뀌면 모아 둔 둥근 상자 · 재질을 비워요 (바뀌었으면 true)
function setLook(n) {
  const want = n === 1 || n === 2 || n === 3 ? n : 0;
  if (CH.look === want) return false;
  CH.look = want;
  charMats.clear();
  roundGeos.forEach((g) => g.dispose());
  roundGeos.clear();
  return true;
}
const meById = (id) => ME.find((m) => m.id === id) || ME[0];

export {
  P, shade, UNIT, mat, B, V, group, smile, person, smallCap, PERSON, STAFF, staffById,
  HAIR, hairTop, face, hairLong, faceLong, meDef, GLASSES, CURLS, legoDev, beigeBoss, ME, meById, FRIENDS, friendById,
  geoOf, LOOKS, charMat, charBox, buildParts, makeChar, setLook,
};