// 첫 화면 건물 겉모양 5가지 (2026-10-29): 둥근 지붕 도서관 · 사장님 저택 · 섬 리조트 · 작은 마을 · 나무 위 연구소
// building3d.js 가 건물 시안 8~12번에서 불러요. 건물 전체 보기에서만 이 모형을 보여 주고,
// 방에 들어가면(층 화면) 지금처럼 상자 건물 속 방을 보여 줘요.
//
// buildForm(kind, g, { mat, glass }) → slots
//   g     : 모형을 넣을 그룹 (building3d 가 크기를 키워요)
//   mat   : 색 → 재질 (building3d 와 같은 재질을 나눠 써요)
//   glass : 창문 재질 (밤에 불이 켜지게 building3d 가 모아 둬요)
//   slots : [{ key, area, box: [x, y, z, w, h, d] }] — key 가 있으면 그 방 자리(사장실 · 접수처 · 보관실 · 보안실),
//           없으면 area 층(rooms.js 의 2F · 1F)의 방이 먼저 들어가요. 그래서 같은 층 방은 겉모양에서도 한 구역에 모여요
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// 모양마다 층 이름: [엘리베이터 단추에 쓰는 한 글자, 이름] (rooms.js 의 PH · 2F · 1F · B1 자리)
export const FORM_AREAS = {
  library: { PH: ['탑', '등탑'], '2F': ['동', '동쪽 날개'], '1F': ['서', '서쪽 날개 · 둥근 홀'], B1: ['지', '지하 서고 · 문지기'] },
  manor: { PH: ['다', '다락방'], '2F': ['2', '본채 2층 · 별채'], '1F': ['1', '본채 1층 · 정원'], B1: ['창', '정원 창고 · 대문'] },
  resort: { PH: ['라', '라운지'], '2F': ['동', '동쪽 방갈로'], '1F': ['서', '서쪽 방갈로 · 선착장'], B1: ['등', '섬 창고 · 등대'] },
  village: { PH: ['탑', '시계탑'], '2F': ['윗', '윗마을'], '1F': ['아', '아랫마을'], B1: ['창', '창고 · 망루'] },
  tree: { PH: ['꼭', '꼭대기 오두막'], '2F': ['윗', '윗가지'], '1F': ['아', '아랫가지'], B1: ['뿌', '뿌리 · 망루'] },
};

const UNIT = new THREE.BoxGeometry(1, 1, 1);
const geoCache = new Map();
const geo = (k, make) => { if (!geoCache.has(k)) geoCache.set(k, make()); return geoCache.get(k); };

export function buildForm(kind, g, { mat, glass }) {
  const slots = [];
  const slot = (key, x, y, z, w, h, d, area = '') => slots.push({ key, area, box: [x, y, z, w, h, d] });
  const put = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const box = (w, h, d, c, x, y, z, ry = 0) => { const m = put(new THREE.Mesh(UNIT, mat(c)), x, y, z); m.scale.set(w, h, d); m.rotation.y = ry; return m; };
  const cyl = (rt, rb, h, c, x, y, z, seg = 24) => put(new THREE.Mesh(geo(`c${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat(c)), x, y, z);
  const ball = (r, c, x, y, z, seg = 10) => put(new THREE.Mesh(geo(`s${r}|${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(6, seg * .7 | 0))), mat(c)), x, y, z);
  const dome = (r, c, x, y, z) => put(new THREE.Mesh(geo(`d${r}`, () => new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)), mat(c)), x, y, z);
  const cone = (r, h, c, x, y, z, seg = 16) => put(new THREE.Mesh(geo(`k${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg)), mat(c)), x, y + h / 2, z);
  const pyramid = (w, h, c, x, y, z) => { const m = cone(w * .72, h, c, x, y, z, 4); m.rotation.y = Math.PI / 4; return m; };
  // 박공지붕: 삼각기둥. ry = 0 이면 용마루가 앞뒤(z)로, Math.PI / 2 면 좌우(x)로
  const gable = (w, d, h, c, x, y, z, ry = 0) => {
    const m = put(new THREE.Mesh(geo(`g${w}|${d}|${h}`, () => {
      const s = new THREE.Shape(); s.moveTo(-w / 2 - .15, 0); s.lineTo(w / 2 + .15, 0); s.lineTo(0, h); s.closePath();
      const e = new THREE.ExtrudeGeometry(s, { depth: d + .3, bevelEnabled: false }); e.translate(0, 0, -(d + .3) / 2); return e;
    }), mat(c)), x, y, z);
    m.rotation.y = ry;
    return m;
  };
  const win = (w, h, x, y, z, ry = 0, c = '#bfe3f2') => { const m = put(new THREE.Mesh(UNIT, glass(c)), x, y, z); m.scale.set(w, h, .06); m.rotation.y = ry; m.castShadow = false; return m; };
  const tree = (x, z, s = 1, leaf = '#6fae4f') => { box(.3 * s, 1.2 * s, .3 * s, '#8a5a35', x, .6 * s, z); ball(.9 * s, leaf, x, 1.6 * s, z, 8); ball(.6 * s, '#5c9a40', x + .3 * s, 2.1 * s, z - .1, 8); };
  const palm = (x, z, s = 1) => {
    for (let i = 0; i < 6; i++) box(.22 * s, .5 * s, .22 * s, '#a77a4a', x + i * .06 * s, .25 * s + i * .48 * s, z);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const l = box(1.5 * s, .08, .4 * s, '#3f9b55', x + .3 * s + Math.cos(a) * .7 * s, 3 * s, z + Math.sin(a) * .7 * s, -a); l.rotation.z = -.35; }
  };
  const ground = (w, d, c = '#9cc87a') => { box(w, .3, d, c, 0, -.15, 0); box(w + .02, .5, d + .02, '#9b7653', 0, -.55, 0); };
  FORMS[kind]({ box, cyl, ball, dome, cone, pyramid, gable, win, tree, palm, ground, slot, g, glass });
  return slots;
}

const FORMS = {
  library({ box, cyl, dome, cone, pyramid, gable, win, tree, ground, slot, g }) {
    ground(24, 20);
    box(8, .5, 2.4, '#d8d0c2', 0, .25, 4.6); box(6, .25, 1, '#e6dfd2', 0, .62, 3.9);
    cyl(3.2, 3.4, 4, '#efe6d6', 0, 2, 0, 32);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; cyl(.18, .2, 3.6, '#ffffff', Math.cos(a) * 3.55, 2.05, Math.sin(a) * 3.55, 10); }
    cyl(3.8, 3.8, .3, '#d8cdb8', 0, 4.15, 0, 32);
    dome(3.2, '#5f8fa8', 0, 4.3, 0);
    box(2, 2.8, .2, '#7a5a3c', 0, 1.4, 3.35); win(1.1, 2, 0, 1.2, 3.47, 0, '#ffe39a');
    slot('lobby', 0, 2, 0, 6.8, 4.2, 6.8);
    // 등탑 = 사장실
    cyl(.6, .65, 1.2, '#efe6d6', 0, 7.95, 0, 12); dome(.65, '#e3b23a', 0, 8.55, 0);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; win(.5, .7, Math.cos(a) * .64, 7.95, Math.sin(a) * .64, -a + Math.PI / 2, '#ffe39a'); }
    slot('boss', 0, 8.1, 0, 1.6, 1.9, 1.6);
    // 날개 6개 (앞쪽 현관 자리는 비워요)
    for (let i = 0; i < 6; i++) {
      const ry = Math.PI / 6 + (i * Math.PI) / 3, wg = new THREE.Group();
      wg.rotation.y = ry; g.add(wg);
      const add = (m) => { g.remove(m); wg.add(m); return m; };
      add(box(2.6, 2.6, 3.6, '#efe6d6', 0, 1.3, 5.1));
      add(gable(2.6, 3.6, 1.2, '#b6573f', 0, 2.6, 5.1));
      for (const s of [-1, 1]) for (let k = 0; k < 2; k++) add(win(.06, .9, s * 1.32, 1.4, 4.4 + k * 1.3));
      add(win(1.1, 1.4, 0, 1.25, 6.93));
      slot(null, Math.sin(ry) * 5.1, 1.9, Math.cos(ry) * 5.1, 3.2, 3.8, 3.2, Math.sin(ry) > 0 ? '2F' : '1F'); // 오른쪽(동쪽) 날개 = 2층 방들
    }
    // 앞뜰 정자 2개
    for (const s of [-1, 1]) {
      cyl(1, 1, 1.6, '#f4ece0', s * 7.4, .8, 6.8, 8); cone(1.5, 1.1, '#3f6e8c', s * 7.4, 1.6, 6.8, 8);
      win(.8, .8, s * 7.4, .9, 7.78, 0, '#ffe39a');
      slot(null, s * 7.4, 1.35, 6.8, 2.4, 2.7, 2.4, s > 0 ? '2F' : '1F');
    }
    // 문지기 초소 = 보안실, 뒤뜰 지하 서고 입구 = 보관실
    box(1, 1.4, 1, '#e9eff2', 3.2, .7, 8.4); pyramid(1.4, .6, '#e0693f', 3.2, 1.4, 8.4); win(.5, .4, 3.2, .9, 8.91);
    slot('security', 3.2, 1, 8.4, 1.4, 2, 1.4);
    box(2.6, 1, 1.8, '#d8cdb8', 0, .5, -8.4); box(1, .8, .1, '#5a3b2a', 0, .45, -7.48); gable(2.6, 1.8, .7, '#7a5a3c', 0, 1, -8.4);
    slot('archive', 0, .9, -8.4, 2.8, 1.8, 2);
    tree(-10, 8.5); tree(10, 8.8, .9); tree(-10.5, -7, 1.1); tree(10.5, -6.5);
  },

  manor({ box, cyl, pyramid, gable, win, tree, ground, slot, glass }) {
    ground(26, 20);
    box(9, 4.6, 5, '#f4ece0', 0, 2.3, 0); gable(9, 5, 2.6, '#7c4f3a', 0, 4.6, 0, Math.PI / 2);
    // 다락 = 사장실
    box(1.6, 1.2, 1.4, '#f4ece0', 0, 5.4, 2.2); gable(1.6, 1.4, .8, '#7c4f3a', 0, 6, 2.2); win(.9, .7, 0, 5.4, 2.93, 0, '#ffe39a');
    slot('boss', 0, 5.7, 2.2, 1.9, 1.9, 1.7);
    for (const x of [-3.3, -1.8, 1.8, 3.3]) { win(.9, 1.1, x, 3.4, 2.53); win(.9, 1.1, x, 1.4, 2.53); }
    box(1.6, 2.2, .3, '#5a3b2a', 0, 1.1, 2.6); box(2.6, .2, 1.5, '#7c4f3a', 0, 2.5, 3.1);
    for (const s of [-1, 1]) box(.15, 2.4, .15, '#ffffff', s * 1.2, 1.2, 3.75);
    slot('lobby', 0, 1.2, 3.1, 2.6, 2.4, 1.6);
    for (const s of [-1, 1]) for (const y of [1.15, 3.45]) slot(null, s * 2.9, y, 0, 3.2, 2.3, 5, y > 2 ? '2F' : '1F');
    // 양옆 별채 (2층 방들)
    for (const s of [-1, 1]) {
      box(4, 3, 4, '#e8dcc8', s * 6.6, 1.5, .4); gable(4, 4, 1.6, '#93624a', s * 6.6, 3, .4, Math.PI / 2);
      win(1.6, 1, s * 6.6, 1.6, 2.43);
      slot(null, s * 6.6, 1.9, .4, 4.2, 3.8, 4.2, '2F');
    }
    cyl(.5, .5, 2, '#d0c4b0', 3.2, 6, -1, 10);
    // 온실 · 연못 정자
    box(2.8, 1.8, 2.2, '#bfe3f2', 7, .9, 6.6).material = glass('#cfeef0');
    gable(2.8, 2.2, .7, '#e8f6f7', 7, 1.8, 6.6, Math.PI / 2);
    slot(null, 7, 1.2, 6.6, 3, 2.6, 2.4, '1F');
    box(5, .1, 2.6, '#7fc4e2', -4, .06, 6.6); box(5.4, .2, .3, '#d8d0c2', -4, .1, 5.15);
    for (const [x, z] of [[-9.6, 2.8], [-8, 2.8], [-9.6, 4.4], [-8, 4.4]]) box(.15, 1.4, .15, '#ffffff', x, .7, z);
    pyramid(2.4, .9, '#3f6e8c', -8.8, 1.4, 3.6);
    slot(null, -8.8, 1.1, 3.6, 2.2, 2.3, 2.2, '1F');
    // 정원 창고 = 보관실, 대문 옆 초소 = 보안실
    box(2, 1.6, 2, '#c9a77c', -10, .8, -5); gable(2, 2, .8, '#7c4f3a', -10, 1.6, -5, Math.PI / 2); box(.7, 1.1, .06, '#5a3b2a', -10, .55, -3.98);
    slot('archive', -10, 1.2, -5, 2.2, 2.6, 2.2);
    for (let i = -12; i <= 12; i++) if (Math.abs(i) > 1) box(.12, .8, .12, '#ffffff', i, .4, 9.4);
    box(10.5, .1, .12, '#ffffff', -6.75, .7, 9.4); box(10.5, .1, .12, '#ffffff', 6.75, .7, 9.4);
    box(1.2, 1.5, 1.2, '#f4ece0', 2.6, .75, 9.9); pyramid(1.6, .6, '#7c4f3a', 2.6, 1.5, 9.9); win(.5, .45, 2.6, .95, 10.52);
    slot('security', 2.6, 1.1, 9.9, 1.5, 2.2, 1.5);
    box(1.6, .05, 6.4, '#d9c8a6', 0, .03, 6.4);
    tree(-11, -8, 1.2); tree(11.5, -7); tree(10.5, 2, .8, '#e88aa8'); tree(4.4, 6.4, .7, '#e88aa8');
  },

  resort({ box, cyl, cone, pyramid, win, palm, slot, glass }) {
    const sea = box(36, .2, 32, '#5ec2d8', 0, -.1, 0); sea.castShadow = false;
    box(36.02, .9, 32.02, '#3f9fb8', 0, -.65, 0).castShadow = false;
    cyl(5, 5.6, .7, '#f1dca3', 0, .2, 0, 32);
    cyl(3.6, 3.6, .3, '#9cc87a', 0, .6, 0, 28);
    // 라운지 = 사장실
    cyl(2, 2, 2, '#f7efe2', 0, 1.75, 0, 16); cone(3, 2, '#c9a35a', 0, 2.75, 0);
    win(1.6, 1, 0, 1.8, 2.02, 0, '#ffe39a');
    slot('boss', 0, 2.4, 0, 4.4, 3.6, 4.4);
    palm(-3, 2, .8); palm(3.2, 1.6, .9); palm(2.6, -2.8, .7);
    // 섬 창고 = 보관실
    box(1.4, 1, 1.2, '#c49a66', -2.6, 1.05, -2.6); pyramid(1.9, .7, '#8a6a4a', -2.6, 1.55, -2.6);
    slot('archive', -2.6, 1.4, -2.6, 1.6, 1.8, 1.6);
    // 방갈로 8채 (앞쪽은 선착장 자리라 비워요)
    for (const deg of [20, 52, 128, 160, 200, 238, 302, 340]) {
      const a = (deg * Math.PI) / 180, r = 10, x = Math.cos(a) * r, z = Math.sin(a) * r;
      for (const sx of [-.8, .8]) for (const sz of [-.8, .8]) box(.15, 1.4, .15, '#8a6a4a', x + sx, .5, z + sz);
      box(2.4, .15, 2.4, '#b88a5a', x, 1.2, z);
      box(1.9, 1.3, 1.9, '#f4ead8', x, 1.9, z);
      win(.7, .5, x + Math.cos(a) * .96, 2, z + Math.sin(a) * .96, Math.PI / 2 - a, '#ffe39a');
      pyramid(2.9, 1.5, '#c9a35a', x, 2.55, z);
      for (let s = 5.4; s < r - 1.2; s += .45) box(.9, .08, .3, '#c49a66', Math.cos(a) * s, .45, Math.sin(a) * s, Math.PI / 2 - a);
      slot(null, x, 2.1, z, 2.8, 4.2, 2.8, x > 0 ? '2F' : '1F'); // 오른쪽(동쪽) 방갈로 = 2층 방들
    }
    // 선착장 = 접수처
    box(1.4, .15, 5, '#c49a66', 0, .4, 7.9); box(2.8, .6, 1.6, '#ffffff', 1.8, .4, 10); box(1.4, .5, .9, '#e0693f', 1.8, .95, 10);
    for (const z of [6, 8, 10]) for (const s of [-1, 1]) box(.15, 1, .15, '#8a6a4a', s * .7, .2, z);
    slot('lobby', 0, .7, 8.4, 2.4, 1.6, 5.2);
    // 등대 = 보안실
    cyl(1.6, 1.9, .6, '#9aa3ae', 12.5, .1, -10, 10);
    cyl(.55, .75, 4, '#ffffff', 12.5, 2.4, -10, 12); cyl(.57, .7, .7, '#e0693f', 12.5, 3, -10, 12);
    cyl(.5, .5, .6, '#ffe39a', 12.5, 4.7, -10, 12).material = glass('#ffe39a');
    cone(.65, .7, '#e0693f', 12.5, 5, -10, 12);
    slot('security', 12.5, 2.8, -10, 2, 5.6, 2);
  },

  village({ box, cyl, pyramid, gable, win, tree, ground, slot }) {
    ground(26, 22);
    cyl(4, 4, .06, '#d9c8a6', 0, .03, 0, 28);
    box(2.2, .06, 22, '#d9c8a6', 0, .03, 0); box(26, .06, 2.2, '#d9c8a6', 0, .03, 0);
    // 시계탑 = 사장실
    box(1.6, 6, 1.6, '#efe2cc', 0, 3, 0); pyramid(2.2, 1.6, '#3f6e8c', 0, 6, 0);
    const face = cyl(.5, .5, .08, '#ffffff', 0, 5, .82, 20); face.rotation.x = Math.PI / 2;
    box(.05, .35, .02, '#333333', 0, 5.1, .87); box(.25, .05, .02, '#333333', .1, 5, .87);
    win(.4, .5, 0, 3.4, .81, 0, '#ffe39a');
    slot('boss', 0, 3.8, 0, 2.2, 7.6, 2.2);
    const roofs = ['#e0693f', '#3f6e8c', '#2f9c8f', '#e3b23a', '#8c4f5e', '#6d5a90', '#b6573f', '#3e7f75'];
    const walls = ['#f6efe3', '#fbf3e6', '#efe6d6', '#f3ead9'];
    [[-7, -6.5, 0], [-3.3, -7, 0], [3.4, -7, 0], [7.2, -6, 0], [-7.4, 6, Math.PI], [-3.4, 7, Math.PI], [3.4, 6.8, Math.PI], [7.4, 6.2, Math.PI]].forEach(([x, z, ry], i) => {
      const h = 2 + (i % 3) * .6, w = 2.4 + (i % 2) * .4, f = ry ? -1 : 1;
      box(w, h, 2.4, walls[i % 4], x, h / 2, z);
      gable(w, 2.4, 1.2, roofs[i], x, h, z);
      win(.6, .6, x - .5, h * .6, z + f * 1.23, 0, '#ffe39a'); box(.55, 1, .06, '#7a5a3c', x + .55, .5, z + f * 1.23);
      slot(null, x, (h + 1.2) / 2, z, w + .4, h + 1.2, 2.8, z < 0 ? '2F' : '1F'); // 뒷줄 = 윗마을(2층), 앞줄 = 아랫마을(1층)
    });
    // 우체국 = 접수처, 곡식 창고 = 보관실, 망루 = 보안실
    box(3, 2.2, 2.2, '#e9eff2', -10.4, 1.1, 0); gable(3, 2.2, 1, '#e0693f', -10.4, 2.2, 0); box(.5, .7, .4, '#e0693f', -8.6, .35, .9); win(.8, .6, -10.4, 1.3, 1.13);
    slot('lobby', -10.4, 1.6, 0, 3.4, 3.4, 2.6);
    box(3, 2.4, 2.6, '#b6573f', 10.4, 1.2, 0); gable(3, 2.6, 1.2, '#7a3b2e', 10.4, 2.4, 0); box(1.4, 1.6, .06, '#f4ece0', 10.4, .8, 1.33);
    slot('archive', 10.4, 1.8, 0, 3.4, 3.8, 3);
    for (const [sx, sz] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) box(.15, 3, .15, '#8a6a4a', 2.6 + sx, 1.5, 9.6 + sz);
    box(1.5, .15, 1.5, '#b88a5a', 2.6, 3, 9.6); box(1.2, .9, 1.2, '#f4ead8', 2.6, 3.5, 9.6); pyramid(1.7, .8, '#3f6e8c', 2.6, 3.95, 9.6);
    slot('security', 2.6, 2.4, 9.6, 1.8, 4.8, 1.8);
    tree(-11, -9.5, .8); tree(11, -9.5, .9); tree(11.5, 9.5, .8); tree(-11.5, 9.5, .7); tree(2.6, 2.6, .6); tree(-2.6, -2.6, .6);
  },

  tree({ box, cyl, ball, pyramid, gable, win, tree, ground, slot }) {
    ground(22, 20);
    cyl(1.2, 2, 11, '#8a5a35', 0, 5.5, 0, 12);
    for (let i = 0; i < 5; i++) { const a = i * 1.3; box(.7, .5, 2.6, '#7a4e2e', Math.cos(a) * 2, .25, Math.sin(a) * 2, -a + Math.PI / 2); }
    for (const [c, x, y, z, r] of [['#6fae4f', 0, 12, 0, 3.6], ['#5c9a40', 2.6, 10.6, 1, 2.6], ['#7cbb58', -2.6, 10.8, -.8, 2.8], ['#5c9a40', .5, 13.6, -1, 2.4]]) ball(r, c, x, y, z, 10);
    const roofs = ['#e0693f', '#2f9c8f', '#e3b23a', '#6d5a90', '#3f6e8c', '#b6573f', '#3e7f75', '#8c4f5e', '#e0693f'];
    // 가지마다 오두막 9채: 8채는 방, 맨 위 9번째는 보안실(망루)
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4 + .6, y = 2.2 + i * .8, r = 2.9, x = Math.cos(a) * r, z = Math.sin(a) * r;
      box(2.3, .15, 2.3, '#b88a5a', x, y, z, -a);
      box(1.6, 1.3, 1.6, '#f4ead8', x, y + .72, z, -a);
      gable(1.6, 1.6, .8, roofs[i], x, y + 1.37, z, -a + Math.PI / 2);
      box(r - 1.2, .25, .25, '#7a4e2e', Math.cos(a) * (r / 2 + .5), y - .1, Math.sin(a) * (r / 2 + .5), -a);
      win(.5, .45, x + Math.cos(a) * .82, y + .8, z + Math.sin(a) * .82, -a + Math.PI / 2, '#ffe39a');
      slot(i === 8 ? 'security' : null, x, y + .9, z, 2, 2, 2, i >= 4 ? '2F' : '1F'); // 위쪽 가지 = 2층 방들
    }
    // 꼭대기 = 사장실
    box(2.6, .2, 2.6, '#b88a5a', 0, 15.4, 0); box(1.9, 1.5, 1.9, '#fff6e6', 0, 16.2, 0); pyramid(2.6, 1.2, '#e0693f', 0, 16.95, 0);
    box(.1, .9, .1, '#555555', 0, 18.5, 0); box(.6, .35, .05, '#e0693f', .3, 18.8, 0); win(.7, .5, 0, 16.3, .96, 0, '#ffe39a');
    slot('boss', 0, 16.6, 0, 2.6, 2.6, 2.6);
    for (let y = .3; y < 15; y += .5) box(.7, .05, .05, '#d9c8a6', 0, y, 2.2);
    for (const s of [-.35, .35]) box(.04, 15, .04, '#b8a27e', s, 7.5, 2.2);
    // 우체통 = 접수처, 뿌리 밑 문 = 보관실
    box(.6, 1.1, .6, '#e0693f', 3.8, .55, 3.4); box(.7, .2, .7, '#c0552f', 3.8, 1.15, 3.4);
    slot('lobby', 3.8, .8, 3.4, 1.2, 1.8, 1.2);
    box(1, 1.4, .1, '#5a3b2a', 0, .75, 1.95); box(1.2, .1, .2, '#7a4e2e', 0, 1.5, 1.98);
    slot('archive', 0, .8, 1.9, 1.6, 1.8, .8);
    tree(-8, 6, .7); tree(8.5, -6, .8); tree(-8.5, -7, .9); tree(8, 7.5, .6, '#e88aa8');
  },
};
