// AI Lab 첫 화면 — three.js 복셀 3D 건물 (화면보호기처럼 화면 가득)
// index.html 의 #b3d 안 요소(무대 · 단추 · 서랍)를 찾아 그려요. app.js 가 이 파일을 불러오고 아래 export 로 이어져요.
//   onRoom(k)      : 서랍이 닫혀 있을 때 방을 누르면 → 앱이 그 방 화면으로
//   onChange(state): 직원 배치 · 사장실 · 건물 시안이 바뀌면 → 앱이 Firebase 에 저장
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { APP_NAME, ROOMS as APP_ROOMS, FLOORS } from './rooms.js';
import { buildForm, FORM_AREAS } from './forms3d.js';
// 캐릭터(사장님 · 직원 · 친구)와 상자 · 색은 chars3d.js 에 있어요 (마을과 같이 써요)
import { CH, CHAR_DEFAULT, P, shade, UNIT, mat, B, STAFF, staffById, ME, FRIENDS, friendById, makeChar, setLook } from './chars3d.js';

// ---------- 층과 방 (rooms.js) + 그 방 직원이 하는 일 (마우스를 올리면 보여요) ----------
const JOBS = {
  train: '연수 안내 공문을 읽고 연수명·일시·장소·이수 시간을 정리해요.',
  links: '연수 사이트 캡쳐에서 주소와 중요 안내, 마감일을 뽑아 즐겨찾기로 꽂아 둬요.',
  moral: '수업 공개 공문에서 도덕 수업을 골라 날짜순으로 안내해요.',
  others: '다른 교과 공개수업을 교과별 책장에 꽂아 두고, 책을 고르면 열람대로 가져다줘요.',
  plans: '다른 선생님 지도안을 읽고 활동 방식별로 묶어 둬요.',
  task: '연수 과제 안내를 정리하고 단계별 진행과 제출일을 챙겨요.',
  aiedu: 'AI·바이브코딩 수업 · 특강과 AI 교육 공문을 모아 일정과 할 일을 챙겨요.',
  security: '정보 보안 공문에서 학교가 해야 할 일과 기한만 뽑아 챙겨요.',
  lobby: '들어온 캡쳐를 받아 AI에게 읽히고, 어느 방으로 보낼지 정해요.',
  archive: '넣은 캡쳐 원본을 고치지 않고 그대로 보관해요.',
};
// n · hot = 이름표 옆 숫자 (앱이 setBadges 로 실제 자료 수를 넣어요)
const ROOMS = Object.fromEntries(Object.entries(APP_ROOMS).map(([k, r]) => [k, { ...r, job: JOBS[k] || r.desc || '', n: 0, hot: false }]));
const ME_JOB = '건물 전체를 둘러보며 다가오는 연수·공개수업·과제 마감을 챙겨요.';
const DEFAULT = { ...CHAR_DEFAULT, theme: 1, layout: 5 }; // 직원 배치 · 사장님 · 친구 · 느낌의 처음 값은 chars3d.js 의 CHAR_DEFAULT // look: 캐릭터 느낌 0 각진 복셀 · 2 반질 비닐 (게임 메뉴 단추로 바꿔요) // 사장님은 8번 베이지 재킷(여자), 친구는 클로드 // 현관 · 엘리베이터는 5번(가운데 계단 코어)으로 정함 (2026-10-29)
const saved = (() => { try { return JSON.parse(localStorage.getItem('ailab3d') || 'null'); } catch { return null; } })();
// 저장된 배치 가운데 지금 있는 방만 (창고를 새 방으로 바꾸면 옛 창고 이름이 남아 있을 수 있어요)
const onlyRooms = (a) => Object.fromEntries(Object.entries(a || {}).filter(([k]) => ROOMS[k]));
const STATE = { ...DEFAULT, ...(saved || {}), assign: { ...DEFAULT.assign, ...onlyRooms(saved?.assign) } };
// 시안 미리 보기: 주소 뒤에 ?layout=3&theme=8&me=6&friend=11 처럼 붙이면 그 모습으로 (저장은 안 해요)
const PREVIEW = Object.fromEntries(['layout', 'theme', 'me', 'friend', 'look'].map((k) => [k, Number(new URLSearchParams(location.search).get(k)) || 0]).filter(([, v]) => v));
Object.assign(STATE, PREVIEW);
// 캐릭터 느낌: STATE.look (0 각진 복셀 · 2 반질 비닐, 미리 보기 ?look=1 클레이 · 3 만화) · ?noon=1 이면 시각과 상관없이 한낮 빛으로 (비교 사진용)
setLook(STATE.look || 0);
CH.gender = () => STATE.gender; // 사장님 여자 · 남자는 이 건물 설정을 따라요
const NOON = new URLSearchParams(location.search).has('noon');
const hooks = { onRoom: null, onChange: null, onFurn: null, furnInfo: null };
const root = document.getElementById('b3d');
let visible = !root.hidden;
// home = 첫 화면(화면 가득) · band = 층 화면 위쪽 띠(그 층만 보여 줘요)
let mode = 'home';
let bandRooms = [], bandFloor = ''; // 층 화면에서 보고 있는 층과 그 층의 방들
// 이 브라우저에도 기억하고(로그인 전), 로그인한 선생님이면 앱이 Firebase 에 저장해요
// 화면에서 직접 바꾼 때. 앱은 0.8초 뒤에 Firebase 에 저장하는데, 그 사이 서버에서 돌아오는 '예전 값'이
// 화면을 한 칸 뒤로 되돌리지 않게 바꾼 뒤 3초 동안은 setState 를 받지 않아요 (← → 키를 빨리 눌러도 안 튀게)
let lastLocal = 0;
const save = () => {
  lastLocal = performance.now();
  try { localStorage.setItem('ailab3d', JSON.stringify(STATE)); } catch {}
  hooks.onChange?.({ ...STATE, assign: { ...STATE.assign } });
};

// ---------- three.js 기본 ----------
const stage = document.getElementById('stage');
const labelsEl = document.getElementById('labels');
let renderer, thumbR;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
} catch {
  stage.insertAdjacentHTML('beforeend', '<p class="fail">이 브라우저에서는 3D 화면을 열 수 없어요. 다른 브라우저로 열어 주세요.</p>');
  throw new Error('WebGL 없음');
}
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, .1, 400);
const hemi = new THREE.HemisphereLight('#ffffff', '#b9a68a', 1.6);
const sun = new THREE.DirectionalLight('#fff4e2', 2.3);
sun.position.set(-14, 29, 26);
sun.target.position.set(0, 6, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 28, bottom: -22, near: 1, far: 120 }); // 방 4개짜리 넓고 낮은 건물이 다 들어가게
sun.shadow.bias = -.0004;
sun.shadow.normalBias = .03;
scene.add(hemi, sun, sun.target);

function applyTheme() {
  const css = getComputedStyle(document.documentElement);
  scene.background = new THREE.Color(css.getPropertyValue('--sky').trim() || '#dfeaf1');
  const dark = scene.background.getHSL({}).l < .3;
  hemi.intensity = dark ? 1.05 : 1.6;
  sun.intensity = dark ? 1.5 : 2.3;
  if (WX?.data) applyWeather(); // 실시간 날씨를 받았으면 그 하늘로
}

// ---------- 실시간 날씨 · 해 뜨고 지는 시간 ----------
// 평일 근무 시간은 서울, 출근 전 · 퇴근 후 · 주말은 남양주 (Open-Meteo: 열쇠 없이 쓰는 무료 날씨, 15분마다 새로)
// 하늘색 · 햇빛 방향과 세기 · 노을 · 밤에 켜지는 창문 불 · 비 · 눈 · 구름 · 안개를 3D 에 그려요
const PLACES = { seoul: { name: '서울', lat: 37.5665, lon: 126.978 }, nyj: { name: '남양주', lat: 37.636, lon: 127.2165 } };
const WORK = { days: [1, 2, 3, 4, 5], start: '08:30', end: '16:30' }; // 근무 시간 (바꾸려면 여기만)
var WX = { key: '', why: '', kind: '', data: null }; // var: applyTheme 이 먼저 불려도 괜찮게
const hm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
function placeNow(d = new Date()) {
  const mins = d.getHours() * 60 + d.getMinutes(), weekday = WORK.days.includes(d.getDay());
  const work = weekday && mins >= hm(WORK.start) && mins < hm(WORK.end);
  return { key: work ? 'seoul' : 'nyj', why: work ? '근무 시간' : !weekday ? '주말' : mins < hm(WORK.start) ? '출근 전' : '퇴근 후' };
}
const wxCache = new Map();
async function loadWeather(key) {
  const c = wxCache.get(key);
  if (c && Date.now() - c.at < 15 * 60e3) return c.data;
  const p = PLACES[key];
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,weather_code,cloud_cover&daily=sunrise,sunset&timezone=Asia%2FSeoul&forecast_days=1`);
  if (!r.ok) throw new Error(`날씨 ${r.status}`);
  const j = await r.json();
  const data = { temp: j.current.temperature_2m, code: j.current.weather_code, cloud: j.current.cloud_cover,
    sunrise: new Date(`${j.daily.sunrise[0]}:00+09:00`), sunset: new Date(`${j.daily.sunset[0]}:00+09:00`) };
  wxCache.set(key, { data, at: Date.now() });
  return data;
}
function wxKind(code) {
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (code === 3) return 'overcast';
  return code === 1 || code === 2 ? 'partly' : 'clear';
}
const WX_NAME = { clear: '맑음', partly: '구름 조금', overcast: '흐림', fog: '안개', rain: '비', snow: '눈', storm: '뇌우' };
// light: 0 밤 ~ 1 낮, glow: 노을 세기, u: 낮 동안 해가 간 정도 (해 뜰 때 0 → 질 때 1)
function sunPhase(now, d) {
  const t = now.getTime(), r = d.sunrise.getTime(), s = d.sunset.getTime(), m = 40 * 60e3;
  const light = t < r - m || t > s + m ? 0 : t < r + m ? (t - (r - m)) / (2 * m) : t > s - m ? (s + m - t) / (2 * m) : 1;
  const glow = light > 0 && (t < r + m || t > s - m) ? 1 - Math.abs(light - .5) * 2 : 0;
  return { light: Math.min(1, Math.max(0, light)), glow, u: Math.min(1, Math.max(0, (t - r) / (s - r))) };
}
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 4; skyCanvas.height = 256;
const skyTex = new THREE.CanvasTexture(skyCanvas);
skyTex.colorSpace = THREE.SRGBColorSpace;
const mix = (a, b, k) => `#${new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString()}`;
const fmtT = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
function applyWeather() {
  const d = WX.data;
  if (!d) return;
  const kind = WX.kind, ph = sunPhase(NOON ? new Date((d.sunrise.getTime() + d.sunset.getTime()) / 2) : new Date(), d);
  const grey = { clear: 0, partly: .15, overcast: .55, fog: .6, rain: .7, snow: .5, storm: .85 }[kind];
  let top = mix('#0a1430', mix('#6fb4e6', '#8e9ba6', grey), ph.light);
  let bot = mix('#26365a', mix('#d7ecf7', '#c4ccd2', grey), ph.light);
  if (ph.glow) { bot = mix(bot, '#f4a76b', ph.glow * (1 - grey * .7)); top = mix(top, '#5a6fa8', ph.glow * .4); }
  const g = skyCanvas.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(1, bot);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  skyTex.needsUpdate = true;
  scene.background = skyTex;
  hemi.intensity = .35 + ph.light * (1.25 - grey * .45);
  sun.intensity = .25 + ph.light * (2.1 - grey * 1.5);
  sun.color.set(ph.glow > .3 ? '#ffb877' : ph.light < .2 ? '#9fb4ff' : '#fff4e2');
  // 해는 아침에 왼쪽(동쪽)에서 떠서 저녁에 오른쪽으로, 밤에는 높이 뜬 달빛
  const ang = Math.PI * ph.u;
  if (ph.light > 0) sun.position.set(-34 * Math.cos(ang), 8 + 26 * Math.sin(ang), 26); else sun.position.set(-10, 30, 26);
  scene.fog = kind === 'fog' ? new THREE.Fog(bot, 35, 120) : grey >= .55 ? new THREE.Fog(bot, 80, 200) : null;
  const night = ph.light < .4;
  for (const m of glassMats) { m.emissive.set(night ? '#ffd98a' : m.userData.base); m.emissiveIntensity = night ? .9 : .35; }
  setPrecip(kind);
  setClouds(kind);
  const el = document.getElementById('wx');
  el.hidden = false;
  el.innerHTML = `<b>${PLACES[WX.key].name}</b><span>${WX.why}</span><span>${WX_NAME[kind]} ${Math.round(d.temp)}°</span><span>해 뜸 ${fmtT(d.sunrise)} · 해 짐 ${fmtT(d.sunset)}</span>`;
}
// 비 · 눈: 건물 앞쪽 공간에만 내려요 (잘라 놓은 방 안으로는 안 들어가게)
let precip = null, precipKind = '';
function setPrecip(kind) {
  const k = kind === 'storm' ? 'rain' : kind;
  if (k === precipKind) return;
  if (precip) { scene.remove(precip.obj); precip = null; }
  precipKind = k;
  if (k !== 'rain' && k !== 'snow') return;
  const n = k === 'rain' ? 900 : 600, per = k === 'rain' ? 6 : 3, pos = new Float32Array(n * per);
  const seeds = [...Array(n)].map(() => ({ x: (Math.random() - .5) * 90, y: Math.random() * 46 - 12, z: 3.6 + Math.random() * 9, v: k === 'rain' ? 24 + Math.random() * 10 : 1.4 + Math.random(), ph: Math.random() * 6 }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const obj = k === 'rain'
    ? new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#cfe3f2', transparent: true, opacity: .5 }))
    : new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: .22 }));
  obj.frustumCulled = false;
  scene.add(obj);
  precip = { obj, seeds, k, pos };
}
function stepPrecip(dt, t) {
  if (!precip) return;
  const { seeds, pos, k } = precip;
  seeds.forEach((s, i) => {
    s.y -= s.v * dt;
    if (s.y < BOTTOM - 1) s.y += 46;
    if (k === 'rain') pos.set([s.x, s.y, s.z, s.x - .12, s.y + .9, s.z], i * 6);
    else pos.set([s.x + Math.sin(t * .8 + s.ph) * .6, s.y, s.z], i * 3);
  });
  precip.obj.geometry.attributes.position.needsUpdate = true;
}
// 구름: 맑으면 하나, 구름 조금이면 넷, 흐리면 일곱. 비 · 뇌우 때는 잿빛
const cloudGroup = new THREE.Group();
scene.add(cloudGroup);
let cloudKey = '';
function setClouds(kind) {
  const n = kind === 'clear' ? 1 : kind === 'partly' ? 4 : 7, dark = kind === 'rain' || kind === 'storm';
  if (cloudKey === `${n}|${dark}`) return;
  cloudKey = `${n}|${dark}`;
  cloudGroup.clear();
  for (let i = 0; i < n; i++) {
    const c = new THREE.Group(), s = 1 + (i % 3) * .4;
    [[0, 0, 0, 4, 1.4, 2.4], [1.8, .6, 0, 3, 1.6, 2.2], [-1.8, .4, .2, 2.6, 1.2, 2], [.6, 1.2, -.2, 2.4, 1.2, 1.8]]
      .forEach(([x, y, z, w, h, dd]) => B(c, w * s, h * s, dd * s, dark ? '#8e979f' : '#ffffff', x * s, y * s, z * s, { shadow: false }));
    c.position.set(-45 + i * 14 + (i % 2) * 5, TOP_Y + 8 + (i % 3) * 3, -8 - (i % 2) * 6);
    c.userData.v = .6 + (i % 3) * .3;
    cloudGroup.add(c);
  }
}
function stepClouds(dt) { for (const c of cloudGroup.children) { c.position.x += c.userData.v * dt; if (c.position.x > 55) c.position.x = -55; } }
async function refreshWeather() {
  const p = placeNow();
  try {
    const data = await loadWeather(p.key);
    Object.assign(WX, p, { data, kind: wxKind(data.code) });
    applyWeather();
  } catch { /* 날씨를 못 받으면 원래 하늘 그대로 */ }
}

applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ---------- 글씨가 있는 면 (캔버스 그림) ----------
// 글씨 그림은 한 번 그린 걸 다시 써요 (시안을 바꿀 때마다 새로 그리면 잠깐 멈칫해요)
const texCache = new Map();
const memoTex = (key, make) => { if (!texCache.has(key)) texCache.set(key, make()); return texCache.get(key); };
function texMat(draw, w = 512, h = 320) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: t, roughness: .7, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: .25 });
}
const FONT = '"Ownglyph_UNZ-Rg", "IBM Plex Sans KR", sans-serif';
const checklist = (title, items) => memoTex(`cl|${title}|${JSON.stringify(items)}`, () => drawChecklist(title, items));
function drawChecklist(title, items) {
  return texMat((g, w, h) => {
    g.fillStyle = '#26313a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2b84a'; g.font = `34px ${FONT}`; g.fillText(title, 28, 50);
    items.forEach(([label, done], i) => {
      const y = 92 + i * 46;
      g.fillStyle = done ? '#4cc07a' : '#55636d'; g.fillRect(28, y - 24, 28, 28);
      if (done) { g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.moveTo(33, y - 10); g.lineTo(41, y - 2); g.lineTo(52, y - 18); g.stroke(); }
      g.fillStyle = '#eef4f6'; g.font = `27px ${FONT}`; g.fillText(label, 72, y);
      g.fillStyle = done ? '#4cc07a' : '#55636d'; g.fillRect(250, y - 14, done ? 220 : 120, 8);
    });
  });
}
const calendarMat = () => memoTex('calendar', drawCalendar);
const drawCalendar = () => texMat((g, w, h) => {
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e0693f'; g.fillRect(0, 0, w, 70);
  g.fillStyle = '#fff'; g.font = `40px ${FONT}`; g.fillText('11월 연수', 24, 50);
  g.font = '22px "IBM Plex Mono", monospace';
  for (let i = 0; i < 30; i++) {
    const x = 26 + (i % 7) * 68, y = 112 + Math.floor(i / 7) * 46;
    if ([3, 11, 19, 25].includes(i)) { g.fillStyle = '#62b0d0'; g.fillRect(x - 8, y - 26, 52, 36); g.fillStyle = '#fff'; } else g.fillStyle = '#566570';
    g.fillText(String(i + 1), x, y);
  }
}, 512, 340);
const posterMat = (title, color) => memoTex(`poster|${title}|${color}`, () => drawPoster(title, color));
const drawPoster = (title, color) => texMat((g, w, h) => {
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, w, h);
  g.fillStyle = color; g.fillRect(30, 40, 300, 22); g.fillRect(30, 80, 200, 14);
  g.fillStyle = '#c3d0d8'; for (let i = 0; i < 5; i++) g.fillRect(30, 130 + i * 30, 380 - (i % 2) * 90, 10);
  g.fillStyle = color; g.font = `54px ${FONT}`; g.fillText(title, 300, 290);
}, 512, 340);

// ---------- 마우스를 올리면 보이는 설명 ----------
const STAFF_ABOUT = {
  1: '모자를 꾹 눌러쓴 성실한 큐브예요. 맡은 일은 끝까지 해요.',
  2: '블록으로 된 만능 직원이에요. 무엇이든 척척 날라요.',
  3: '흰 가운을 입은 꼼꼼한 연구원이에요. 자료를 한 줄씩 확인해요.',
  4: '작지만 손이 제일 빠른 막내예요.',
  5: '밤새 지치지 않는 로봇이에요. 한 장도 잃어버리지 않아요.',
  6: '밤에도 눈이 밝은 부엉이예요. 찾는 자료를 금방 찾아 와요.',
  7: '느긋하지만 힘센 곰이에요. 무거운 서류 상자도 거뜬해요.',
  8: '나비넥타이를 맨 단정한 펭귄이에요. 줄 맞춰 정리하는 걸 좋아해요.',
  9: '빛으로 된 직원이에요. 여러 방을 순식간에 오가요.',
  10: '의욕이 넘치는 공룡 인턴이에요. 꼬리로 박자를 맞추며 일해요.',
  11: '레고처럼 네모난 개발자예요. 사각 안경 너머로 코드를 척척 짜요.',
  12: '팔을 활짝 벌린 클로드 짝꿍이에요. 창고 상자도 번쩍번쩍 날라요.',
};
const FRIEND_ABOUT = {
  1: ['사장님 어깨 옆에 둥둥 떠 있는 화면 얼굴 로봇이에요.', '다가오는 일정과 할 일을 먼저 알려 줘요.'],
  2: ['꼬리를 흔들며 사장님을 졸졸 따라다녀요.', '오래 앉아 있으면 쉬었다 하자고 졸라요.'],
  3: ['책 더미 위에서 해바라기씨를 오물오물 먹어요.', '흩어진 메모를 볼에 모아 와요.'],
  4: ['웃는 얼굴의 화분이에요.', '사장실 공기를 맑게 하고 기분을 북돋아요.'],
  5: ['프로펠러 네 개로 떠다니는 작은 드론이에요.', '층마다 날아가 무슨 일이 있는지 살펴봐요.'],
  6: ['귀가 쫑긋한 하얀 토끼예요.', '새 소식이 오면 깡총 뛰어 알려요.'],
  7: ['김이 모락모락 나는 머그잔이에요.', '바쁜 날 따뜻한 커피로 응원해요.'],
  8: ['책장을 펄럭이며 떠 있는 책이에요.', '지도안과 연수 자료를 펼쳐 보여 줘요.'],
  9: ['살짝 비치는 수줍은 유령이에요.', '밤늦게 남은 일을 조용히 지켜요.'],
  10: ['불꽃을 일렁이며 떠 있는 꼬마 로켓이에요.', '급한 일을 순식간에 처리해요.'],
  11: ['주황 네모 몸에 다리가 넷인 AI 친구 클로드예요.', '공문을 읽고 카드로 정리하는 일을 함께해요.'],
  12: ['팔을 활짝 벌린 클로드 짝꿍이에요.', '회의 녹음 요약처럼 귀찮은 일을 척척 도와줘요.'],
  13: ['얼음이 가득 든 아이스커피예요.', '바쁜 날에도 시원하게 응원해요.'],
  14: ['동글동글한 하늘색 물고기 친구 뻐끔이예요.', '머리 위로 물방울을 뽀글뽀글 올리며 사장님 곁을 지켜요.'],
};
// 없어진 방(창고 → 새 방으로 바꾼 칸)에 저장돼 있던 배치는 건너뛰어요
const where = (id) => Object.entries(STATE.assign).filter(([k, v]) => v === id && ROOMS[k]).map(([k]) => ROOMS[k].name);
const staffInfo = (id, room) => {
  const s = staffById(id);
  return { title: s.name, sub: room ? `${ROOMS[room].name} 직원` : (where(id).join(' · ') || '아직 배치 전'), text: STAFF_ABOUT[id], job: room ? ROOMS[room].job : '' };
};
const friendInfo = (id) => ({ title: friendById(id).name, sub: '사장님 옆 친구', text: FRIEND_ABOUT[id][0], job: FRIEND_ABOUT[id][1] });
const meInfo = () => { const m = ME.find((x) => x.id === STATE.me) || ME[0]; return { title: `사장님 · ${m.name}`, sub: `${FLOORS.find((f) => f.rooms.includes('boss'))?.floor || ''} 사장실`, text: `${m.note}.`, job: ME_JOB }; };
const tipEl = document.getElementById('tip');
function showTip(info, x, y) {
  tipEl.innerHTML = `<b>${info.title}</b>${info.sub ? `<i>${info.sub}</i>` : ''}<p>${info.text}</p>${info.job ? `<p class="job"><span>하는 일</span>${info.job}</p>` : ''}`;
  tipEl.hidden = false;
  const r = tipEl.getBoundingClientRect();
  const left = Math.min(x + 14, innerWidth - r.width - 8), top = y + 16 + r.height > innerHeight - 8 ? y - r.height - 12 : y + 16;
  tipEl.style.translate = `${Math.max(8, left)}px ${Math.max(8, top)}px`;
}
const hideTip = () => { tipEl.hidden = true; };


// ---------- 움직임 ----------
const people = [];
// role: desk(타자) · stand(둘러보기) · walk(오가기) · wave(손 흔들기) · me · float · pet · hop
function addChar(parent, x, y, z, role, { def, face = 0, walk, hold, info } = {}) {
  const c = makeChar(def);
  c.info = info;
  c.root.userData.char = c;
  const seat = role === 'desk' ? def.stool || 0 : 0;
  if (seat) B(parent, .8, seat, .8, P.woodD, x, y + seat / 2, z);
  c.root.position.set(x, y + seat, z);
  c.root.rotation.y = face;
  Object.assign(c, { base: { x, y: y + seat, face }, role, walk, hold, ph: Math.random() * 10 });
  parent.add(c.root);
  people.push(c);
  return c;
}
function groupAnim(c, s) {
  for (const { name, g } of c.groups) {
    if (name === 'tail') g.rotation.y = Math.sin(s * 2.4) * .35;
    else if (name === 'wag') g.rotation.z = Math.sin(s * 14) * .5;
    else if (name === 'prop') g.rotation.y = s * 28;
    else if (name === 'leaves') g.rotation.z = Math.sin(s * 1.6) * .14;
    else if (name === 'ear') g.rotation.x = Math.sin(s * 2.2) * .18;
    else if (name === 'flapL') g.rotation.y = c.role === 'float' && c.groups.some((x) => x.name === 'flapR') && g.children.length > 1 ? .5 + Math.sin(s * 2.4) * .3 : 0;
    else if (name === 'flapR') g.rotation.y = c.role === 'float' && g.children.length > 1 ? -.5 - Math.sin(s * 2.4) * .3 : 0;
    else if (name === 'flame') g.scale.set(1, 1 + Math.sin(s * 22) * .25, 1);
    else if (name === 'steam') g.children.forEach((m, i) => {
      if (m.userData.y0 === undefined) m.userData.y0 = m.position.y;
      const k = (s * .5 + i / 3) % 1;
      m.position.y = m.userData.y0 + k * .25;
      m.visible = k < .85;
    });
  }
  // 유령의 짧은 팔은 파닥파닥
  if (c.flapGhost) { c.flapL.rotation.z = Math.sin(s * 6) * .4; c.flapR.rotation.z = -Math.sin(s * 6) * .4; }
}
function animate(c, t) {
  const s = t + c.ph;
  const arms = c.armL && c.armR;
  groupAnim(c, s);
  switch (c.role) {
    case 'me': {
      c.lift.position.y = Math.abs(Math.sin(s * 1.3)) * .035;
      c.head.rotation.y = Math.sin(s * .55) * .4;
      const holding = c.hold === 'L' ? c.armL : c.armR, free = c.hold === 'L' ? c.armR : c.armL;
      holding.rotation.x = -.9 + Math.sin(s * 1.3) * .05;
      free.rotation.z = (c.hold === 'L' ? 1 : -1) * (.06 + Math.sin(s * 1.3) * .05);
      return;
    }
    case 'float':
      c.root.position.y = c.base.y + Math.sin(s * 1.6) * .12;
      c.root.rotation.y = c.base.face + Math.sin(s * .9) * .4;
      return;
    case 'pet':
      if (c.head) c.head.rotation.y = Math.sin(s * .5) * .35;
      return;
    case 'hop':
      c.root.position.y = c.base.y + Math.max(0, Math.sin(s * 4)) * .22;
      c.root.rotation.y = c.base.face + Math.sin(s * .7) * .3;
      return;
    case 'desk':
      c.lift.position.y = Math.abs(Math.sin(s * 1.6)) * .03;
      if (arms) { c.armL.rotation.x = -1.05 + Math.sin(s * 15) * .14; c.armR.rotation.x = -1.05 - Math.sin(s * 15) * .14; } else c.root.rotation.y = c.base.face + Math.sin(s * .7) * .25;
      if (c.head) c.head.rotation.y = Math.sin(s * .5) * .2;
      return;
    case 'walk': {
      const [a, b, speed] = c.walk;
      const span = b - a, period = (span * 2) / speed;
      const k = ((s % period) + period) % period;
      const forward = k < period / 2;
      c.root.position.x = forward ? a + (k / (period / 2)) * span : b - ((k - period / 2) / (period / 2)) * span;
      const want = forward ? Math.PI / 2 : -Math.PI / 2;
      c.root.rotation.y += (want - c.root.rotation.y) * .15;
      const step = Math.sin(s * 7);
      if (c.legL) { c.legL.rotation.x = step * .55; c.legR.rotation.x = -step * .55; }
      if (arms) { c.armL.rotation.x = -step * .5; c.armR.rotation.x = step * .5; }
      c.lift.position.y = c.legL ? Math.abs(step) * .04 : Math.abs(Math.sin(s * 5)) * .22;
      return;
    }
    case 'librarian': { // 도서관 사서: c.go 자리로 걸어가요 (없으면 c.home). 책을 들고 있으면 두 팔을 앞으로
      const dt = Math.min(.05, Math.max(0, s - (c.lastS ?? s)));
      c.lastS = s;
      const go = c.go || c.home;
      const dx = go.x - c.root.position.x, dz = go.z - c.root.position.z, dist = Math.hypot(dx, dz);
      c.moving = dist > .04;
      let want = go.face;
      if (c.moving) {
        const st = Math.min(dist, 2.6 * dt);
        c.root.position.x += (dx / dist) * st;
        c.root.position.z += (dz / dist) * st;
        want = Math.atan2(dx, dz);
      }
      const da = Math.atan2(Math.sin(want - c.root.rotation.y), Math.cos(want - c.root.rotation.y));
      c.root.rotation.y += da * Math.min(1, dt * 8);
      const step = c.moving ? Math.sin(s * 7) : 0;
      if (c.legL) { c.legL.rotation.x = step * .55; c.legR.rotation.x = -step * .55; }
      if (arms) {
        if (c.carry?.visible) { c.armL.rotation.x = -1.1; c.armR.rotation.x = -1.1; } else { c.armL.rotation.x = -step * .5; c.armR.rotation.x = step * .5; }
      }
      c.lift.position.y = c.moving ? (c.legL ? Math.abs(step) * .04 : Math.abs(Math.sin(s * 5)) * .18) : Math.abs(Math.sin(s * 1.4)) * .03;
      if (c.head) c.head.rotation.y = c.moving ? 0 : Math.sin(s * .6) * .3;
      return;
    }
    default: // stand · wave
      c.lift.position.y = Math.abs(Math.sin(s * 1.4)) * (c.sway ? .1 : .04);
      if (c.sway) c.root.rotation.y = c.base.face + Math.sin(s * .8) * .5;
      if (c.head) c.head.rotation.y = Math.sin(s * .6) * .45;
      if (arms) {
        c.armL.rotation.z = -.06 - Math.sin(s * 1.4) * .05;
        c.armR.rotation.z = c.role === 'wave' ? 2.55 + Math.sin(s * 11) * .3 : .06 + Math.sin(s * 1.4) * .05;
      }
  }
}

// ---------- 소품 ----------
let DESK = .98;
function desk(g, x, y, z, { monitor = true, papers = true, h = DESK } = {}) {
  const w = 1.7, d = .8;
  B(g, w, .1, d, P.wood, x, y + h, z);
  B(g, w - .1, h - .05, .08, P.woodD, x, y + h / 2, z + d / 2 - .06);
  for (const sx of [-1, 1]) B(g, .08, h, d - .1, P.woodD, x + sx * (w / 2 - .06), y + h / 2, z);
  if (monitor) {
    const mx = x + .55;
    B(g, .08, .22, .08, P.metal, mx, y + h + .16, z + .05);
    B(g, .62, .4, .06, P.screen, mx, y + h + .44, z + .05);
    B(g, .56, .34, .02, P.monitor, mx, y + h + .44, z + .02, { shadow: false });
  }
  if (papers) { B(g, .32, .04, .24, P.paper, x - .55, y + h + .07, z + .05); B(g, .3, .04, .22, P.cap, x - .58, y + h + .11, z + .04); }
  B(g, .5, .03, .2, P.belt, x + .05, y + h + .065, z + .12, { shadow: false });
}
function shelf(g, x, y, z, w = 1.3, h = 2.1, seed = 1) {
  const d = .45;
  B(g, w, h, .06, P.woodD, x, y + h / 2, z - d / 2);
  for (const sx of [-1, 1]) B(g, .08, h, d, P.wood, x + sx * (w / 2 - .04), y + h / 2, z);
  const rows = 4;
  for (let r = 0; r <= rows; r++) B(g, w, .06, d, P.wood, x, y + .03 + (r * (h - .06)) / rows, z);
  let k = seed;
  for (let r = 0; r < rows; r++) {
    let bx = x - w / 2 + .12;
    while (bx < x + w / 2 - .2) {
      k = (k * 9301 + 49297) % 233280;
      const bw = .07 + (k % 5) * .02, bh = (h / rows) * (.55 + (k % 4) * .08);
      B(g, bw, bh, .3, P.book[k % P.book.length], bx + bw / 2, y + .06 + (r * (h - .06)) / rows + bh / 2, z + .02);
      bx += bw + .015;
    }
  }
}
function plant(g, x, y, z, big = false) {
  const s = big ? 1.35 : 1;
  B(g, .4 * s, .38 * s, .4 * s, P.pot, x, y + .19 * s, z);
  B(g, .5 * s, .5 * s, .5 * s, P.leaf, x, y + .63 * s, z);
  B(g, .36 * s, .36 * s, .36 * s, P.leaf2, x + .05, y + 1.04 * s, z - .02);
}
function wallBoard(g, x, y, z, w, h, m) {
  B(g, w + .12, h + .12, .06, P.frame, x, y, z);
  const f = new THREE.Mesh(UNIT, m);
  f.scale.set(w, h, .03);
  f.position.set(x, y, z + .04);
  g.add(f);
}
function standBoard(g, x, y, z, m) {
  for (const sx of [-1, 1]) B(g, .08, 1.55, .08, P.metal, x + sx * .9, y + .78, z);
  B(g, 2.1, .08, .5, P.metal, x, y + .04, z);
  B(g, 2.1, 1.3, .1, P.belt, x, y + 1.85, z);
  const f = new THREE.Mesh(UNIT, m);
  f.scale.set(1.98, 1.18, .03);
  f.position.set(x, y + 1.85, z + .06);
  g.add(f);
}
function easel(g, x, y, z, face = 0) {
  const e = new THREE.Group();
  e.position.set(x, y, z); e.rotation.y = face; g.add(e);
  for (const sx of [-1, 1]) { const l = B(e, .07, 1.9, .07, P.wood, sx * .38, .92, 0); l.rotation.z = sx * -.12; }
  const back = B(e, .07, 1.7, .07, P.wood, 0, .82, -.35); back.rotation.x = .25;
  B(e, 1, .06, .16, P.wood, 0, .75, .05);
  B(e, 1.05, .8, .05, P.paper, 0, 1.2, .05);
  B(e, .5, .08, .02, P.teal, -.12, 1.42, .09, { shadow: false });
  B(e, .7, .05, .02, P.cap, 0, 1.25, .09, { shadow: false });
  B(e, .4, .05, .02, P.red, -.15, 1.1, .09, { shadow: false });
}
function chart(g, x, y, z) {
  [.7, 1.1, .9, 1.5, 1.9].forEach((h, i) => B(g, .26, h, .26, i === 4 ? P.shirt : P.cap, x + i * .34, y + h / 2, z));
  B(g, 1.9, .06, .5, P.metal, x + .68, y + .03, z);
}
function crates(g, x, y, z, cols = 2, rows = 2) {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols - (r % 2) * (cols > 1 ? 1 : 0); c++) {
    const cx = x + c * .66 + (r % 2) * .33, cy = y + .3 + r * .6;
    B(g, .6, .58, .6, P.crate, cx, cy, z);
    B(g, .62, .08, .62, P.crateD, cx, cy + .18, z, { shadow: false });
  }
}
function cabinet(g, x, y, z) {
  B(g, .7, 1.3, .55, P.steel, x, y + .65, z);
  for (let i = 0; i < 3; i++) { B(g, .62, .02, .02, shade(P.steel, -.3), x, y + .3 + i * .4, z + .28, { shadow: false }); B(g, .16, .05, .03, P.belt, x, y + .45 + i * .4, z + .29, { shadow: false }); }
}
function bench(g, x, y, z, w = 1.6) {
  B(g, w, .1, .42, P.wood, x, y + .42, z);
  for (const sx of [-1, 1]) B(g, .08, .4, .36, P.woodD, x + sx * (w / 2 - .1), y + .2, z);
}
const docs = [];
function belt(g, x0, x1, y, z) {
  const len = x1 - x0, cx = (x0 + x1) / 2;
  B(g, len, .12, .7, P.belt, cx, y + .55, z);
  B(g, len + .1, .06, .78, P.metal, cx, y + .48, z);
  for (const sx of [x0 + .1, x1 - .1]) for (const sz of [-.3, .3]) B(g, .08, .45, .08, P.metal, sx, y + .23, z + sz);
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Group();
    B(d, .34, .05, .44, P.paper, 0, 0, 0);
    B(d, .2, .01, .03, '#9aabb6', 0, .03, -.1, { shadow: false });
    B(d, .24, .01, .03, '#9aabb6', 0, .03, 0, { shadow: false });
    d.position.set(x0, y + .64, z);
    g.add(d);
    docs.push({ d, x0, x1, off: i / 4 });
  }
}
function counter(g, x, y, z, w) {
  B(g, w, 1.0, .7, P.cap, x, y + .5, z);
  B(g, w + .2, .1, .9, P.wood, x, y + 1.05, z);
  B(g, w - .3, .5, .02, shade(P.cap, -.15), x, y + .5, z + .36, { shadow: false });
}
function mailbox(g, x, y, z) {
  B(g, .14, .9, .14, P.metal, x, y + .45, z);
  B(g, .5, .5, .7, P.red, x, y + 1.15, z);
  B(g, .32, .05, .02, P.eye, x, y + 1.25, z + .36, { shadow: false });
}
function sofa(g, x, y, z) {
  B(g, 1.8, .4, .7, P.shirt, x, y + .25, z);
  B(g, 1.8, .55, .2, shade(P.shirt, -.15), x, y + .6, z - .3);
  for (const sx of [-1, 1]) B(g, .2, .5, .7, shade(P.shirt, -.1), x + sx * .9, y + .4, z);
}
function lamp(g, x, y, z) {
  B(g, .1, 1.7, .1, P.metal, x, y + .85, z);
  B(g, .4, .3, .4, P.gold, x, y + 1.8, z, { m: mat(P.gold, { emissive: P.gold, emissiveIntensity: .35 }) });
}

// ---------- 건물 ----------
// FH: 층고 (3.2 → 4.1 → 층 화면에서 답답하지 않게 5.6), RW: 방 한 칸 너비
// 건물 너비는 한 층의 방 수(지금 4개)에 맞추고, 높이는 rooms.js 의 층 수를 따라요 (모니터가 가로로 기니까 낮고 넓게)
const FH = 5.6, D = 5.6, RW = 10, SW = 3.4; // SW: 엘리베이터 칸 너비
const RBW = RW * Math.max(...FLOORS.map((f) => f.rooms.length)); // 방들만의 너비
let BW = RBW; // 건물 전체 너비 (엘리베이터 칸이 건물 안에 있으면 그만큼 넓어져요. buildWorld 가 정해요)
// 펜트하우스(penthouse)는 옥상 위에 따로 올린 한 층이에요. 나머지 층(MAIN)이 건물 몸통
const MAIN = FLOORS.filter((f) => !f.penthouse);
const UP = MAIN.filter((f) => !f.floor.startsWith('B')).length; // 땅 위 층 수 (B 로 시작하는 층은 흙 속)
const ROOF_Y = UP * FH, BOTTOM = -(MAIN.length - UP) * FH;
const floorY = (i) => (FLOORS[i].penthouse ? ROOF_Y : (UP - 1 - MAIN.indexOf(FLOORS[i])) * FH);
const HAS_PH = FLOORS.some((f) => f.penthouse), PW = 18; // PW: 펜트하우스 너비
const TOP_Y = ROOF_Y + (HAS_PH ? FH : 0); // 맨 꼭대기 (옥상 꾸밈은 여기에)
const WK = FH / 4.1; // 창문은 층고에 맞춰 키워요

// --- 건물 시안 10개. side: 바깥 옆벽(색 · glass · brick · logs), win: 창문 모양, roof: 옥상 꾸밈, ground: 땅 · 나무 색 바꾸기 ---
// 1번 숲속 연구소가 기본. 5~7번은 2026-10-29 새 컨셉 (파스텔 장난감 · 바닷가 등대 · 벚꽃 학교는 뺐어요)
const THEMES = [
  { id: 1, name: '숲속 연구소', wall: '#eadcc2', wall2: '#d9c4a0', wallB1: '#c5b394', slab: '#cdb58e', edge: '#4f6b3a', pillar: '#7a5232', frame: '#7a5232', glass: '#cfe8d6', side: 'logs', win: 'two', roof: 'garden' },
  { id: 2, name: '나무 연구소', wall: '#efe4d3', wall2: '#e3d4bf', wallB1: '#cbbfae', slab: '#ddd2c2', edge: '#353c44', pillar: '#c99a5c', frame: '#f7f3ec', glass: '#bfe0ee', side: '#e3d4bf', win: 'two', roof: 'flag' },
  { id: 3, name: '유리 타워', wall: '#eef3f6', wall2: '#d3e0e7', wallB1: '#bdc8ce', slab: '#f6f8f9', edge: '#2b7ea1', pillar: '#98a6ae', frame: '#98a6ae', glass: '#9fd3ea', side: 'glass', win: 'ribbon', roof: 'helipad' },
  { id: 4, name: '벽돌 학교', wall: '#f3e9d8', wall2: '#e6d8c0', wallB1: '#cbbfae', slab: '#e2d6c4', edge: '#7a3b2e', pillar: '#a8513c', frame: '#3f7a55', glass: '#cfe6ee', side: 'brick', win: 'tall', roof: 'clock' },
  { id: 5, name: '한옥 연구소', wall: '#f3ead8', wall2: '#e6d7bd', wallB1: '#cdbb9c', slab: '#d8c3a0', edge: '#3a2e26', pillar: '#7a4a2a', frame: '#5a3b24', glass: '#f6efdf', side: '#d9c3a0', win: 'tall', roof: 'giwa' },
  { id: 6, name: '우주 정거장', wall: '#eef2f6', wall2: '#dfe6ee', wallB1: '#c3ccd6', slab: '#f7f9fb', edge: '#2f3b4c', pillar: '#9aa7b8', frame: '#c7d2de', glass: '#7fd8ff', side: 'glass', win: 'round', roof: 'dish',
    ground: { grass: '#d9dee6', dirt: '#9aa3ae', dirtD: '#7f8894', leaf: '#9fd3f0', leaf2: '#7fb8e0', trunk: '#8a94a3' } },
  { id: 7, name: '겨울 눈 오두막', wall: '#f4eadb', wall2: '#e7d8c2', wallB1: '#cdbda5', slab: '#d9c6a8', edge: '#5a3e2b', pillar: '#6b4a30', frame: '#5a3e2b', glass: '#ffe3a0', side: 'logs', win: 'two', roof: 'snow',
    ground: { grass: '#f4f7fa', dirt: '#b5a48e', dirtD: '#9c8b75', leaf: '#2f6b4a', leaf2: '#e9f1f4' } },
  // 8~12번: 겉모양 자체가 다른 건물 (forms3d.js). 건물 전체 보기에서만 이 모형이고, 방 안은 2번 나무 연구소 색으로 그려요
  ...[['library', '둥근 지붕 도서관'], ['manor', '사장님 저택'], ['resort', '섬 리조트'], ['village', '작은 마을'], ['tree', '나무 위 연구소']].map(([form, name], i) => ({
    id: 8 + i, name, form, wall: '#efe4d3', wall2: '#e3d4bf', wallB1: '#cbbfae', slab: '#ddd2c2', edge: '#353c44', pillar: '#c99a5c', frame: '#f7f3ec', glass: '#bfe0ee', side: '#e3d4bf', win: 'two', roof: 'flag',
  })),
];
const theme = () => THEMES.find((x) => x.id === STATE.theme) || THEMES[0];
const P0 = { ...P }; // 땅 · 나무 기본 색 (시안이 ground 로 바꿨다가 되돌릴 때)
const bobbers = [];
const anims = []; // 매 장면마다 움직이는 것 (엘리베이터 · 회전문 · 등대 빛 · 연기 · 꽃잎). buildWorld 가 채워요

// --- 현관 · 엘리베이터 시안 5개 (?layout=1~5 로 미리 보기) ---
// shaft: 엘리베이터 자리 (center 가운데 · left 왼쪽 끝 · right 오른쪽 끝 · outside 건물 밖 오른쪽), car: 모양, entry: 현관 쪽, door: 현관 모양
const LAYOUTS = [
  { id: 1, name: '가운데 유리 엘리베이터 · 캐노피 현관', shaft: 'center', car: 'glass', entry: 'left', door: 'canopy' },
  { id: 2, name: '왼쪽 계단 코어 · 회전문 현관', shaft: 'left', car: 'core', entry: 'left', door: 'revolving' },
  { id: 3, name: '바깥 캡슐 엘리베이터 · 기둥 현관', shaft: 'outside', car: 'capsule', entry: 'left', door: 'porch' },
  { id: 4, name: '오른쪽 유리 엘리베이터 · 아치 현관', shaft: 'right', car: 'glass', entry: 'left', door: 'arch' },
  { id: 5, name: '가운데 계단 코어 · 유리 상자 현관', shaft: 'center', car: 'core', entry: 'left', door: 'glassbox' },
];
const layout = () => LAYOUTS.find((x) => x.id === STATE.layout) || LAYOUTS[0];
const shaftInside = () => layout().shaft !== 'outside';
// 한 층의 방 칸과 엘리베이터 칸 위치: { rooms: [[x0, x1], ...], shaft: [x0, x1] | null }
function slots(n) {
  const L = layout(), rw = RBW / n, left = -BW / 2;
  const at = !shaftInside() ? -1 : L.shaft === 'left' ? 0 : L.shaft === 'right' ? n : Math.ceil(n / 2);
  const rooms = [];
  for (let j = 0; j < n; j++) { const x0 = left + j * rw + (at >= 0 && j >= at ? SW : 0); rooms.push([x0, x0 + rw]); }
  return { rooms, shaft: at < 0 ? null : [left + at * rw, left + at * rw + SW] };
}

// 벽돌 · 통나무 무늬 (캔버스로 그려 반복)
const patterns = new Map();
function patternMat(kind, w, h) {
  const key = `${kind}|${w}|${h}`;
  if (patterns.has(key)) return patterns.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  let tile = 1.2;
  if (kind === 'brick') {
    g.fillStyle = '#dcccb4'; g.fillRect(0, 0, 256, 256);
    const cs = ['#b5523b', '#a8483a', '#bf5d44', '#ad4f3a'];
    for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) { g.fillStyle = cs[(r * 3 + c + 8) % 4]; g.fillRect(c * 64 + (r % 2) * 32 + 2, r * 32 + 2, 60, 28); }
  } else {
    tile = 1;
    for (let r = 0; r < 4; r++) {
      g.fillStyle = r % 2 ? '#8a5a35' : '#946240'; g.fillRect(0, r * 64, 256, 64);
      g.fillStyle = '#a77049'; g.fillRect(0, r * 64 + 6, 256, 8);
      g.fillStyle = '#5c3b22'; g.fillRect(0, r * 64 + 58, 256, 6);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(w / tile, h / tile);
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: .9 });
  patterns.set(key, m);
  return m;
}
const glassWall = new THREE.MeshStandardMaterial({ color: '#9fd3ea', transparent: true, opacity: .3, roughness: .1, metalness: .1, depthWrite: false });
const clockMat = () => memoTex('clock', drawClock);
const drawClock = () => texMat((g, w, h) => {
  g.fillStyle = '#7a3b2e'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fbfaf6'; g.beginPath(); g.arc(w / 2, h / 2, 140, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a2522';
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillRect(w / 2 + Math.sin(a) * 118 - 5, h / 2 - Math.cos(a) * 118 - 5, 10, 10); }
  g.strokeStyle = '#2a2522'; g.lineWidth = 12; g.lineCap = 'round';
  g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2, h / 2 - 90); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + 60, h / 2 + 20); g.stroke();
}, 320, 320);

function sideWall(g, sx, y, base) {
  const TH = theme(), x = sx * (BW / 2 + .12), cy = y + FH / 2 - .15;
  if (!base && TH.side === 'glass') {
    B(g, .1, FH, D + .3, '#9fd3ea', x, cy, .15, { m: glassWall, shadow: false });
    for (const z of [-D / 2, 0, D / 2]) B(g, .2, FH, .2, TH.pillar, x, cy, z);
    B(g, .2, .2, D + .3, TH.pillar, x, y + FH - .3, .15);
  } else if (!base && (TH.side === 'brick' || TH.side === 'logs')) {
    B(g, .25, FH, D + .3, '#ffffff', x, cy, .15, { m: patternMat(TH.side, D + .3, FH) });
  } else B(g, .25, FH, D + .3, base ? shade(TH.wallB1, -.08) : TH.side, x, cy, .15);
}
const glassMats = new Set(); // 창유리 재질 (밤에 불을 켜려고 모아 둬요)
function windows(g, cx, rw, n, y) {
  const TH = theme(), wy = y + FH * .56, zf = -D / 2 + .22, gm = mat(TH.glass, { emissive: TH.glass, emissiveIntensity: .35 });
  gm.userData.base = TH.glass;
  glassMats.add(gm);
  const pane = (x, w, h) => { B(g, w + .2, h + .2, .08, TH.frame, x, wy, zf); B(g, w, h, .04, TH.glass, x, wy, zf + .05, { m: gm }); };
  if (TH.win === 'ribbon') {
    const w = rw - 1.6;
    pane(cx, w, 1.9 * WK);
    for (let mx = cx - w / 2 + 1.5; mx < cx + w / 2 - .4; mx += 1.5) B(g, .07, 1.9 * WK, .05, TH.frame, mx, wy, zf + .08, { shadow: false });
  } else if (TH.win === 'tall') {
    const k = n === 1 ? 5 : 2, gap = (rw - 1.6) / k;
    for (let i = 0; i < k; i++) {
      const x = cx - (rw - 1.6) / 2 + gap * (i + .5);
      pane(x, 1, 2.1 * WK);
      B(g, .6, .3, .1, TH.frame, x, wy + 1.05 * WK + .2, zf);
      B(g, 1, .06, .05, TH.frame, x, wy + .2, zf + .08, { shadow: false });
    }
  } else if (TH.win === 'round') {
    const k = n === 1 ? 4 : 2, gap = (rw - 2) / k;
    for (let i = 0; i < k; i++) {
      const x = cx - (rw - 2) / 2 + gap * (i + .5);
      B(g, 1.7 * WK, 1.7 * WK, .1, TH.frame, x, wy, zf);
      B(g, 1.3 * WK, 1.3 * WK, .04, TH.glass, x, wy, zf + .06, { m: gm });
      B(g, .08, 1.3 * WK, .05, TH.frame, x, wy, zf + .09, { shadow: false });
      B(g, 1.3 * WK, .08, .05, TH.frame, x, wy, zf + .09, { shadow: false });
    }
  } else {
    for (const wx of n === 1 ? [cx - 3, cx + 3] : [cx]) {
      pane(wx, 1.9 * WK, 1.5 * WK);
      B(g, .06, 1.5 * WK, .05, TH.frame, wx, wy, zf + .08, { shadow: false });
    }
  }
}
// W: 꾸밈을 올릴 지붕 너비 (펜트하우스가 있으면 펜트하우스 지붕)
function roofExtras(roofY, W = BW) {
  const TH = theme();
  flag = null;
  const pole = (x, z) => { B(world, .1, 3, .1, P.metal, x, roofY + 1.6, z); flag = B(world, 1.2, .7, .05, P.red, x + .65, roofY + 2.7, z); };
  if (TH.roof === 'flag') {
    B(world, 3, 1, 2, P.steel, -6, roofY + .6, -1);
    B(world, 2.6, .1, 1.6, shade(P.steel, -.25), -6, roofY + 1.12, -1);
    pole(W / 2 - 1, 1.5);
  } else if (TH.roof === 'helipad') {
    B(world, 6, .06, 4.4, '#3a4148', 4, roofY + .13, .1);
    B(world, .35, .03, 2.2, P.gold, 3.2, roofY + .17, .1); B(world, .35, .03, 2.2, P.gold, 4.8, roofY + .17, .1); B(world, 1.6, .03, .35, P.gold, 4, roofY + .17, .1);
    B(world, .14, 4.2, .14, P.metal, -7, roofY + 2.2, -1.5);
    B(world, .3, .3, .3, P.red, -7, roofY + 4.4, -1.5, { m: mat(P.red, { emissive: P.red, emissiveIntensity: .8 }) });
    B(world, 3, 1.2, 2, P.steel, -4, roofY + .7, -1);
  } else if (TH.roof === 'clock') {
    const cx = layout().shaft === 'center' && !HAS_PH ? -8 : 0; // 가운데 엘리베이터 기계실과 겹치지 않게
    B(world, 3.4, 3.4, 2.6, '#ffffff', cx, roofY + 1.8, -1.2, { m: patternMat('brick', 3.4, 3.4) });
    const f = new THREE.Mesh(UNIT, clockMat()); f.scale.set(2.2, 2.2, .05); f.position.set(cx, roofY + 2, .12); world.add(f);
    B(world, 3.9, .4, 3.1, TH.edge, cx, roofY + 3.7, -1.2);
    B(world, 2.8, .7, 2.1, '#7a3b2e', cx, roofY + 4.25, -1.2);
    B(world, 1.5, .7, 1.1, '#7a3b2e', cx, roofY + 4.95, -1.2);
    B(world, .5, .5, .5, P.gold, cx, roofY + 5.5, -1.2);
  } else if (TH.roof === 'giwa') { // 한옥: 겹겹이 쌓은 기와지붕 + 들린 처마 끝 + 용마루
    for (let k = 0; k < 4; k++) B(world, W + 2.6 - k * 3.2, .36, D + 2.4 - k * 1.1, k % 2 ? '#56616b' : '#4a545e', 0, roofY + .3 + k * .36, .15);
    B(world, W - 10, .32, .5, '#2f363d', 0, roofY + 1.75, .15);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(world, .7, .32, .7, '#4a545e', sx * (W / 2 + 1.1), roofY + .62, .15 + sz * (D / 2 + .95));
  } else if (TH.roof === 'dish') { // 우주 정거장: 태양광 판 · 위성 안테나 · 깜빡이는 불빛
    for (let i = 0; i < 3; i++) { const s = B(world, 2.3, .08, 1.8, '#2a3f73', 1.2 + i * 2.6, roofY + .7, -.6); s.rotation.x = -.45; B(world, .1, .6, .1, P.metal, 1.2 + i * 2.6, roofY + .35, -.6); }
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.7, .35, .6, 18), mat('#e9eef3'));
    dish.position.set(-W / 2 + 3, roofY + 2, -.5); dish.rotation.z = .6; dish.castShadow = true; world.add(dish);
    B(world, .2, 1.6, .2, P.metal, -W / 2 + 3, roofY + .8, -.5);
    B(world, .08, 3.4, .08, P.metal, -W / 2 + .8, roofY + 1.7, -1);
    const blink = new THREE.MeshStandardMaterial({ color: P.red, emissive: P.red, emissiveIntensity: 1 });
    B(world, .3, .3, .3, P.red, -W / 2 + .8, roofY + 3.5, -1, { m: blink });
    anims.push((t) => { blink.emissiveIntensity = Math.sin(t * 4) > 0 ? 1.2 : .1; });
  } else if (TH.roof === 'snow') { // 겨울: 눈 덮인 지붕 · 고드름 · 굴뚝 연기
    B(world, W + .9, .4, D + .7, '#ffffff', 0, roofY + .4, .15);
    if (HAS_PH) B(world, BW + .4, .2, D + .3, '#ffffff', 0, ROOF_Y + .1, .15); // 테라스에도 눈
    for (let x = -W / 2; x < W / 2; x += 1.3) B(world, .14, .25 + ((x * 7) % 3 + 3) % 3 * .12, .14, '#e6f3fa', x, roofY - .25, D / 2 + .4, { shadow: false });
    B(world, 1, 2.2, 1, '#8a4b3a', 7, roofY + 1.3, -1.2); B(world, 1.2, .3, 1.2, '#ffffff', 7, roofY + 2.5, -1.2);
    const puffs = [0, 1, 2].map(() => B(world, .5, .5, .5, '#e9eef1', 7, roofY + 2.8, -1.2, { shadow: false }));
    anims.push((t) => puffs.forEach((m, i) => { const k = (t * .35 + i / 3) % 1; m.position.y = roofY + 2.8 + k * 2.4; m.position.x = 7 + k * .8; m.scale.setScalar(.5 + k * .9); m.visible = k < .92; }));
  } else if (TH.roof === 'garden') {
    B(world, W + .1, .16, D + .1, P.grass, 0, roofY + .18, .15);
    const tree = (x, z, s) => { B(world, .3 * s, 1.2 * s, .3 * s, P.trunk, x, roofY + .25 + .6 * s, z); B(world, 1.4 * s, 1.1 * s, 1.4 * s, P.leaf, x, roofY + .25 + 1.6 * s, z); B(world, .9 * s, .8 * s, .9 * s, P.leaf2, x, roofY + .25 + 2.4 * s, z); };
    tree(-7, -1, 1); tree(6.5, -1.3, .85);
    for (let i = 0; i < 4; i++) { B(world, 1.2, .4, .5, P.wood, -2.4 + i * 1.6, roofY + .45, 1.6); B(world, 1, .35, .4, ['#f28fad', '#f7c873', '#ffffff', '#b9a3e3'][i], -2.4 + i * 1.6, roofY + .8, 1.6); }
    // 앞 모서리를 타고 내려오는 덩굴
    for (const sx of [-1, 1]) for (let yy = ROOF_Y + .3, i = 0; yy > 1; yy -= .45, i++) {
      if ((i * 7 + (sx > 0 ? 3 : 0)) % 5 === 4) continue;
      B(world, .35, .4, .35, i % 2 ? P.leaf : P.leaf2, sx * (BW / 2 + .32) + (i % 3) * .06 * sx, yy, D / 2 + .1 - (i % 2) * .25);
    }
  }
}
const roomBoxes = [];
const labelItems = [];
const world = new THREE.Group();
scene.add(world);
let flag;

function furnish(k, g, { x0, x1, cx, y }) {
  const zb = -D / 2 + .55, zw = -D / 2 + .13;
  const sid = STATE.assign[k], sd = staffById(sid).def;
  DESK = sd().desk;
  const worker = (x, z, role = 'desk', o = {}) => addChar(g, x, y, z, role, { def: sd(), info: staffInfo(sid, k), ...o });
  if (TOOL_FURN[k]) { roomTools(k, g, { cx, y }, worker); return; } // 방마다 분류 가구 (2026-10-30)
  switch (k) {
    // 방 한 칸 = 너비 10 (x0 ~ x1). 예전에 한 층을 혼자 쓰던 사장실 · 접수처 · 보관실도 한 칸에 맞췄어요
    case 'boss': {
      standBoard(g, cx - 3.2, y, zb + .3, checklist('다가오는 일정', [['연수 4차', true], ['공개수업 참관', true], ['과제 지도안', false], ['성찰 정리', false], ['결과 보고', false]]));
      desk(g, cx + .6, y, -.6, { h: .98 });
      shelf(g, cx + 2.9, y, zb, 1.3, 2.2, 3);
      shelf(g, cx + 4.2, y, zb, 1.1, 2.2, 7);
      lamp(g, cx - 1.6, y, zb);
      plant(g, x0 + .6, y, 1.7, true);
      plant(g, x1 - .6, y, 1.7, true);
      wallBoard(g, cx + .6, y + 2.2, zw, 1.3, .9, posterMat('D-7', P.red));
      const me = ME.find((m) => m.id === STATE.me) || ME[0];
      const fr = friendById(STATE.friend);
      const sm = addChar(g, cx - 2.6, y, 1.2, 'me', { def: me.def(), hold: me.hold, face: .12, info: meInfo() });
      sm.staticMe = true;   // 방 화면에서 내가 걸어 다닐 때는 이 사장님은 숨겨요 (둘이 되지 않게)
      const f = addChar(g, cx - .9, y + fr.lift, 1.35, fr.move, { def: fr.def(), face: -.3, info: friendInfo(fr.id) });
      if (fr.id === 9) f.flapGhost = true;
      ROOMS.boss.focus = { x: cx - 1.7, y: y + 1.35 };
      furnHit(g, 'boss', 'cal', cx - 3.2, y, zb + .3, 1.6, 2.2, 1);     // 일정 보드
      furnHit(g, 'boss', 'desk', cx + .6, y, -.6, 2.2, 1.4, 1.4);       // 책상
      furnHit(g, 'boss', 'mon', cx + .6, y + 1.4, zw + .3, 1.6, 1.4, .8); // 벽 모니터(D-7)
      furnHit(g, 'boss', 'shelf', cx + 2.9, y, zb, 1.4, 2.3, .9);       // 책장
      furnHit(g, 'boss', 'file', cx + 4.2, y, zb, 1.2, 2.3, .9);        // 서류장
      break;
    }
    // 연수 기록실 · 링크 서재 · 도덕교과실 · 지도안 · 과제 · 접수처 · 보관실 · AI 교육 · 보안실은 위 roomTools (분류 가구)
    case 'others':
      library(g, { cx, y }, worker);
      break;
    default:
      if (ROOMS[k]?.store) { storeRoom(g, k, { x0, x1, cx, y }); break; }
      // rooms.js 에 새로 넣은 방: 책상 · 직원 · 책장으로 기본 꾸밈
      desk(g, cx - 1.6, y, .8); worker(cx - 1.6, 0);
      shelf(g, x1 - 1.2, y, zb, 1.3, 2.1, k.length * 7);
      plant(g, x0 + .6, y, 1.7);
      break;
  }
}

// ---------- 엘리베이터 칸 (층마다): 승강로 벽 · 레일 · 앞쪽 승강장 · 계단(코어형) ----------
// ---------- 타교과실 = 수업 공개 도서관: 책장 하나 = 교과 묶음, 책 한 권 = 공개수업 하나 (2026-10-29 B형) ----------
// 책을 누르면 그 방 직원(사서)이 책장으로 걸어가 꺼내 와서 열람대 위에 펼쳐요. 책은 앱이 setLibrary 로 넣어요
const LIB_SHELVES = ['사회·역사·윤리', '정보·인공지능', '국어·영어', '수학', '과학', '그 밖의 교과'];
// 위에서부터 맞춰 봐요 ('인공지능 수학'은 수학, '정보과학'은 정보)
const LIB_MATCH = [[3, /수학|미적분|기하/], [1, /정보|소프트웨어|데이터|인공지능|코딩/], [4, /과학|물리|화학|생명|지구/], [0, /윤리|도덕|사회|역사|종교|철학/], [2, /국어|문학|영어/]];
const LIB_COLOR = ['#8c4f5e', '#3c6688', '#6f7f3c', '#9a6c3a', '#3e7f75', '#6d5a90'];
const LIB_TAG = { 윤리: '#e0709b', 바이브코딩: '#3fbf8c', 독서: '#f0c040' }; // 책 허리띠 색
const libShelf = (sub) => (LIB_MATCH.find(([, re]) => re.test(sub || '')) || [5])[0];
const libTags = (l) => [
  (l.shelf === 0 || /윤리|인권|가치|문답|정서|문명/.test(l.title)) && '윤리',
  /바이브/.test(l.title) && '바이브코딩',
  /독서|소설/.test(l.title) && '독서',
].filter(Boolean);
let LIB_DATA = [];
const LIB = { key: '', list: [], books: [], shelves: null, keeper: null, fetch: null, openL: null, openId: '' };
const LIB_SW = 1.45, LIB_SH = 2.8, LIB_RH = (LIB_SH - .06) / 4;
const libSign = (name, n) => memoTex(`lib|${name}|${n}`, () => texMat((g, w, h) => {
  g.fillStyle = '#2d3a46'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c9a76a'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#f5efe2'; g.font = `${name.length > 6 ? 46 : 54}px ${FONT}`; g.fillText(name, w / 2, h / 2 - 14);
  g.fillStyle = '#c9a76a'; g.font = `32px ${FONT}`; g.fillText(`${n}권`, w / 2, h / 2 + 38);
}, 512, 140));
function library(g, { cx, y }, worker) {
  const zb = -D / 2 + .55, SD = .46;
  const sx = (i) => cx - 4.05 + i * 1.62;
  LIB.shelves = LIB_SHELVES.map((name, i) => {
    const s = new THREE.Group();
    s.position.set(sx(i), y, zb);
    g.add(s);
    B(s, LIB_SW, LIB_SH, .05, P.woodD, 0, LIB_SH / 2, -SD / 2);
    for (const k of [-1, 1]) B(s, .07, LIB_SH, SD, P.wood, k * (LIB_SW / 2 - .035), LIB_SH / 2, 0);
    for (let r = 0; r <= 4; r++) B(s, LIB_SW, .06, SD, P.wood, 0, .03 + r * LIB_RH, 0);
    // 맨 아래 칸은 상자 · 잡지 (책은 위 세 칸에)
    if (i % 2) for (let k = 0; k < 4; k++) B(s, .5, .05, .34, ['#d9c9a8', '#a9b8c8', '#c8a9a9', '#b7c8a9'][k], -.3, .09 + k * .055, 0);
    else B(s, .5, .4, .36, P.crate, .3, .26, 0);
    const sign = new THREE.Mesh(UNIT, libSign(name, 0));
    sign.scale.set(1.32, .36, .04);
    sign.position.set(0, LIB_SH + .3, -.12);
    s.add(sign);
    const books = new THREE.Group();
    s.add(books);
    return { name, sign, books };
  });
  // 열람대: 펼친 책 한 권
  const dz = 1.55;
  B(g, 2.1, .1, 1, P.wood, cx, y + .8, dz);
  for (const a of [-1, 1]) for (const b of [-1, 1]) B(g, .09, .76, .09, P.woodD, cx + a * .95, y + .38, dz + b * .4);
  B(g, 1.62, .05, 1, '#5b3a52', cx, y + .875, dz);
  LIB.cv = document.createElement('canvas');
  LIB.cv.width = 1024; LIB.cv.height = 640;
  LIB.tex = new THREE.CanvasTexture(LIB.cv);
  LIB.tex.colorSpace = THREE.SRGBColorSpace;
  const page = new THREE.Mesh(new THREE.PlaneGeometry(1.52, .95), new THREE.MeshStandardMaterial({ map: LIB.tex, roughness: .9, emissive: '#ffffff', emissiveMap: LIB.tex, emissiveIntensity: .3 }));
  page.rotation.x = -Math.PI / 2 + .55;
  page.position.set(cx, y + 1.06, dz + .04);
  g.add(page);
  plant(g, cx - 4.3, y, 1.9);
  // 사서: 그 방에 배치한 직원. 열람대 오른쪽에 서 있다가 책을 가지러 가요
  const c = worker(cx + 1.75, 1.25, 'librarian', { face: -.35 });
  c.home = { x: cx + 1.75, z: 1.25, face: -.35 };
  c.go = null;
  const tall = new THREE.Box3().setFromObject(c.root).max.y - c.root.position.y; // 직원마다 키가 달라서 손 높이에 맞춰 들어요
  c.carry = B(c.root, .32, .1, .24, '#555555', 0, tall * .45, .34, { m: new THREE.MeshStandardMaterial({ color: '#555555', roughness: .8 }) });
  c.carry.visible = false;
  LIB.keeper = c;
  LIB.sx = sx; LIB.zTake = zb + .85; LIB.fetch = null; LIB.openL = null;
  // 펼친 책 위 말풍선 (글씨는 3D보다 HTML 이 또렷해요)
  LIB.cap = document.createElement('div');
  LIB.cap.className = 'libcap';
  LIB.cap.dataset.room = 'others';
  LIB.cap.hidden = true;
  labelsEl.append(LIB.cap);
  labelItems.push({ el: LIB.cap, pos: new THREE.Vector3(cx, y + 1.55, dz) });
  libFill();
}
function libFill() {
  if (!LIB.shelves) return;
  const seen = new Set();
  const list = LIB_DATA.filter((c) => { const k = `${c.subject}|${c.title}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .map((c) => ({ ...c, shelf: libShelf(c.subject) }));
  list.forEach((l) => { l.tags = libTags(l); });
  LIB.books = [];
  LIB.shelves.forEach((sh, i) => {
    sh.books.traverse((o) => { if (o.material?.userData.lib) o.material.dispose(); });
    sh.books.clear();
    const mine = list.filter((l) => l.shelf === i).sort((a, b) => a.subject.localeCompare(b.subject, 'ko'));
    sh.sign.material = libSign(sh.name, mine.length);
    const perRow = Math.max(1, Math.ceil(mine.length / 3));
    const bwMax = Math.min(.17, (LIB_SW - .2) / perRow - .015);
    const rowX = [0, 0, 0].map(() => -LIB_SW / 2 + .1);
    let k = i * 37 + 11;
    const rnd = () => (k = (k * 9301 + 49297) % 233280) / 233280;
    mine.forEach((l, n) => {
      const r = 3 - Math.floor(n / perRow); // 위 칸(3)부터 채워요
      const bw = bwMax * (.8 + rnd() * .2), bh = LIB_RH * (.6 + rnd() * .25), bd = .3;
      const color = shade(LIB_COLOR[i], (rnd() - .5) * .3);
      const book = new THREE.Group();
      book.position.set(rowX[r - 1] + bw / 2, .06 + r * LIB_RH, .03);
      rowX[r - 1] += bw + .015;
      const m = new THREE.MeshStandardMaterial({ color, roughness: .8 });
      m.userData.lib = true;
      const spine = B(book, bw, bh, bd, color, 0, bh / 2, 0, { m });
      B(book, bw + .004, .025, bd + .004, '#e9dcc0', 0, bh - .05, 0, { shadow: false });
      l.tags.forEach((t, ti) => B(book, bw + .006, .05, bd + .008, LIB_TAG[t], 0, bh * .36 - ti * .07, 0, { shadow: false }));
      spine.userData.lesson = l;
      Object.assign(l, { book, spine, color, pull: 0, goal: 0 });
      sh.books.add(book);
      LIB.books.push(spine);
    });
  });
  LIB.list = list;
  LIB.fetch = null;
  if (LIB.keeper) { LIB.keeper.go = null; LIB.keeper.carry.visible = false; }
  const open = list.find((l) => l.id === LIB.openId);
  if (open) open.book.visible = false;
  libOpen(open || null);
}
function libWrap(g, text, maxW) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    if (line && g.measureText(line + ch).width > maxW) { lines.push(line.trim()); line = ch; } else line += ch;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}
function libOpen(l) {
  LIB.openL = l;
  LIB.openId = l?.id || '';
  const g = LIB.cv.getContext('2d'), w = LIB.cv.width, h = LIB.cv.height;
  g.fillStyle = '#f7f1e3'; g.fillRect(0, 0, w, h);
  const fold = g.createLinearGradient(w / 2 - 40, 0, w / 2 + 40, 0);
  fold.addColorStop(0, 'rgba(0,0,0,0)'); fold.addColorStop(.5, 'rgba(0,0,0,.18)'); fold.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fold; g.fillRect(w / 2 - 40, 0, 80, h);
  g.textBaseline = 'top';
  if (!l) {
    g.textAlign = 'center'; g.fillStyle = '#3a2f28'; g.font = `52px ${FONT}`;
    g.fillText('책장에서', w / 4, h / 2 - 64); g.fillText('책을 골라 보세요', w / 4, h / 2);
    g.fillStyle = '#8a7a6a'; g.font = `38px ${FONT}`; g.fillText('사서가 가져다줘요', w * .75, h / 2 - 24);
  } else {
    g.textAlign = 'left';
    g.fillStyle = '#8a7a6a'; g.font = `34px ${FONT}`; g.fillText(LIB_SHELVES[l.shelf], 50, 60);
    g.fillStyle = '#3a2f28'; g.font = `${l.subject.length > 6 ? 56 : 76}px ${FONT}`; g.fillText(l.subject || '교과 미기재', 50, 116);
    g.fillStyle = LIB_COLOR[l.shelf]; g.fillRect(50, 226, 120, 8);
    l.tags.forEach((t, i) => { g.fillStyle = LIB_TAG[t]; g.fillRect(50, 290 + i * 66, 220, 50); g.fillStyle = '#ffffff'; g.font = `32px ${FONT}`; g.fillText(t, 66, 298 + i * 66); });
    g.fillStyle = '#3a2f28'; g.font = `50px ${FONT}`;
    libWrap(g, l.title, w / 2 - 110).slice(0, 7).forEach((ln, i) => g.fillText(ln, w / 2 + 55, 70 + i * 72));
  }
  LIB.tex.needsUpdate = true;
  LIB.cap.hidden = !l;
  if (l) { const sm = document.createElement('small'); sm.textContent = l.subject || '교과 미기재'; LIB.cap.replaceChildren(sm, l.title); }
}
// 사서에게 책 심부름 시키기 (가는 중에 다른 책을 누르면 그 책으로 바꿔요)
function libFetch(l) {
  const c = LIB.keeper;
  if (LIB.fetch?.l === l || (!LIB.fetch && LIB.openL === l)) return;
  for (const x of [LIB.fetch?.l, LIB.openL]) if (x) { x.book.visible = true; x.goal = 0; }
  l.goal = 1;
  if (!c) { l.book.visible = false; libOpen(l); return; }
  c.carry.visible = false;
  c.go = { x: LIB.sx(l.shelf), z: LIB.zTake, face: Math.PI };
  LIB.fetch = { l, phase: 'go', wait: 0 };
  LIB.cap.hidden = false;
  LIB.cap.replaceChildren('사서가 가지러 갔어요…');
}
function stepLibrary(dt) {
  for (const l of LIB.list) {
    if (!l.book) continue;
    l.pull += (l.goal - l.pull) * Math.min(1, dt * 9);
    l.book.position.z = .03 + l.pull * .2;
  }
  const f = LIB.fetch, c = LIB.keeper;
  if (!f || !c) return;
  const at = (p) => Math.hypot(p.x - c.root.position.x, p.z - c.root.position.z) < .06;
  if (f.phase === 'go' && at(c.go)) { f.phase = 'take'; f.wait = .45; }
  else if (f.phase === 'take' && (f.wait -= dt) <= 0) {
    f.l.book.visible = false;
    c.carry.material.color.set(f.l.color);
    c.carry.visible = true;
    c.go = null;
    f.phase = 'back';
  } else if (f.phase === 'back' && at(c.home)) {
    c.carry.visible = false;
    LIB.fetch = null;
    libOpen(f.l);
  }
}
// 지금 도서관 안을 보고 있을 때만 책을 고를 수 있어요 (건물 전체 보기에서는 책이 너무 작아요)
const libActive = () => LIB.books.length && selected === 'others' && (mode !== 'band' || bandRooms.includes('others'));
function pickBook() { // pick(e) 가 광선을 맞춘 뒤에 불러요
  if (!libActive()) return null;
  return ray.intersectObjects(LIB.books.filter((s) => s.parent.visible), false)[0]?.object.userData.lesson || null;
}
let libHovered = null;
function libHover(l) {
  if (libHovered === l) return;
  libHovered?.spine.material.emissive.set('#000000');
  l?.spine.material.emissive.set('#3a3020');
  libHovered = l;
}

// ---------- 방마다 분류 가구 (2026-10-30 시안): 가구 한 칸 = 분류. 칸을 누르면 그 방 직원이 가서 꺼내 와 책상에 펼쳐요 ----------
// 자료는 앱이 setRoomData({ cards, caps }) 로 넣어요. 칸 이름 · 수가 바뀌면 건물을 다시 그려요
let ROOM_DATA = { cards: [], caps: [] };
const TOOL_FURN = { train: 'cabinet', links: 'catalog', task: 'kanban', aiedu: 'rack', moral: 'board', plans: 'binder', security: 'safe', lobby: 'mailbox', archive: 'boxes' };
const TOOL_COLOR = { train: '#c99a5c', links: '#8e6640', task: '#e3b23a', aiedu: '#2f9c8f', moral: '#2f8a5f', plans: '#6e5ea0', security: '#e0693f', lobby: '#e0693f', archive: '#8e6640' };
const seoulDay = (d = new Date()) => new Date(d.getTime() + 9 * 36e5).toISOString().slice(0, 10);
const addDay = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
// 방마다 칸 나누기: [[칸 이름, 카드 목록], …] (빈 칸도 이름은 보여요)
function toolUnits(k) {
  const all = ROOM_DATA.cards, mine = all.filter((c) => c.room === k), today = seoulDay();
  const take = (list, re, used = []) => list.filter((c) => !used.includes(c) && re.test(`${c.kind} ${c.title} ${c.subject}`));
  const restOf = (list, used) => list.filter((c) => !used.includes(c));
  switch (k) {
    case 'train': {
      const done = take(mine, /이수증/), doneT = done.map((c) => c.title.slice(0, 8));
      const go = mine.filter((c) => /대상자/.test(c.kind) && !doneT.includes(c.title.slice(0, 8)) && !done.includes(c));
      const apply = take(mine, /신청/, [...done, ...go]);
      return [['이수 완료', done], ['대상자 · 진행', go], ['신청함', apply], ['안내만', restOf(mine, [...done, ...go, ...apply])]];
    }
    case 'links': {
      const cats = {};
      mine.forEach((c) => { (cats[c.category || '그 밖'] ||= []).push(c); });
      const list = Object.entries(cats).sort((a, b) => b[1].length - a[1].length);
      return list.length ? list.slice(0, 5) : [['연수 사이트', []], ['수업 도구', []], ['포털', []]];
    }
    case 'task': {
      const soon = mine.filter((c) => c.date && c.date >= today && c.date <= addDay(today, 3)), later = mine.filter((c) => c.date > addDay(today, 3));
      const past = mine.filter((c) => c.date && c.date < today);
      return [['3일 안', soon], ['앞으로', later], ['날짜 없음', mine.filter((c) => !c.date)], ['지난 과제', past]];
    }
    case 'aiedu': {
      const lesson = take(mine, /특강|수업|강좌|바이브|동아리|방과후/), brief = take(mine, /브리핑/, lesson);
      return [['내 특강 · 수업', lesson], ['AI교육 브리핑', brief], ['정책 · 포털', restOf(mine, [...lesson, ...brief])]];
    }
    case 'moral': {
      const thought = take(mine, /윤리와 사상|사상|소크라테스/), soc = take(mine, /통합사회|정의|사회/, thought), life = take(mine, /생활과 윤리/, [...thought, ...soc]);
      return [['윤리와 사상', thought], ['통합사회 · 윤리', soc], ['생활과 윤리', life], ['그 밖', restOf(mine, [...thought, ...soc, ...life])]];
    }
    case 'plans': {
      const debate = take(mine, /토론|논증|토의|문답/), proj = take(mine, /프로젝트|탐구/, debate), ai = take(mine, /AI|인공지능|디지털|에듀테크|웹앱/, [...debate, ...proj]);
      return [['토론 · 논증', debate], ['프로젝트 · 탐구', proj], ['AI · 디지털 도구', ai], ['그 밖', restOf(mine, [...debate, ...proj, ...ai])]];
    }
    case 'security': {
      const soon = mine.filter((c) => c.date && c.date >= today && c.date <= addDay(today, 3)), month = mine.filter((c) => c.date > addDay(today, 3));
      return [['기한 3일 안', soon], ['앞으로 할 일', month], ['지난 · 참고', restOf(mine, [...soon, ...month])]];
    }
    case 'lobby': {
      const r = (...ks) => all.filter((c) => ks.includes(c.room) && c.status !== 'review');
      return [['확인 전', all.filter((c) => c.status === 'review')], ['연수', r('train', 'task', 'links')], ['수업 공개', r('moral', 'others', 'plans')], ['AI 교육', r('aiedu')], ['보안', r('security')]];
    }
    case 'archive': {
      const months = {};
      ROOM_DATA.caps.forEach((c) => { (months[(c.at || '').slice(0, 7) || '날짜 없음'] ||= []).push({ title: c.name || '자료' }); });
      const list = Object.entries(months).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 4).map(([m, l]) => [m.length === 7 ? `${+m.slice(5)}월` : m, l]);
      return list.length ? list : [[`${+today.slice(5, 7)}월`, []]];
    }
  }
  return [];
}
// 가구 모양 (칸 하나). n = 그 칸의 자료 수, c = 방 색
const TOOL_BUILD = {
  cabinet(g, n, c) { B(g, 1.3, 2.2, .6, '#8a8f96', 0, 1.1, 0); for (let i = 0; i < 4; i++) { B(g, 1.16, .46, .05, '#a9b0b8', 0, .35 + i * .5, .31); B(g, .3, .05, .05, '#5d646b', 0, .45 + i * .5, .35); } for (let i = 0; i < Math.min(n, 8); i++) B(g, .9, .03, .4, i % 2 ? P.paper : c, 0, 2.23 + i * .035, 0); },
  catalog(g, n, c) { B(g, 1.4, 1.1, .6, '#9b6b44', 0, .55, 0); for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) B(g, .28, .26, .05, '#c99a5c', -.48 + k * .32, .2 + r * .32, .31); for (let i = 0; i < Math.min(n, 10); i++) B(g, .06, .3, .2, i % 3 ? P.paper : c, -.5 + i * .11, 1.25, 0); },
  kanban(g, n) { B(g, 1.4, 1.6, .06, '#f7f3ec', 0, 1.7, -.2); B(g, 1.5, .06, .1, '#7a5232', 0, .88, -.18); const cols = ['#ffe08a', '#a7d8f0', '#c8e6a0', '#f4b6c2']; for (let i = 0; i < Math.min(n, 9); i++) B(g, .28, .24, .02, cols[i % 4], -.45 + (i % 3) * .45, 2.25 - Math.floor(i / 3) * .32, -.15); for (const s of [-1, 1]) B(g, .1, .9, .1, '#7a5232', s * .6, .45, -.18); },
  rack(g, n, c) { B(g, 1.1, 2.4, .7, '#26313a', 0, 1.2, 0); for (let i = 0; i < 6; i++) { B(g, .96, .3, .05, '#3a4652', 0, .3 + i * .36, .36); B(g, .06, .06, .02, '#55636d', .38, .3 + i * .36, .39, { m: new THREE.MeshBasicMaterial({ color: i < n ? c : '#55636d' }) }); } },
  board(g, n) { B(g, 1.45, 1.1, .06, '#1f3a2e', 0, 1.75, -.2); B(g, 1.55, .08, .12, '#8a5d3b', 0, 1.17, -.16); for (let i = 0; i < Math.min(n, 4); i++) B(g, .4, .3, .02, '#fbf6e9', -.4 + (i % 2) * .8, 1.95 - Math.floor(i / 2) * .4, -.16); B(g, .7, 1, .45, '#9b6b44', 0, .5, .35); },
  binder(g, n, c) { B(g, 1.4, 2.2, .45, '#8a5d3b', 0, 1.1, 0); for (let r = 0; r < 3; r++) B(g, 1.3, .05, .42, '#a77a4a', 0, .5 + r * .62, 0); for (let i = 0; i < Math.min(n, 12); i++) B(g, .1 + (i % 2) * .04, .5, .34, i % 2 ? c : '#3c6688', -.55 + (i % 8) * .15, .79 + Math.floor(i / 8) * .62, .02); },
  safe(g, n, c) { B(g, 1.2, 1.3, .9, '#5d646b', 0, .65, 0); B(g, 1.06, 1.16, .05, '#7d878f', 0, .65, .46); const d = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .06, 20), mat('#c9ced3')); d.rotation.x = Math.PI / 2; d.position.set(0, .75, .5); g.add(d); B(g, .16, .16, .02, '#55636d', .4, 1.15, .5, { m: new THREE.MeshBasicMaterial({ color: n ? c : '#55636d' }) }); },
  mailbox(g, n) { B(g, 1.1, 1.3, .5, '#c99a5c', 0, 1.35, 0); B(g, .96, 1.16, .02, '#7a5232', 0, 1.35, .26); for (let i = 0; i < Math.min(n, 12); i++) B(g, .7, .04, .35, i % 2 ? '#fbf6e9' : '#e6dcc8', 0, .82 + i * .07, .05); B(g, .1, .7, .1, '#7a5232', 0, .35, 0); },
  boxes(g, n) { for (let i = 0; i < Math.max(1, Math.min(4, Math.ceil(n / 15))); i++) B(g, 1.1 - (i % 2) * .1, .5, .7, i % 2 ? P.crate : P.crateD, 0, .26 + i * .51, 0); B(g, .5, .16, .02, P.paper, 0, .3, .36); },
};
const toolSign = (name, n) => memoTex(`tool|${name}|${n}`, () => texMat((g, w, h) => {
  g.fillStyle = '#2d3a46'; g.fillRect(0, 0, w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#f5efe2'; g.font = `${name.length > 6 ? 44 : 52}px ${FONT}`; g.fillText(name, w / 2, h / 2 - 16);
  g.fillStyle = '#c9a76a'; g.font = `32px ${FONT}`; g.fillText(`${n}건`, w / 2, h / 2 + 38);
}, 512, 150));
const TOOLS = {}; // 방 key → { units, hits, keeper, paper, cap, fetch }
function roomTools(k, g, { cx, y }, worker) {
  const units = toolUnits(k), n = units.length, gap = Math.min(1.9, 8.4 / n), x0 = cx - ((n - 1) * gap) / 2, zb = -D / 2 + .85;
  const T = (TOOLS[k] = { units, hits: [], fetch: null });
  units.forEach(([name, list], i) => {
    const u = new THREE.Group();
    u.position.set(x0 + i * gap, y, zb);
    g.add(u);
    TOOL_BUILD[TOOL_FURN[k]](u, list.length, TOOL_COLOR[k]);
    const wall = TOOL_FURN[k] === 'kanban' || TOOL_FURN[k] === 'board', low = TOOL_FURN[k] === 'safe' || TOOL_FURN[k] === 'catalog';
    const sign = new THREE.Mesh(UNIT, toolSign(name, list.length));
    sign.scale.set(Math.min(1.3, gap * .85), .38, .04);
    sign.position.set(0, low ? 1.75 : 2.85, wall ? -.1 : .35);
    u.add(sign);
    const hit = new THREE.Mesh(UNIT, new THREE.MeshBasicMaterial({ visible: false }));
    hit.scale.set(gap * .9, 2.9, 1.3);
    hit.position.set(0, 1.45, .1);
    hit.userData.tool = i;
    u.add(hit);
    T.hits.push(hit);
  });
  // 일하는 자리: 앞쪽 책상 (꺼내 온 자료를 여기에 펼쳐요)
  B(g, 2, .1, .9, P.wood, cx + .6, y + .78, 1.6);
  for (const a of [-1, 1]) for (const b of [-1, 1]) B(g, .08, .75, .08, P.woodD, cx + .6 + a * .9, y + .38, 1.6 + b * .38);
  B(g, .7, .45, .05, P.screen, cx + .9, y + 1.2, 1.35); B(g, .64, .39, .02, P.monitor, cx + .9, y + 1.2, 1.38, { shadow: false });
  T.paper = B(g, .5, .02, .36, P.paper, cx + .2, y + .84, 1.65);
  T.paper.visible = false;
  const c = worker(cx + 1.9, 1.3, 'librarian', { face: -.35 });
  c.home = { x: cx + 1.9, z: 1.3, face: -.35 };
  c.go = null;
  const tall = new THREE.Box3().setFromObject(c.root).max.y - c.root.position.y;
  c.carry = B(c.root, .32, .1, .24, P.paper, 0, tall * .45, .34, { m: new THREE.MeshStandardMaterial({ color: P.paper, roughness: .8 }) });
  c.carry.visible = false;
  T.keeper = c;
  T.zTake = zb + .95;
  T.cap = document.createElement('div');
  T.cap.className = 'libcap';
  T.cap.dataset.room = k;
  T.cap.hidden = true;
  labelsEl.append(T.cap);
  labelItems.push({ el: T.cap, pos: new THREE.Vector3(cx + .4, y + 1.6, 1.6) });
}
const toolActive = () => TOOLS[selected] && (mode !== 'band' || bandRooms.includes(selected));
function pickTool() { // pick(e) 가 광선을 맞춘 뒤에 불러요
  if (!toolActive()) return null;
  const i = ray.intersectObjects(TOOLS[selected].hits, false)[0]?.object.userData.tool;
  return i == null ? null : { k: selected, i };
}
function toolFetch({ k, i }) {
  const T = TOOLS[k], [name, list] = T.units[i], c = T.keeper;
  T.paper.visible = false;
  c.carry.visible = false;
  c.go = { x: T.hits[i].parent.position.x, z: T.zTake, face: Math.PI };
  T.fetch = { i, phase: 'go', wait: 0 };
  T.cap.hidden = false;
  T.cap.replaceChildren(`${name} 칸으로 가지러 갔어요…`);
  if (!list.length) T.cap.replaceChildren(`${name} 칸은 비어 있어요`);
}
function stepTools(dt) {
  for (const T of Object.values(TOOLS)) {
    const f = T.fetch, c = T.keeper;
    if (!f || !c) continue;
    const at = (p) => Math.hypot(p.x - c.root.position.x, p.z - c.root.position.z) < .06;
    if (f.phase === 'go' && at(c.go)) { f.phase = 'take'; f.wait = .45; }
    else if (f.phase === 'take' && (f.wait -= dt) <= 0) { c.carry.visible = T.units[f.i][1].length > 0; c.go = null; f.phase = 'back'; }
    else if (f.phase === 'back' && at(c.home)) {
      c.carry.visible = false;
      T.fetch = null;
      const [name, list] = T.units[f.i];
      T.paper.visible = list.length > 0;
      const sm = document.createElement('small');
      sm.textContent = `${name} · ${list.length}건`;
      T.cap.replaceChildren(sm, list.length ? list.slice(0, 3).map((x) => x.title).join(' / ') : '비어 있어요');
    }
  }
}

function shaftFloor(g, [x0, x1], y, above) {
  const L = layout(), TH = theme(), cx = (x0 + x1) / 2, core = L.car === 'core';
  const h = FH - .3, cy = y + h / 2;
  for (const x of [x0, x1]) {
    B(g, .2, h, D - .8, core ? shade(TH.wall2, -.15) : TH.wall2, x, cy, -.4);
    B(g, .36, h, .36, TH.pillar, x, cy, D / 2 - .1);
  }
  B(g, SW - .2, h, .12, core ? '#5c656d' : '#34404a', cx, cy, -D / 2 + .26); // 승강로 안쪽 벽
  for (const sx of [-1, 1]) B(g, .08, FH, .08, P.metal, cx + sx * (SW / 2 - .45), y + FH / 2, -D / 2 + .45); // 레일
  if (L.car === 'glass') { // 유리 승강로: 차 앞에 유리판과 세로 틀
    B(g, SW - .3, h, .05, '#9fd3ea', cx, cy, -D / 2 + 2.25, { m: glassWall, shadow: false });
    for (const sx of [-1, 0, 1]) B(g, .06, h, .07, P.metal, cx + sx * (SW / 2 - .2), cy, -D / 2 + 2.28, { shadow: false });
  }
  // 승강장: 호출 단추 · 층 번호판
  B(g, .06, .5, .3, P.steel, x0 + .14, y + 1.3, -D / 2 + 2.6);
  B(g, .03, .1, .1, P.gold, x0 + .18, y + 1.38, -D / 2 + 2.6, { m: mat(P.gold, { emissive: P.gold, emissiveIntensity: .6 }) });
  B(g, .7, .32, .04, TH.edge, cx, y + 3.2 * (FH / 5.6), -D / 2 + 2.32);
  // 코어형: 승강장 앞에 위층으로 올라가는 계단 (중간 쉼터에서 꺾여요)
  if (core && above) {
    const steps = 7, run = (SW - 1.2) / steps, rise = FH / 2 / steps;
    for (let s = 0; s < steps; s++) {
      B(g, run + .02, rise, 1, TH.slab, x0 + .3 + run * (s + .5), y + rise * (s + .5), .55);
      B(g, run + .02, rise, 1, TH.slab, x1 - .9 - run * (s + .5), y + FH / 2 + rise * (s + .5), 1.75);
    }
    B(g, .6, .2, 2.2, TH.slab, x1 - .6, y + FH / 2 - .1, 1.15); // 쉼터
    B(g, SW - .8, .06, .06, P.metal, cx, y + FH / 4 + .9, .05, { shadow: false }); // 난간
  }
}

// ---------- 펜트하우스 사장실: 옥상 위 유리벽 한 층 + 둘레 테라스 ----------
// 왼쪽 절반은 라운지, 오른쪽 절반은 사장 책상. 가운데 엘리베이터면 차가 펜트하우스까지 올라와요
const shaftUnderPH = () => HAS_PH && layout().shaft === 'center';
function penthouse(g, f, y) {
  const TH = theme(), h = FH - .3, cy = y + h / 2, x0 = -PW / 2, x1 = PW / 2;
  const TEAK = '#8a5a34', TEAKD = '#5a3622', CREAM = '#f4ecdc', ORANGE = '#e0803a';
  // 리조트 스위트 느낌 (2026-10-31): 크림 벽 · 티크 바닥 · 흰 서까래 천장 · 바다로 열린 유리 미닫이
  B(g, PW, h, .2, CREAM, 0, cy, -D / 2 + .1);
  for (const sx of [-1, 1]) {
    B(g, .08, h, D, '#9fd3ea', sx * PW / 2, cy, .15, { m: glassWall, shadow: false });
    for (const z of [-D / 2, 0, D / 2]) B(g, .22, h, .22, TEAKD, sx * PW / 2, cy, z);
  }
  B(g, PW, .04, D, TEAK, 0, y + .02, .15, { shadow: false });   // 티크 바닥
  B(g, PW + .6, .35, D + .6, TH.slab, 0, y + FH - .12, .15);
  B(g, PW, .08, D, '#fbf8f2', 0, y + h - .02, .15, { shadow: false });   // 흰 천장
  for (let x = x0 + 1; x < x1; x += 1.6) B(g, .14, .16, D, '#efe6d6', x, y + h - .12, .15, { shadow: false });   // 서까래
  B(g, PW + 2.2, .18, D + 1.6, TH.edge, 0, y + FH + .12, .3); // 넓은 처마
  B(g, PW + .6, .3, .14, TH.edge, 0, y + FH - .15, D / 2 + .45);
  // 바다로 열린 유리 미닫이 + 양옆 커튼
  const sea = memoTex('suite-sea', () => texMat((c, w, hh) => {
    const sky = c.createLinearGradient(0, 0, 0, hh * .55); sky.addColorStop(0, '#7cc6ee'); sky.addColorStop(1, '#d6f0fa'); c.fillStyle = sky; c.fillRect(0, 0, w, hh * .55);
    const sea = c.createLinearGradient(0, hh * .55, 0, hh); sea.addColorStop(0, '#2a9fc8'); sea.addColorStop(1, '#6fe0dc'); c.fillStyle = sea; c.fillRect(0, hh * .55, w, hh * .45);
    c.fillStyle = '#c9a06a'; c.fillRect(0, hh * .82, w, hh * .18);   // 데크
    c.fillStyle = '#ffffff'; c.fillRect(0, hh * .66, w, 6); for (let x = 10; x < w; x += 46) c.fillRect(x, hh * .66, 5, hh * .16);   // 흰 난간
    c.fillStyle = '#c9a46a'; for (let x = 0; x < w; x += 14) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 14, 0); c.lineTo(x + 7, 26 + (x % 28)); c.fill(); }   // 이엉 처마 끝
  }, 512, 360));
  const dx = -2.6, dw = 4.2, dh = 3.3;
  B(g, dw + .3, dh + .3, .08, TEAKD, dx, y + dh / 2 + .1, -D / 2 + .22);
  B(g, dw, dh, .04, '#9fd3ea', dx, y + dh / 2 + .1, -D / 2 + .28, { m: sea, shadow: false });
  B(g, .08, dh, .06, TEAKD, dx, y + dh / 2 + .1, -D / 2 + .31, { shadow: false });
  for (const sx of [-1, 1]) B(g, .5, dh + .4, .12, '#e8d9bc', dx + sx * (dw / 2 + .35), y + (dh + .4) / 2, -D / 2 + .32);
  B(g, dw + 1.6, .08, .08, TEAKD, dx, y + dh + .45, -D / 2 + .32, { shadow: false });
  // 침대: 티크 머리판 · 흰 이불 · 주황 러너 · 흰 베개, 옆 탁자와 스탠드 · 헬리코니아 꽃병
  const bx = -6.6, bz = -1.05;
  B(g, 2.6, 1.3, .14, TEAKD, bx, y + .65, -D / 2 + .3);
  B(g, 2.4, .35, 2.7, TEAKD, bx, y + .18, bz);
  B(g, 2.3, .3, 2.6, '#fbfbf8', bx, y + .5, bz);
  B(g, 2.34, .08, .7, ORANGE, bx, y + .66, bz + .75);
  for (const sx of [-.55, .55]) B(g, .9, .22, .45, '#ffffff', bx + sx, y + .74, -D / 2 + .7);
  B(g, .6, .55, .5, TEAKD, x0 + .5, y + .28, -D / 2 + .55);
  B(g, .08, .4, .08, P.metal, x0 + .5, y + .75, -D / 2 + .55); B(g, .34, .3, .34, '#fbf4e4', x0 + .5, y + 1.05, -D / 2 + .55, { m: mat('#fbf4e4', { emissive: '#ffd9a0', emissiveIntensity: .45 }) });
  B(g, .2, .4, .2, '#d9cfc0', bx + 1.6, y + .76, -D / 2 + .5); for (const [ox, c] of [[-.08, '#d9483b'], [.06, '#e2873a'], [0, '#3f8a44']]) B(g, .06, .6, .06, c, bx + 1.6 + ox, y + 1.2, -D / 2 + .5, { shadow: false });
  // 라운지: 크림 소파 + 주황 쿠션, 둥근 티크 탁자 + 과일 그릇, 흰 갓 스탠드
  const sx0 = dx, sz0 = -.75;
  B(g, 2.6, .42, .85, CREAM, sx0, y + .26, sz0); B(g, 2.6, .6, .22, CREAM, sx0, y + .62, sz0 - .36);
  for (const s2 of [-1, 1]) B(g, .22, .55, .85, '#ece2cf', sx0 + s2 * 1.3, y + .38, sz0);
  for (const ox of [-.8, .8]) B(g, .5, .45, .14, ORANGE, sx0 + ox, y + .66, sz0 - .18);
  furnHit(g, 'boss', 'sofa', sx0, y, sz0 + .2, 3, 1.3, 1.5);   // 소파 = 아침 브리핑
  B(g, 2.8, .03, 2.4, '#efe6d4', sx0, y + .05, .55, { shadow: false });   // 깔개
  const tbl = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .08, 18), mat(TEAKD)); tbl.position.set(sx0, y + .48, .75); tbl.castShadow = true; g.add(tbl);
  B(g, .14, .44, .14, TEAKD, sx0, y + .24, .75);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(.2, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#e8dcc4')); bowl.position.set(sx0, y + .7, .75); g.add(bowl);
  for (const [ox, c] of [[-.08, '#f2c94c'], [.08, '#e0803a']]) { const f = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), mat(c)); f.position.set(sx0 + ox, y + .66, .75); g.add(f); }
  B(g, .06, 1.5, .06, P.metal, -.25, y + .75, -1.9); B(g, .5, .45, .5, '#fbf4e4', -.25, y + 1.6, -1.9, { m: mat('#fbf4e4', { emissive: '#ffd9a0', emissiveIntensity: .45 }) });
  // 천장 선풍기
  B(g, .06, .5, .06, TEAKD, -4.6, y + h - .45, .2, { shadow: false }); B(g, .3, .14, .3, TEAKD, -4.6, y + h - .72, .2, { shadow: false });
  for (const r of [0, Math.PI / 2]) { const bl = B(g, 2.2, .03, .26, TEAK, -4.6, y + h - .74, .2, { shadow: false }); bl.rotation.y = r + .4; }
  if (shaftUnderPH()) { // 엘리베이터 도착하는 유리 칸
    for (const sx of [-1, 1]) B(g, .06, h, 2.2, '#9fd3ea', sx * (SW / 2), cy, -D / 2 + 1.3, { m: glassWall, shadow: false });
    B(g, SW, h, .05, '#9fd3ea', 0, cy, -D / 2 + 2.4, { m: glassWall, shadow: false });
    B(g, SW + .2, .12, .12, P.metal, 0, y + h, -D / 2 + 2.4, { shadow: false });
  }
  // 사장 자리 (오른쪽 절반)
  furnish('boss', g, { x0, x1, cx: 6.4, y });
  hitAndSign(g, 'boss', 0, PW, y);
  const tag = document.createElement('span');
  tag.className = 'tag'; tag.textContent = f.floor;
  labelsEl.append(tag);
  labelItems.push({ el: tag, pos: new THREE.Vector3(x0 - .5, y + FH / 2, D / 2 + .3) });
  ROOMS.boss.box = { cx: 0, y, w: PW };
}
// 테라스: 옥상(건물 몸통 지붕) 위 펜트하우스 양옆 — 나무 바닥 · 유리 난간 · 선베드 · 파라솔 · 꼬마전구
function terrace() {
  const y = ROOF_Y, TH = theme();
  for (const sx of [-1, 1]) {
    const a = PW / 2 + .3, b = BW / 2 - .1, cx = sx * (a + b) / 2;
    B(world, b - a, .06, D - .2, '#b98a5a', cx, y + .03, .2, { shadow: false });
  }
  B(world, BW + .3, .9, .05, '#9fd3ea', 0, y + .45, D / 2 + .3, { m: glassWall, shadow: false });
  B(world, BW + .3, .08, .1, P.metal, 0, y + .92, D / 2 + .3, { shadow: false });
  for (const x of [PW / 2 + 2.2, PW / 2 + 4.6]) { B(world, 1, .3, 2, P.white, x, y + .3, .5); B(world, 1, .5, .5, P.white, x, y + .55, -.4); }
  B(world, .08, 2.4, .08, P.metal, PW / 2 + 3.4, y + 1.2, -1.2); B(world, 2.6, .15, 2.6, P.red, PW / 2 + 3.4, y + 2.4, -1.2);
  for (const x of [-PW / 2 - 2, -PW / 2 - 5.5]) plant(world, x, y, -1.5, true);
  B(world, 1.8, .5, .6, P.wood, -PW / 2 - 3.7, y + .28, 1);
  for (let i = 0; i < 14; i++) B(world, .14, .14, .14, P.gold, -BW / 2 + 1.5 + i * ((BW - 3) / 13), y + 2.2 - Math.sin((i / 13) * Math.PI) * .4, D / 2 - .2, { m: mat(P.gold, { emissive: P.gold, emissiveIntensity: .9 }), shadow: false });
}

// 방 하나의 누르는 상자 + 이름표
// 방 그림 속 가구를 누르면 앱이 그 가구 팝업을 열어요 (hooks.onFurn). 보이지 않는 상자로 맞혀요
const furnBoxes = [];
function furnHit(g, room, id, x, y, z, w, h, d) {
  const m = new THREE.Mesh(UNIT, new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0, depthWrite: false }));
  m.scale.set(w, h, d); m.position.set(x, y + h / 2, z); m.userData.furn = { room, id }; g.add(m); furnBoxes.push(m); return m;
}
function hitAndSign(g, k, cx, w, y) {
  const hit = new THREE.Mesh(UNIT, new THREE.MeshBasicMaterial({ color: '#2b7ea1', transparent: true, opacity: 0, depthWrite: false }));
  hit.scale.set(w - .2, FH - .35, D);
  hit.position.set(cx, y + (FH - .3) / 2, .15);
  hit.userData.room = k;
  g.add(hit);
  roomBoxes.push(hit);
  const r = ROOMS[k];
  const el = document.createElement('button');
  el.className = 'sign';
  el.type = 'button';
  el.dataset.room = k;
  el.innerHTML = `${r.name}<i class="${r.hot ? 'hot' : ''}" ${r.n ? '' : 'hidden'}>${r.n}</i>`;
  labelsEl.append(el);
  labelItems.push({ el, pos: new THREE.Vector3(cx, y + FH - .62, D / 2 - .2) });
}

// ---------- 엘리베이터 차: 층마다 잠깐 서고 위아래로 오가요 ----------
function buildLift() {
  const L = layout(), TH = theme(), n = MAIN[0].rooms.length; // 펜트하우스 말고 몸통 층 기준
  const outside = L.shaft === 'outside';
  const cx = outside ? BW / 2 + .25 + 1.6 : (slots(n).shaft[0] + slots(n).shaft[1]) / 2;
  const cz = outside ? -D / 2 + 1.7 : -D / 2 + 1.35;
  // 서는 층: 건물 안 엘리베이터는 모든 층(펜트하우스는 바로 아래에 있을 때만), 바깥 캡슐은 땅 위 층만
  const stops = FLOORS.map((f, i) => ({ f, y: floorY(i) }))
    .filter(({ f }) => (f.penthouse ? shaftUnderPH() : !outside || !f.floor.startsWith('B')))
    .map((s) => s.y).sort((a, b) => a - b);
  const car = new THREE.Group();
  const w = outside ? 2.2 : SW - .7, ch = 2.6, d = outside ? 2.2 : 1.8;
  if (L.car === 'capsule') {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, ch, 16), glassWall);
    tube.position.y = ch / 2; car.add(tube);
    for (const yy of [.06, ch - .06]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, .14, 16), mat(P.white)); r.position.y = yy; r.castShadow = true; car.add(r); }
  } else {
    const shell = L.car === 'core' ? '#c9ced3' : P.metal;
    B(car, w, .12, d, shell, 0, .06, 0); B(car, w, .12, d, shell, 0, ch - .06, 0);
    B(car, w, ch, .08, shell, 0, ch / 2, -d / 2 + .04);
    for (const sx of [-1, 1]) {
      if (L.car === 'core') B(car, .08, ch, d, shell, sx * (w / 2 - .04), ch / 2, 0);
      else { B(car, .05, ch, d, '#9fd3ea', sx * (w / 2 - .03), ch / 2, 0, { m: glassWall, shadow: false }); B(car, .08, ch, .08, P.metal, sx * (w / 2 - .04), ch / 2, d / 2 - .04); }
    }
    if (L.car === 'core') { B(car, w * .45, ch - .3, .05, P.steel, -w * .23, ch / 2, d / 2 - .03); B(car, w * .45, ch - .3, .05, P.steel, w * .23, ch / 2, d / 2 - .03); }
  }
  B(car, .5, .06, .5, P.gold, 0, ch - .16, 0, { m: mat(P.gold, { emissive: P.gold, emissiveIntensity: .9 }), shadow: false }); // 천장 불빛
  car.position.set(cx, stops[0], cz);
  world.add(car);
  // 타고 있는 직원 (코어형은 문이 닫혀 있어 안 보여요)
  if (L.car !== 'core') addChar(car, 0, .12, 0, 'stand', { def: staffById(STATE.assign.lobby).def(), face: .2, info: staffInfo(STATE.assign.lobby) });
  const top = (shaftUnderPH() ? TOP_Y : outside ? ROOF_Y + 1.6 : ROOF_Y) - .1;
  const cable = B(world, .05, 1, .05, P.belt, cx, 0, cz, { shadow: false });
  if (outside) { // 건물 밖 유리 탑 + 층마다 이어진 다리
    const th = ROOF_Y + 1.8;
    B(world, 2.9, th, 2.9, '#9fd3ea', cx, th / 2, cz, { m: glassWall, shadow: false });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(world, .18, th, .18, TH.pillar, cx + sx * 1.45, th / 2, cz + sz * 1.45);
    B(world, 3.3, .4, 3.3, TH.edge, cx, th + .2, cz);
    stops.forEach((yy) => { B(world, .5, .2, 2, TH.slab, BW / 2 + .35, yy - .1, cz); B(world, .04, 2.4, 1.6, '#2b3640', BW / 2 + .27, yy + 1.2, cz, { shadow: false }); });
  } else if (!shaftUnderPH()) B(world, SW + .4, 1.5, 2.6, TH.wall2, cx, ROOF_Y + .75, -D / 2 + 1.4); // 옥상 기계실
  // 순서: 아래 → 위 → 아래, 층마다 2.5초 서고 2초에 한 층씩
  const route = stops.length > 1 ? [...stops.keys(), ...[...stops.keys()].slice(1, -1).reverse()] : [0];
  const dwell = 2.5, travel = 2, T = dwell + travel;
  anims.push((t) => {
    const k = Math.floor(t / T) % route.length, f = t % T;
    const a = stops[route[k]], b = stops[route[(k + 1) % route.length]];
    const u = f < dwell ? 0 : (f - dwell) / travel, e = u * u * (3 - 2 * u);
    car.position.y = a + (b - a) * e;
    const cTop = car.position.y + ch;
    cable.scale.y = Math.max(.01, top - cTop);
    cable.position.y = (top + cTop) / 2;
  });
}

// ---------- 현관: 1층 옆벽에 문 · 길 · 이름판, 모양은 시안마다 ----------
function entrance() {
  const L = layout(), TH = theme(), sx = L.entry === 'left' ? -1 : 1;
  const xo = sx * (BW / 2 + .25), zc = D / 2 - 1.4; // xo: 옆벽 바깥면
  const at = (d) => xo + sx * d; // 벽에서 바깥으로 d 만큼
  const tall = L.door === 'arch' ? 3 : 2.6;
  const doorM = mat('#4f7f98', { roughness: .25, metalness: .2 });
  for (const face of [at(.03), sx * (BW / 2 - .02)]) {
    B(world, .06, tall + .2, 2, TH.frame === '#ffffff' ? P.metal : TH.frame, face, (tall + .2) / 2, zc, { shadow: false });
    for (const dz of [-.47, .47]) B(world, .07, tall, .86, '#4f7f98', face + sx * .01, tall / 2, zc + dz, { m: doorM, shadow: false });
  }
  B(world, .9, .03, 1.5, '#8a4b3a', at(.6), .18, zc); // 발판
  for (let k = 0; k < 4; k++) B(world, .7, .05, .9, '#d8d2c4', at(1.6 + k * 1.15), .18, zc + (k % 2 ? .25 : -.25)); // 디딤돌
  const sign = new THREE.Mesh(UNIT, memoTex(`sign|${TH.edge}`, () => texMat((g, w, h) => {
    g.fillStyle = TH.edge; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.font = `52px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(APP_NAME, w / 2, h / 2 + 4);
  }, 640, 110)));
  sign.scale.set(.05, .5, 2.9); sign.position.set(at(.06), tall + 1.1, zc); world.add(sign);
  const post = (x, z, hh, c = P.metal, s = .1) => B(world, s, hh, s, c, x, hh / 2, z);
  switch (L.door) {
    case 'canopy':
      B(world, 2.7, .18, 2.9, TH.edge, at(1.35), 3.05, zc);
      post(at(2.55), zc - 1.3, 3); post(at(2.55), zc + 1.3, 3);
      B(world, .5, .05, .5, P.gold, at(1.2), 2.94, zc, { m: mat(P.gold, { emissive: P.gold, emissiveIntensity: .8 }), shadow: false });
      break;
    case 'revolving': {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 2.6, 20, 1, true), glassWall);
      drum.position.set(at(1), 1.3, zc); world.add(drum);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, .25, 20), mat(TH.edge));
      cap.position.set(at(1), 2.72, zc); cap.castShadow = true; world.add(cap);
      const vanes = new THREE.Group(); vanes.position.set(at(1), 1.3, zc); world.add(vanes);
      B(vanes, 2, 2.4, .06, '#9fd3ea', 0, 0, 0, { m: glassWall, shadow: false }); B(vanes, .06, 2.4, 2, '#9fd3ea', 0, 0, 0, { m: glassWall, shadow: false });
      B(vanes, .1, 2.4, .1, P.metal, 0, 0, 0);
      anims.push((t) => { vanes.rotation.y = t * .7; });
      break;
    }
    case 'porch':
      B(world, 3, .3, 3.4, TH.slab, at(1.5), .3, zc);
      B(world, .5, .15, 2.4, TH.slab, at(3.2), .22, zc);
      post(at(2.75), zc - 1.45, 3.4, TH.pillar, .34); post(at(2.75), zc + 1.45, 3.4, TH.pillar, .34);
      B(world, 3.4, .28, 3.8, TH.edge, at(1.6), 3.55, zc);
      B(world, 2.6, .3, 3, TH.edge, at(1.4), 3.84, zc);
      B(world, 1.6, .3, 1.8, TH.edge, at(1.2), 4.12, zc);
      break;
    case 'arch':
      for (const dz of [-1.15, 1.15]) post(at(.2), zc + dz, 3.2, TH.pillar, .32);
      for (let k = 0; k < 4; k++) B(world, .34, .28, 2.6 - k * .62, TH.pillar, at(.2), 3.3 + k * .26, zc);
      plant(world, at(.7), .16, zc - 1.9, true); plant(world, at(.7), .16, zc + 1.9, true);
      break;
    case 'glassbox':
      B(world, 2.3, 2.9, 2.7, '#9fd3ea', at(1.15), 1.6, zc, { m: glassWall, shadow: false });
      B(world, 2.45, .14, 2.85, P.metal, at(1.15), 3.08, zc);
      for (const dz of [-1.35, 1.35]) post(at(2.3), zc + dz, 3);
      B(world, .07, 2.5, 1.5, '#4f7f98', at(2.32), 1.25 + .16, zc, { m: doorM, shadow: false });
      break;
    default: break;
  }
  // 현관 옆 가로등
  post(at(4.6), zc - 1.6, 2.4); B(world, .32, .32, .32, P.gold, at(4.6), 2.5, zc - 1.6, { m: mat(P.gold, { emissive: P.gold, emissiveIntensity: .5 }) });
}

// 창고: 아직 쓰지 않는 칸. 상자 · 천을 덮은 가구 · '빈 방' 표지 (창고 번호마다 조금씩 다르게)
function storeRoom(g, k, { x0, x1, cx, y }) {
  const zb = -D / 2 + .55, n = Number(k.replace(/\D/g, '')) || 1;
  // 직원을 배치했으면 창고 안을 오가며 상자를 정리해요
  const sid = STATE.assign[k];
  if (sid) addChar(g, x0 + 1.6, y, 1.6, 'walk', { def: staffById(sid).def(), walk: [x0 + 1.6, x1 - 1.6, .9], info: staffInfo(sid, k) });
  crates(g, x0 + .6, y, zb, 3, 3 - (n % 2));
  shelf(g, cx + .6 + (n % 3) * .4, y, zb, 1.3, 2, 40 + n * 9);
  crates(g, x1 - 1.9, y, .9 - (n % 2) * .4, 2, 1 + (n % 2));
  B(g, 1.5, .85, .8, '#e9eef0', cx - 1.2, y + .43, .9);
  B(g, 1.62, .06, .92, '#dfe6e9', cx - 1.2, y + .88, .9);
  wallBoard(g, cx - 1.2, y + 2.3, -D / 2 + .13, 1.6, .7, posterMat('빈 방', P.metal));
  if (n % 2 === 0) { B(g, .06, 1.3, .06, P.wood, x1 - .45, y + .65, zb + .4); B(g, .32, .22, .12, P.gold, x1 - .45, y + .11, zb + .4); } // 빗자루
}

function buildWorld() {
  world.clear();
  furnBoxes.length = 0;
  people.length = 0; docs.length = 0; roomBoxes.length = 0; labelItems.length = 0; anims.length = 0;
  for (const k of Object.keys(TOOLS)) delete TOOLS[k];
  labelsEl.innerHTML = '';
  Object.assign(P, P0, theme().ground || {}); // 시안마다 땅 · 나무 색
  BW = RBW + (shaftInside() ? SW : 0);
  FLOORS.forEach((f, i) => {
    const y = floorY(i);
    const g = new THREE.Group();
    g.userData.floor = f.floor;
    world.add(g);
    if (f.penthouse) { penthouse(g, f, y); return; }
    const base = f.floor.startsWith('B');
    const TH = theme(), wall = base ? TH.wallB1 : TH.floors ? TH.floors[i] : TH.wall;
    const n = f.rooms.length, rw = RBW / n, sl = slots(n);
    // 바닥: 엘리베이터 칸 뒤쪽(차가 지나가는 자리)은 구멍을 내요. 맨 아래층은 막힌 바닥
    const bottomFloor = i === FLOORS.length - 1;
    if (sl.shaft && !bottomFloor) {
      const [s0, s1] = sl.shaft, hz = -D / 2 + 2.2; // hz: 구멍 앞쪽 끝
      const piece = (a, b, z0, z1) => { if (b - a > .01) B(g, b - a, .3, z1 - z0, TH.slab, (a + b) / 2, y - .15, (z0 + z1) / 2); };
      piece(-BW / 2 - .25, s0 + .15, -D / 2 - .0, D / 2 + .3);
      piece(s1 - .15, BW / 2 + .25, -D / 2 - .0, D / 2 + .3);
      piece(s0 + .15, s1 - .15, hz, D / 2 + .3);
    } else B(g, BW + .5, .3, D + .3, TH.slab, 0, y - .15, .15);
    B(g, BW + .5, .32, .14, TH.edge, 0, y - .15, D / 2 + .34);
    B(g, BW, FH - .3, .2, wall, 0, y + (FH - .3) / 2, -D / 2 + .1);
    for (const sx of [-1, 1]) sideWall(g, sx, y, base);
    for (let j = 1; j < n; j++) {
      if (sl.shaft && Math.abs(sl.rooms[j][0] - sl.shaft[1]) < .01) continue; // 엘리베이터 칸과 맞닿은 벽은 shaftFloor 가 그려요
      const x = sl.rooms[j][0];
      B(g, .16, FH - .3, D - .8, shade(wall, -.06), x, y + (FH - .3) / 2, -.4);
      B(g, .36, FH - .3, .36, TH.pillar, x, y + (FH - .3) / 2, D / 2 - .1);
    }
    if (sl.shaft) shaftFloor(g, sl.shaft, y, MAIN.indexOf(f) > 0);
    f.rooms.forEach((k, j) => {
      const [x0, x1] = sl.rooms[j], cx = (x0 + x1) / 2;
      if (!base && k !== 'others') windows(g, cx, rw, n, y); // 도서관은 뒷벽을 책장으로 채워요
      furnish(k, g, { x0, x1, cx, y });
      const hit = new THREE.Mesh(UNIT, new THREE.MeshBasicMaterial({ color: '#2b7ea1', transparent: true, opacity: 0, depthWrite: false }));
      hit.scale.set(rw - .2, FH - .35, D);
      hit.position.set(cx, y + (FH - .3) / 2, .15);
      hit.userData.room = k;
      g.add(hit);
      roomBoxes.push(hit);
      const r = ROOMS[k];
      const el = document.createElement('button');
      el.className = 'sign';
      el.type = 'button';
      el.dataset.room = k;
      el.innerHTML = `${r.name}<i class="${r.hot ? 'hot' : ''}" ${r.n ? '' : 'hidden'}>${r.n}</i>`;
      labelsEl.append(el);
      labelItems.push({ el, pos: new THREE.Vector3(cx, y + FH - .62, D / 2 - .2) });
      r.box = { cx, y, w: rw };
    });
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = f.floor;
    labelsEl.append(tag);
    labelItems.push({ el: tag, pos: new THREE.Vector3(-BW / 2 - .5, y + FH / 2, D / 2 + .3) });
  });

  // 옥상
  const roofY = ROOF_Y;
  const TH = theme();
  if (shaftUnderPH()) { // 엘리베이터가 펜트하우스까지 올라가도록 옥상 바닥에 구멍
    const [s0, s1] = slots(FLOORS.find((f) => !f.penthouse).rooms.length).shaft, hz = -D / 2 + 2.2;
    const piece = (a, b, z0, z1) => B(world, b - a, .4, z1 - z0, TH.slab, (a + b) / 2, roofY - .1, (z0 + z1) / 2);
    piece(-BW / 2 - .25, s0 + .15, -D / 2, D / 2 + .3); piece(s1 - .15, BW / 2 + .25, -D / 2, D / 2 + .3); piece(s0 + .15, s1 - .15, hz, D / 2 + .3);
  } else B(world, BW + .5, .4, D + .3, TH.slab, 0, roofY - .1, .15);
  B(world, BW + .5, .32, .14, TH.edge, 0, roofY - .15, D / 2 + .34);
  for (const sx of [-1, 1]) B(world, .3, .5, D + .3, TH.wall2, sx * (BW / 2 + .1), roofY + .35, .15);
  B(world, BW + .5, .5, .3, TH.wall2, 0, roofY + .35, -D / 2 + .1);
  bobbers.length = 0;
  // 옥상 꾸밈(시안마다)은 맨 꼭대기에: 펜트하우스가 있으면 그 지붕 위, 몸통 옥상은 테라스
  if (HAS_PH) terrace();
  roofExtras(TOP_Y, HAS_PH ? PW : BW);
  buildLift();
  entrance();
  const roof = document.createElement('span');
  roof.className = 'roofsign';
  roof.textContent = APP_NAME;
  labelsEl.append(roof);
  labelItems.push({ el: roof, pos: new THREE.Vector3(0, TOP_Y + 1.1, D / 2) });

  // 땅 단면 (B1 은 흙 속에)
  const GW = 9, gy0 = BOTTOM - .7, zf = D / 2 + .41, depth = 9;
  for (const sx of [-1, 1]) {
    const x = sx * (BW / 2 + .25 + GW / 2);
    B(world, GW, -gy0, depth + zf, P.dirt, x, gy0 / 2, (zf - depth) / 2);
    B(world, GW, .16, depth + zf, P.grass, x, .08, (zf - depth) / 2);
    for (let i = 0; i < 3; i++) B(world, GW, .08, .02, P.dirtD, x, -.8 - i * .9, zf + .01, { shadow: false });
  }
  B(world, BW + .5, -gy0, depth - D / 2, P.dirt, 0, gy0 / 2, -D / 2 - (depth - D / 2) / 2);
  B(world, BW + .5, .16, depth - D / 2, P.grass, 0, .08, -D / 2 - (depth - D / 2) / 2);
  B(world, BW + .5, .45, D + .6, P.dirt, 0, gy0 + .22, .15);
  const tree = (x, z, s = 1) => { B(world, .35 * s, 1.4 * s, .35 * s, P.trunk, x, .7 * s, z); B(world, 1.6 * s, 1.3 * s, 1.6 * s, P.leaf, x, 1.9 * s, z); B(world, 1.1 * s, .9 * s, 1.1 * s, P.leaf2, x, 2.9 * s, z); };
  // 현관 쪽 나무는 길을 비켜 뒤로, 바깥 엘리베이터 쪽 나무는 더 멀리
  const L = layout(), eL = L.entry === 'left', eR = L.entry === 'right', out = L.shaft === 'outside' ? 2.4 : 0;
  tree(-BW / 2 - 3, eL ? -2.6 : 1.5, 1.3); tree(-BW / 2 - 6.2, eL ? -3.4 : -2.5, 1);
  tree(BW / 2 + 3.3 + out, eR ? -2.6 : -1, 1.15); tree(BW / 2 + 6.5 + out, eR ? -3.4 : 2, .9);
  if (!eR) B(world, 1.4, .5, .6, P.wood, BW / 2 + 3.5 + out, .3, 2.6);
  buildOutside();
  markSigns();
  applyBandVis();
  if (WX.data) applyWeather(); // 새로 만든 창문에도 밤 불빛
}

// ---------- 건물 시안 8~12번: 다른 겉모양 (건물 전체 보기에서만) ----------
const outside = new THREE.Group();
scene.add(outside);
const OUT = { hits: [], anchors: {}, box: new THREE.Box3(), on: false };
const OUT_SCALE = 2.2;
function glassMat(c) {
  const m = mat(c, { emissive: c, emissiveIntensity: .35 });
  m.userData.base = c;
  glassMats.add(m);
  return m;
}
function buildOutside() {
  outside.clear();
  OUT.hits = []; OUT.anchors = {};
  const form = theme().form;
  if (!form) return;
  const g = new THREE.Group();
  g.scale.setScalar(OUT_SCALE);
  outside.add(g);
  let slots;
  try { slots = buildForm(form, g, { mat, glass: glassMat }); } catch (e) { // 모형이 깨져도 상자 건물로는 보여요
    console.error('건물 겉모양을 그리지 못했어요', e);
    outside.clear();
    return;
  }
  // 이름 있는 자리(사장실 · 접수처 · 보관실 · 보안실)부터, 나머지 방은 빈자리에 차례로 (창고는 겉에 안 보여요)
  const rooms = FLOORS.flatMap((f) => f.rooms).filter((k) => !ROOMS[k].store);
  const named = new Set(slots.map((s) => s.key).filter(Boolean));
  const free = slots.filter((s) => !s.key);
  // 같은 층 방은 같은 구역(area)의 빈자리부터
  const take = (k) => {
    if (named.has(k)) return slots.find((s) => s.key === k);
    const fl = FLOORS.find((f) => f.rooms.includes(k))?.floor;
    const i = Math.max(0, free.findIndex((s) => s.area === fl));
    return free.splice(i, 1)[0];
  };
  for (const k of rooms) {
    const s = take(k);
    if (!s) continue;
    const [x, y, z, w, h, d] = s.box;
    const hit = new THREE.Mesh(UNIT, new THREE.MeshBasicMaterial({ color: '#2b7ea1', transparent: true, opacity: 0, depthWrite: false }));
    hit.scale.set(w, h, d);
    hit.position.set(x, y, z);
    hit.userData.room = k;
    g.add(hit);
    OUT.hits.push(hit);
    OUT.anchors[k] = new THREE.Vector3(x, y + h / 2 + .35, z).multiplyScalar(OUT_SCALE);
  }
  outside.updateMatrixWorld(true);
  OUT.box.setFromObject(g);
  for (const it of labelItems) {
    const k = it.el.dataset.room;
    it.posOut = it.el.classList.contains('roofsign') ? new THREE.Vector3(0, OUT.box.max.y + 1.6, 0) : k && !it.el.classList.contains('libcap') ? OUT.anchors[k] || null : null;
  }
}
// 지금 겉모양 모형을 보여 줄 때: 8~12번 시안 · 첫 화면 · 방에 들어가지 않았을 때
const extOn = () => !!theme().form && OUT.hits.length > 0 && mode === 'home' && !selected;
// 층 화면에서는 그 층만 그려요 (다른 층 · 옥상 · 땅은 숨겨서 한 칸이 딱 맞게 보이게)
function applyBandVis() {
  for (const ch of world.children) ch.visible = mode !== 'band' || ch.userData.floor === bandFloor;
}

// ---------- 카메라 ----------
const view = { target: new THREE.Vector3(0, 7.2, 0), dist: 70, yaw: -.32, pitch: .16 };
const goal = { target: new THREE.Vector3(0, 7.2, 0), dist: 70, yaw: -.32, pitch: .16 };
let selected = null; // 카메라가 들어간 방
let target = null;   // 배치판에서 고른 곳 { kind: 'room' | 'floor', key }

function fitDist(w, h) {
  const v = THREE.MathUtils.degToRad(camera.fov) / 2;
  const hz = Math.atan(Math.tan(v) * camera.aspect);
  return Math.max((h / 2) / Math.tan(v), (w / 2) / Math.tan(hz));
}
function overview() {
  selected = null;
  if (extOn()) { // 다른 겉모양: 모형 전체가 들어오게, 조금 더 내려다보며
    const c = OUT.box.getCenter(new THREE.Vector3()), s = OUT.box.getSize(new THREE.Vector3());
    const pad = camera.aspect > 1.2 ? 9 : 0;
    goal.target.set(c.x - pad / 2, c.y - s.y * .1, c.z);
    goal.dist = fitDist(s.x + pad + 4, s.y * 1.5 + 6) + s.z * .45;
    goal.yaw = -.32; goal.pitch = .42;
    document.getElementById('back').hidden = true;
    markSigns();
    return;
  }
  // 위로는 옥상 장식(시계탑 · 풍선)까지, 아래로는 지하 흙까지 들어오게
  // 낮고 넓은 건물은 위로 남는 자리가 크고, 내려다보는 각도 때문에 앞쪽 바닥이 아래로 더 내려가 보여서 아래를 넉넉히
  const top = TOP_Y + 4.5, bottom = BOTTOM - 2.5;
  // 넓은 화면은 왼쪽 게임 메뉴 자리만큼 건물을 오른쪽으로 비켜 보여요
  const pad = camera.aspect > 1.2 ? 9 : 0;
  goal.target.set(-pad / 2, (TOP_Y + BOTTOM) / 2 - 2, 0); // 건물 한가운데보다 조금 아래를 봐야 화면 가운데에 와요
  goal.dist = fitDist(BW + 6 + pad + (layout().shaft === 'outside' ? 6 : 0), top - bottom) * 1.02 + D / 2;
  goal.yaw = -.32; goal.pitch = .16;
  document.getElementById('back').hidden = true;
  markSigns();
}
function enter(k) {
  const b = ROOMS[k].box, f = ROOMS[k].focus;
  selected = k;
  if (k === 'boss' && f) { goal.target.set(f.x + .4, f.y + .35, 1); goal.dist = fitDist(10, 5.2) + 2; } else { goal.target.set(b.cx, b.y + FH * .46, .3); goal.dist = fitDist(b.w + 1.2, FH + 1) + D / 2; }
  goal.yaw = THREE.MathUtils.clamp(view.yaw, -.35, .35) * .5;
  goal.pitch = .1;
  document.getElementById('back').hidden = false;
  markSigns();
}
function enterFloor(floor) {
  const f = FLOORS.find((x) => x.floor === floor);
  const y = ROOMS[f.rooms[0]].box.y;
  selected = f.rooms[0];
  goal.target.set(0, y + FH * .46, .3);
  goal.dist = fitDist((f.penthouse ? PW : BW) + 1, FH + 1) + D / 2;
  goal.yaw = THREE.MathUtils.clamp(view.yaw, -.35, .35) * .5;
  goal.pitch = .1;
  document.getElementById('back').hidden = false;
  markSigns();
}
function markSigns() {
  const on = (k) => target && (target.kind === 'room' ? target.key === k : FLOORS.find((f) => f.floor === target.key)?.rooms.includes(k));
  labelsEl.querySelectorAll('.sign').forEach((s) => s.classList.toggle('on', s.dataset.room === selected || !!on(s.dataset.room)));
}
// 층 화면에서는 고른 방 한 칸만 잘라 보여요 (방 양옆을 칼로 자르듯). 옆방으로 가면 자르는 자리도 같이 미끄러져요
const clipL = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), clipR = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
const clip = { a: 0, b: 0 }, clipGoal = { a: 0, b: 0 };
function placeClip() {
  if (mode !== 'band') { renderer.clippingPlanes = []; return; }
  clip.a += (clipGoal.a - clip.a) * .09;
  clip.b += (clipGoal.b - clip.b) * .09;
  clipL.constant = -clip.a;
  clipR.constant = clip.b;
  renderer.clippingPlanes = [clipL, clipR];
}
function placeCamera() {
  placeClip();
  const k = .09;
  view.target.lerp(goal.target, k);
  view.dist += (goal.dist - view.dist) * k;
  view.yaw += (goal.yaw - view.yaw) * k;
  view.pitch += (goal.pitch - view.pitch) * k;
  const cp = Math.cos(view.pitch);
  camera.position.set(view.target.x + Math.sin(view.yaw) * cp * view.dist, view.target.y + Math.sin(view.pitch) * view.dist, view.target.z + Math.cos(view.yaw) * cp * view.dist);
  camera.lookAt(view.target);
}

// ---------- 🚶 방 화면 = 메타버스: 사장님이 방 안을 걸어 다녀요 (2026-11-06) ----------
// 바닥을 누르면 그리로 걸어가고, 가구를 누르면 가구 앞까지 걸어가서 그 가구 창(팝업)이 떠요. 키보드 W A S D · 화살표로도 걸어요.
// 카메라는 사장님을 따라가요 (끌면 조금 돌려 볼 수 있어요). 아래 가구 단추를 눌러도 사장님이 그 가구로 걸어가요.
const WALK = { on: false, k: '', c: null, go: null, then: null, until: 0, keys: new Set(), obst: [] };
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const floorHit = new THREE.Vector3();
function walkBounds(k) {
  const b = ROOMS[k].box, hw = b.w / 2;
  return { x0: b.cx - hw + .6, x1: b.cx + hw - .6, z0: -D / 2 + .75, z1: D / 2 - .25, y: b.y };
}
// 가구 · 분류 가구 · 책장 자리를 바닥 위 네모로 (걸어서 뚫고 지나가지 않게)
function walkObstacles(k) {
  const out = [], bx = new THREE.Box3();
  const add = (o, pad = .28) => { bx.setFromObject(o); if (bx.isEmpty()) return; out.push({ x0: bx.min.x - pad, x1: bx.max.x + pad, z0: bx.min.z - pad, z1: bx.max.z + pad }); };
  furnBoxes.filter((m) => m.userData.furn.room === k).forEach((m) => add(m, .2));
  TOOLS[k]?.hits.forEach((m) => add(m, .15));
  return out;
}
const blocked = (x, z) => WALK.obst.some((o) => x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1);
function startWalk(k) {
  const b = ROOMS[k]?.box, g = world.children.find((x) => x.userData.floor === bandFloor);
  if (!b || !g) return;
  const keep = WALK.c && WALK.k === k ? { x: WALK.c.root.position.x, z: WALK.c.root.position.z, r: WALK.c.root.rotation.y } : null;
  stopWalk(true);
  const me = ME.find((m) => m.id === STATE.me) || ME[0];
  const c = makeChar(me.def());
  c.root.userData.char = c;
  c.info = meInfo();
  Object.assign(c, { role: 'player', ph: 0, hold: me.hold });
  const L = walkBounds(k);
  c.root.position.set(keep ? keep.x : b.cx, L.y, keep ? keep.z : .9);
  c.root.rotation.y = keep ? keep.r : Math.PI;   // 처음엔 방 안쪽을 봐요
  g.add(c.root);
  people.push(c);
  // 원래 방에 서 있던 사장님은 숨겨요
  people.forEach((p) => { if (p.staticMe) p.root.visible = false; });
  Object.assign(WALK, { on: true, k, c, go: null, then: null, obst: walkObstacles(k) });
  // 막힌 곳에서 시작하면 앞쪽으로 비켜 서요
  for (let i = 0; i < 20 && blocked(c.root.position.x, c.root.position.z); i++) c.root.position.z = Math.min(L.z1, c.root.position.z + .3);
}
function stopWalk(quiet) {
  if (WALK.c) { WALK.c.root.removeFromParent(); const i = people.indexOf(WALK.c); if (i >= 0) people.splice(i, 1); }
  if (!quiet) people.forEach((p) => { if (p.staticMe) p.root.visible = true; });
  Object.assign(WALK, { on: false, c: null, go: null, then: null });
}
// (x, z) 로 걸어가요. 도착하면(또는 2.5초 안에 못 가면) then 을 불러요
function walkTo(x, z, then) {
  if (!WALK.on) { then?.(); return; }
  const L = walkBounds(WALK.k);
  x = THREE.MathUtils.clamp(x, L.x0, L.x1); z = THREE.MathUtils.clamp(z, L.z0, L.z1);
  // 가구 안쪽을 누르면 가구 앞(카메라 쪽)으로
  for (let i = 0; i < 30 && blocked(x, z); i++) z = Math.min(L.z1, z + .2);
  WALK.go = { x, z };
  WALK.then = then || null;
  WALK.until = performance.now() + 2500;
}
// 가구 이름으로 그 가구 앞까지 (아래 가구 단추) → Promise
export function walkFurn(id) {
  return new Promise((res) => {
    if (!WALK.on) { res(); return; }
    const k = WALK.k;
    const m = furnBoxes.find((x) => x.userData.furn.room === k && x.userData.furn.id === id)
      || (id === 'main' || !furnBoxes.some((x) => x.userData.furn.room === k) ? TOOLS[k]?.hits[0] : null);
    if (!m) { res(); return; }
    const p = new THREE.Vector3(); new THREE.Box3().setFromObject(m).getCenter(p);
    const bz = new THREE.Box3().setFromObject(m).max.z;
    walkTo(p.x, bz + .55, res);
  });
}
function stepWalk(dt, t) {
  if (!WALK.on || !WALK.c) return;
  const c = WALK.c, pos = c.root.position, L = walkBounds(WALK.k);
  let dx = 0, dz = 0;
  // 키보드: 카메라 기준 앞뒤 · 옆
  const K = WALK.keys;
  const kx = (K.has('ArrowRight') || K.has('d') ? 1 : 0) - (K.has('ArrowLeft') || K.has('a') ? 1 : 0);
  const kz = (K.has('ArrowDown') || K.has('s') ? 1 : 0) - (K.has('ArrowUp') || K.has('w') ? 1 : 0);
  if (kx || kz) {
    WALK.go = null; WALK.then = null;
    const yaw = view.yaw, cs = Math.cos(yaw), sn = Math.sin(yaw);
    dx = kx * cs + kz * sn; dz = -kx * sn + kz * cs;
    const n = Math.hypot(dx, dz); dx /= n; dz /= n;
  } else if (WALK.go) {
    const gx = WALK.go.x - pos.x, gz = WALK.go.z - pos.z, d = Math.hypot(gx, gz);
    if (d < .08 || performance.now() > WALK.until) {
      WALK.go = null;
      const f = WALK.then; WALK.then = null;
      if (f) { c.root.rotation.y = Math.PI; setTimeout(f, 60); }   // 가구 쪽(안쪽)을 보고 창을 열어요
    } else { dx = gx / d; dz = gz / d; }
  }
  const moving = !!(dx || dz);
  if (moving) {
    const sp = 3.1 * dt;
    const nx = THREE.MathUtils.clamp(pos.x + dx * sp, L.x0, L.x1), nz = THREE.MathUtils.clamp(pos.z + dz * sp, L.z0, L.z1);
    // 가구에 막히면 미끄러지듯 한쪽으로만
    if (!blocked(nx, nz)) { pos.x = nx; pos.z = nz; } else if (!blocked(nx, pos.z)) pos.x = nx; else if (!blocked(pos.x, nz)) pos.z = nz;
    const want = Math.atan2(dx, dz);
    const da = Math.atan2(Math.sin(want - c.root.rotation.y), Math.cos(want - c.root.rotation.y));
    c.root.rotation.y += da * Math.min(1, dt * 10);
  }
  const s = t * 1;
  const step = moving ? Math.sin(s * 9) : 0;
  if (c.legL) { c.legL.rotation.x = step * .6; c.legR.rotation.x = -step * .6; }
  if (c.armL && c.armR) { c.armL.rotation.x = moving ? -step * .55 : Math.sin(s * 1.3) * .04; c.armR.rotation.x = moving ? step * .55 : -Math.sin(s * 1.3) * .04; }
  c.lift.position.y = moving ? Math.abs(step) * .05 : Math.abs(Math.sin(s * 1.3)) * .03;
  if (c.head) c.head.rotation.y = moving ? 0 : Math.sin(s * .5) * .3;
  // 카메라: 사장님 뒤 조금 위에서 따라가요
  // 사장님이 화면 아래쪽에 오도록 조금 앞(안쪽)을 보고, 방이 넉넉히 보이게 떨어져요. 옆으로는 방 가운데 쪽으로 조금 당겨요
  const bx = ROOMS[WALK.k].box.cx;
  goal.target.set(pos.x * .6 + bx * .4, L.y + 1.1, Math.min(-.2, pos.z - 1.6));   // 앞뒤로는 방 가운데 뒤쪽을 봐서 바닥이 화면 아래까지 차요
  goal.dist = camera.aspect < 1 ? 20 : 15.5;
  // 방 양옆 자르기는 그대로 (옆방이 안 보이게)
}
addEventListener('keydown', (e) => {
  if (!WALK.on || !visible || e.target.closest?.('input, textarea, select, dialog, [contenteditable]') || document.querySelector('dialog[open]')) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(k)) { WALK.keys.add(k); e.preventDefault(); }
});
addEventListener('keyup', (e) => { WALK.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); });
addEventListener('blur', () => WALK.keys.clear());

// ---------- 끌기 · 누르기 · 휠 ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let drag = null, hovered = null;
function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.intersectObjects(OUT.on ? OUT.hits : roomBoxes, false)[0]?.object.userData.room || null;
}
function hoverRoom(k) {
  if (hovered === k) return;
  roomBoxes.forEach((b) => { b.material.opacity = b.userData.room === k ? .07 : 0; });
  OUT.hits.forEach((b) => { b.material.opacity = b.userData.room === k ? .12 : 0; });
  hovered = k;
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, yaw: goal.yaw, pitch: goal.pitch, moved: false };
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) { drag.moved = true; stage.classList.add('drag'); }
    if (drag.moved) {
      goal.yaw = THREE.MathUtils.clamp(drag.yaw - dx * .005, WALK.on ? -.7 : -1, WALK.on ? .7 : 1);
      goal.pitch = THREE.MathUtils.clamp(drag.pitch + dy * .004, WALK.on ? .3 : -.02, WALK.on ? .95 : .7);   // 방 안에서는 내려다보는 쪽으로
    }
    return;
  }
  const ch = pickChar(e);
  if (ch) { showTip(ch.info, e.clientX, e.clientY); hoverRoom(null); libHover(null); stage.classList.add('hover'); return; }
  const bk = pickBook();
  libHover(bk);
  if (bk) { showTip({ title: bk.title, sub: bk.subject || '교과 미기재', text: '누르면 사서가 가져와 열람대에 펼쳐요.' }, e.clientX, e.clientY); hoverRoom(null); stage.classList.add('hover'); return; }
  const tl = pickTool();
  if (tl) {
    const [name, list] = TOOLS[tl.k].units[tl.i];
    showTip({ title: name, sub: `${list.length}건`, text: list.length ? list.slice(0, 3).map((x) => x.title).join(' · ') : '아직 비어 있어요.', job: '누르면 직원이 가서 꺼내 와요' }, e.clientX, e.clientY);
    hoverRoom(null); stage.classList.add('hover'); return;
  }
  const fu = mode === 'band' && pickFurn();
  if (fu) { hooks.furnInfo && showTip(hooks.furnInfo(fu), e.clientX, e.clientY); furnHover(fu); hoverRoom(null); stage.classList.add('hover'); return; }
  furnHover(null);
  hideTip();
  const k = pick(e);
  stage.classList.toggle('hover', !!k);
  hoverRoom(k);
});
renderer.domElement.addEventListener('pointerup', (e) => {
  stage.classList.remove('drag');
  if (drag && !drag.moved) {
    const ch = pickChar(e);
    if (ch) showTip(ch.info, e.clientX, e.clientY); // 휴대폰은 눌러서 설명 보기
    else {
      hideTip();
      const fu = mode === 'band' && pickFurn();
      const fuHit = fu && ray.intersectObjects(furnBoxes, false)[0];
      const bk = !fu && pickBook(), tl = !fu && !bk && pickTool();
      const tlHit = tl && ray.intersectObjects(TOOLS[tl.k].hits, false)[0];
      // 🚶 방 화면에서는 사장님이 그 가구 앞까지 걸어가서 창을 열어요
      const goNear = (h, fn) => { if (!WALK.on || !h) { fn(); return; } const bz = new THREE.Box3().setFromObject(h.object).max.z; walkTo(h.point.x, bz + .55, fn); };
      if (fu) goNear(fuHit, () => hooks.onFurn?.(fu.room, fu.id));
      else if (mode === 'band' && tl && hooks.onFurn) goNear(tlHit, () => hooks.onFurn(tl.k, 'main'));   // 방 화면: 분류 가구 = 그 방 주 가구 팝업
      else if (bk) libFetch(bk);
      else if (tl) toolFetch(tl);
      else if (WALK.on && ray.ray.intersectPlane(floorPlane.set(floorPlane.normal, -walkBounds(WALK.k).y), floorHit)) walkTo(floorHit.x, floorHit.z);   // 바닥을 누르면 그리로
      else { const k = pick(e); if (k) chooseRoom(k); }
    }
  }
  drag = null;
});
renderer.domElement.addEventListener('pointerleave', () => { hoverRoom(null); libHover(null); hideTip(); });
function pickFurn() { const h = ray.intersectObjects(furnBoxes, false)[0]; return h ? h.object.userData.furn : null; }
let furnLit = null;
function furnHover(f) { if (furnLit === f) return; furnBoxes.forEach((b) => { b.material.opacity = f && b.userData.furn === f ? .18 : 0; }); furnLit = f; }
// 캐릭터를 맞혔는지 (pick 이 광선을 맞춘 뒤에 불러요)
function pickChar(e) {
  pick(e);
  const hit = ray.intersectObjects(people.map((c) => c.root), true)[0];
  let o = hit?.object;
  while (o && !o.userData.char) o = o.parent;
  return o?.userData.char?.info ? o.userData.char : null;
}
stage.addEventListener('wheel', (e) => {
  if (mode === 'band') return; // 층 화면에서는 휠로 페이지를 내려요
  e.preventDefault();
  goal.dist = THREE.MathUtils.clamp(goal.dist * (1 + Math.sign(e.deltaY) * .1), 8, 140);
}, { passive: false });
labelsEl.addEventListener('click', (e) => { const s = e.target.closest('.sign'); if (s) chooseRoom(s.dataset.room); });
document.getElementById('back').addEventListener('click', () => { target = null; overview(); renderBoard(); });
addEventListener('keydown', (e) => {
  if (!visible || mode !== 'home' || e.key !== 'Escape') return;
  if (!manualEl.hidden) showManual(false);
  else if (drawer.classList.contains('open')) setDrawer(false);
  else if (selected) { target = null; overview(); renderBoard(); }
});

// ---------- 화면보호기처럼: 서랍 · 전체 화면 · 가만히 있으면 단추 숨기고 천천히 둘러보기 ----------
const drawer = document.getElementById('drawer');
const hudMenu = document.getElementById('hudMenu');
function setDrawer(open) {
  drawer.classList.toggle('open', open);
  hudMenu.setAttribute('aria-expanded', String(open));
  if (open) { hideTip(); drawer.focus?.(); }
  poke();
}
// 서랍에 보일 판: staff(직원 고르기) · boss(사장님 고르기) · null(전부, ☰ 메뉴)
function openPanel(mode) {
  document.getElementById('pnlStaff').hidden = mode === 'boss';
  document.getElementById('pnlBoss').hidden = mode === 'staff';
  document.getElementById('b3dTop').hidden = !!mode;
  drawer.querySelector('.head h2').textContent = mode === 'staff' ? '직원 고르기' : mode === 'boss' ? '사장님 고르기' : '메뉴';
  setDrawer(true);
}
hudMenu.addEventListener('click', () => (drawer.classList.contains('open') ? setDrawer(false) : openPanel(null)));

// ---------- 게임 메뉴 (첫 화면 왼쪽 큰 단추) · 매뉴얼 ----------
const manualEl = document.getElementById('manual');
function showManual(on) {
  manualEl.hidden = !on;
  if (on) { setDrawer(false); document.getElementById('manX').focus(); }
}
document.getElementById('manX').addEventListener('click', () => showManual(false));
// 머리줄의 '문쌤의 AI 연구소' 이름을 누르면: 메뉴 · 매뉴얼을 접고 건물 전체 보기
document.querySelector('.brand')?.addEventListener('click', () => {
  showManual(false);
  setDrawer(false);
  target = null;
  overview();
  renderBoard();
});
manualEl.addEventListener('click', (e) => { if (e.target === manualEl) showManual(false); });
document.getElementById('gameMenu').addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (!b) return; // [사진·PDF 넣기]는 data-act="upload" 라 앱이 받아요
  if (b.dataset.go === 'staff') { target = null; overview(); openPanel('staff'); renderBoard(); }
  if (b.dataset.go === 'boss') { target = null; enter('boss'); openPanel('boss'); renderBoard(); }
  if (b.dataset.go === 'theme') setTheme(STATE.theme + 1);
  if (b.dataset.go === 'look') { STATE.look = STATE.look === 2 ? 0 : 2; save(); rebuild(); }
  if (b.dataset.go === 'manual') showManual(true);
});
document.getElementById('drawerX').addEventListener('click', () => setDrawer(false));
const fsBtn = document.getElementById('hudFs');
fsBtn.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
document.addEventListener('fullscreenchange', () => {
  const on = !!document.fullscreenElement;
  fsBtn.textContent = on ? '✕' : '⛶';
  fsBtn.setAttribute('aria-label', on ? '전체 화면 나가기' : '전체 화면');
  fsBtn.title = fsBtn.getAttribute('aria-label');
});
let lastInput = performance.now(), idleT = null;
function poke() {
  lastInput = performance.now();
  root.classList.remove('idle');
  clearTimeout(idleT);
  idleT = setTimeout(() => { if (!drawer.classList.contains('open')) { root.classList.add('idle'); hideTip(); } }, 3500);
}
['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => addEventListener(ev, poke, { passive: true }));

// --- 건물 시안 고르기 (아래 가운데 ◀ ▶) ---
const themePick = document.getElementById('themePick');
themePick.innerHTML = THEMES.map((x) => `<button type="button" data-th="${x.id}" aria-label="${x.id}. ${x.name}" title="${x.id}. ${x.name}">${x.id}</button>`).join('');
function setTheme(id) {
  STATE.theme = ((id - 1 + THEMES.length) % THEMES.length) + 1;
  save();
  buildWorld();
  if (!selected) overview(); // 겉모양이 다른 시안(8~12번)은 크기가 달라서 다시 맞춰 봐요
  renderTheme();
}
function renderTheme() {
  document.getElementById('thName').textContent = `${STATE.theme}. ${theme().name}`;  themePick.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.th) === STATE.theme)));
}
themePick.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTheme(Number(b.dataset.th)); });
document.getElementById('thPrev').addEventListener('click', () => setTheme(STATE.theme - 1));
document.getElementById('thNext').addEventListener('click', () => setTheme(STATE.theme + 1));
addEventListener('keydown', (e) => {
  if (!visible || mode !== 'home' || drawer.classList.contains('open') || e.target.closest?.('input, textarea, select, dialog')) return;
  if (e.key === 'ArrowLeft') setTheme(STATE.theme - 1);
  if (e.key === 'ArrowRight') setTheme(STATE.theme + 1);
});

// ---------- 배치판 ----------
const stepEl = document.getElementById('stepText');
const floorsEl = document.getElementById('floors');
const staffEl = document.getElementById('staff');
const friendsEl = document.getElementById('friends');
// 직원을 둘 수 있는 방 (사장실은 나 · 친구 자리, 창고는 빈 방)
const staffable = (k) => k !== 'boss'; // 창고에도 직원을 둘 수 있어요 (안 두면 빈 창고)
const STAFF_FLOORS = FLOORS.map((f) => ({ ...f, rooms: f.rooms.filter(staffable) })).filter((f) => f.rooms.length);

// 서랍이 닫혀 있으면 그 방 화면으로 들어가고, 서랍(배치판)이 열려 있으면 배치할 방으로 골라요
function chooseRoom(k) {
  if (mode === 'band' && !bandRooms.includes(k)) return; // 잘려 안 보이는 옆방은 누르지 않아요
  if (!drawer.classList.contains('open') && hooks.onRoom) { hideTip(); hooks.onRoom(k); return; }
  if (k === 'boss') { target = null; enter('boss'); renderBoard(); return; }
  target = { kind: 'room', key: k };
  enter(k);
  renderBoard();
}
function targetRooms() {
  if (!target) return [];
  return target.kind === 'room' ? [target.key].filter(staffable) : FLOORS.find((f) => f.floor === target.key).rooms.filter(staffable);
}
function renderBoard() {
  floorsEl.innerHTML = STAFF_FLOORS.map((f) => {
    const whole = target?.kind === 'floor' && target.key === f.floor;
    return `<div class="frow">
      <button type="button" class="fbtn ${whole ? 'on' : ''}" data-floor="${f.floor}">${f.floor}<small>${f.rooms.length > 1 ? '층 전체' : f.name}</small></button>
      <div class="rooms">${f.rooms.map((k) => `<button type="button" class="rbtn ${(target?.kind === 'room' && target.key === k) || whole ? 'on' : ''}" data-room="${k}">${ROOMS[k].name}<small>${STATE.assign[k] ? staffById(STATE.assign[k]).name : '비어 있음'}</small></button>`).join('')}</div>
    </div>`;
  }).join('');
  const rooms = targetRooms();
  const current = new Set(rooms.map((k) => STATE.assign[k]));
  stepEl.innerHTML = rooms.length
    ? `<b>${target.kind === 'floor' ? `${target.key} 층 전체` : ROOMS[target.key].name}</b>에서 일할 직원을 오른쪽에서 누르세요.`
    : '① 층이나 방을 고르고 ② 아래에서 직원을 누르면 그 자리에 배치돼요. 서랍이 열려 있을 때는 건물 속 방을 눌러도 골라져요.';
  staffEl.querySelectorAll('.pc').forEach((el) => {
    const id = Number(el.dataset.id);
    el.classList.toggle('on', current.has(id));
    el.querySelector('small').textContent = where(id).join(' · ') || STAFF.find((s) => s.id === id).note;
  });
  friendsEl.querySelectorAll('.pc').forEach((el) => el.classList.toggle('on', Number(el.dataset.id) === STATE.friend));
  const fr = friendById(STATE.friend), me = ME.find((m) => m.id === STATE.me) || ME[0];
  document.getElementById('friendNote').innerHTML = `지금 친구: <b>${fr.name}</b> · ${fr.note}`;
  document.getElementById('meNote').innerHTML = `<b>${me.name}</b> · ${me.note}`;
  document.querySelectorAll('#mePick button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.me) === STATE.me)));
  document.querySelectorAll('#genderPick button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === STATE.gender)));
  markSigns();
}
floorsEl.addEventListener('click', (e) => {
  const f = e.target.closest('.fbtn'), r = e.target.closest('.rbtn');
  if (f) { target = { kind: 'floor', key: f.dataset.floor }; FLOORS.find((x) => x.floor === f.dataset.floor).rooms.length > 1 ? enterFloor(f.dataset.floor) : enter(FLOORS.find((x) => x.floor === f.dataset.floor).rooms[0]); renderBoard(); }
  if (r) chooseRoom(r.dataset.room);
});
staffEl.addEventListener('click', (e) => {
  const c = e.target.closest('.pc');
  if (!c) return;
  const rooms = targetRooms();
  if (!rooms.length) { stepEl.innerHTML = '<b>먼저 위에서 층이나 방을 골라 주세요.</b> 그다음 직원을 누르면 배치돼요.'; return; }
  rooms.forEach((k) => { STATE.assign[k] = Number(c.dataset.id); });
  save();
  rebuild();
});
friendsEl.addEventListener('click', (e) => {
  const c = e.target.closest('.pc');
  if (!c) return;
  STATE.friend = Number(c.dataset.id);
  save();
  rebuild();
  enter('boss');
});
const mePick = document.getElementById('mePick');
mePick.innerHTML = ME.map((m) => `<button type="button" data-me="${m.id}" aria-pressed="false"><b>${m.id}</b>${m.name}</button>`).join('');
mePick.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  STATE.me = Number(b.dataset.me);
  save();
  rebuild();
  enter('boss');
});
document.getElementById('genderPick').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  STATE.gender = b.dataset.g;
  save();
  rebuild();
  enter('boss');
});
// 카드에 마우스를 올려도 설명이 떠요
for (const [el, info] of [[staffEl, (id) => staffInfo(id)], [friendsEl, (id) => friendInfo(id)]]) {
  el.addEventListener('pointermove', (e) => { const c = e.target.closest('.pc'); if (c) showTip(info(Number(c.dataset.id)), e.clientX, e.clientY); else hideTip(); });
  el.addEventListener('pointerleave', hideTip);
  el.addEventListener('focusin', (e) => { const c = e.target.closest('.pc'); if (!c) return; const r = c.getBoundingClientRect(); showTip(info(Number(c.dataset.id)), r.left, r.bottom - 10); });
  el.addEventListener('focusout', hideTip);
}
document.getElementById('reset').addEventListener('click', () => {
  Object.assign(STATE, { assign: { ...DEFAULT.assign }, me: DEFAULT.me, friend: DEFAULT.friend, gender: STATE.gender, theme: STATE.theme });
  save();
  target = null;
  rebuild();
  overview();
});
function rebuild() { syncLook(); buildWorld(); renderBoard(); if (WALK.on) startWalk(WALK.k); }   // 다시 그려도 걷던 자리 그대로
// 느낌이 바뀌면 모아 둔 둥근 상자 · 재질을 비우고 서랍의 직원 그림도 다시 찍어요
function syncLook() {
  const want = STATE.look || 0;
  document.querySelector('[data-go="look"]')?.setAttribute('aria-pressed', String(want === 2));
  if (!setLook(want)) return;
  gallery(staffEl, STAFF);
  gallery(friendsEl, FRIENDS);
}

// ---------- 캐릭터 사진(작은 3D 그림) ----------
const TW = 120, TH = 128;
thumbR.setPixelRatio(2);
thumbR.setSize(TW, TH, false);
const tScene = new THREE.Scene();
tScene.add(new THREE.HemisphereLight('#ffffff', '#b9a68a', 1.8));
const tSun = new THREE.DirectionalLight('#fff4e2', 2);
tSun.position.set(-3, 6, 6);
tScene.add(tSun);
const tCam = new THREE.PerspectiveCamera(28, TW / TH, .05, 50);
const box3 = new THREE.Box3(), size = new THREE.Vector3(), center = new THREE.Vector3();
function snapshot(def, canvas) {
  const c = makeChar(def);
  c.groups.forEach(({ name, g }) => { if (name === 'flapL') g.rotation.y = .5; if (name === 'flapR') g.rotation.y = -.5; });
  tScene.add(c.root);
  box3.setFromObject(c.root);
  box3.getSize(size); box3.getCenter(center);
  const dist = (Math.max(size.y, size.x * TH / TW) / 2) / Math.tan(THREE.MathUtils.degToRad(tCam.fov / 2)) * 1.25 + size.z / 2;
  tCam.position.set(center.x - Math.sin(.42) * dist, center.y + dist * .2, center.z + Math.cos(.42) * dist);
  tCam.lookAt(center);
  thumbR.render(tScene, tCam);
  canvas.width = TW * 2; canvas.height = TH * 2;
  canvas.getContext('2d').drawImage(thumbR.domElement, 0, 0);
  tScene.remove(c.root);
}
function gallery(el, list) {
  el.innerHTML = list.map((x) => `<button type="button" class="pc" data-id="${x.id}"><canvas aria-hidden="true"></canvas><b><span>${x.id}</span>${x.name}</b><small>${x.note}</small></button>`).join('');
  el.querySelectorAll('.pc').forEach((btn, i) => snapshot(list[i].def(), btn.querySelector('canvas')));
}

// ---------- 화면 크기 · 이름표 위치 ----------
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return; // 다른 방 화면을 보는 동안(숨김)은 크기가 0
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (mode === 'band' && selected) { const k = selected; focusRoom(k); return; }
  if (!selected) overview(); else if (target?.kind === 'floor') enterFloor(target.key); else enter(selected);
}
const tmp = new THREE.Vector3();
function placeLabels() {
  const w = stage.clientWidth, h = stage.clientHeight;
  for (const it of labelItems) {
    const { el } = it, pos = OUT.on ? it.posOut : it.pos;
    if (!pos) { el.style.visibility = 'hidden'; continue; }
    tmp.copy(pos).project(camera);
    // 층 화면에서는 그 층 방 이름표만 (이웃 층 이름표 · 층 번호는 숨겨요)
    const other = mode === 'band' && !bandRooms.includes(el.dataset.room);
    const off = other || tmp.z > 1 || tmp.x < -1.1 || tmp.x > 1.1 || tmp.y < -1.1 || tmp.y > 1.1;
    el.style.visibility = off ? 'hidden' : 'visible';
    if (!off) el.style.translate = `${((tmp.x + 1) / 2) * w}px ${((1 - tmp.y) / 2) * h}px`;
  }
}

// 학교 컴퓨터처럼 Windows '애니메이션 효과'가 꺼져 있으면 브라우저가 '움직임 줄이기'를 알려 와요.
// 예전에는 그때 모두 멈췄는데, 움직이는 건물이 이 화면의 핵심이라 설정과 상관없이 움직여요.
const clock = new THREE.Clock();
let t = 0, tour = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), .05);
  if (!visible) return; // 숨어 있는 동안은 그리지 않아요
  t += dt;
  for (const c of people) if (c.role !== 'player') animate(c, t);
  stepWalk(dt, t);
  stepLibrary(dt);
  stepTools(dt);
  for (const { d, x0, x1, off } of docs) d.position.x = x0 + (((t * .18 + off) % 1) * (x1 - x0));
  if (flag) flag.rotation.y = Math.sin(t * 3) * .25;
  for (const a of anims) a(t);
  stepPrecip(dt, t);
  stepClouds(dt);
  for (const b of bobbers) b.m.position.y = b.y0 + Math.sin(t * 1.5 + b.ph) * .12;
  // 6초 넘게 가만히 있으면 화면보호기처럼 천천히 둘러봐요 (건물 전체 보기일 때만)
  if (!selected && !drag && !drawer.classList.contains('open') && performance.now() - lastInput > 6000) {
    tour += dt;
    goal.yaw = -.32 + Math.sin(tour * .09) * .5;
    goal.pitch = (OUT.on ? .42 : .16) + Math.sin(tour * .05) * .05;
  }
  // 8~12번 시안: 건물 전체 보기에서는 겉모양 모형, 방에 들어가면 상자 건물 속 방
  const ext = extOn();
  if (ext !== OUT.on) { OUT.on = ext; world.visible = !ext; outside.visible = ext; hoverRoom(null); }
  placeCamera();
  renderer.render(scene, camera);
  placeLabels();
}

await Promise.race([document.fonts.load(`34px ${FONT}`), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});
syncLook();
gallery(staffEl, STAFF);
gallery(friendsEl, FRIENDS);
buildWorld();
renderBoard();
renderTheme();
poke();
new ResizeObserver(resize).observe(stage);
resize();
// 미리 보기: ?focus=boss 처럼 붙이면 그 방을 가까이 비춰요
const FOCUS = new URLSearchParams(location.search).get('focus');
if (FOCUS && ROOMS[FOCUS]?.box) enter(FOCUS);
view.target.copy(goal.target); view.dist = goal.dist; view.yaw = goal.yaw; view.pitch = goal.pitch;
loop();
// 날씨: 처음 한 번, 그 뒤 1분마다 위치(근무 시간이면 서울)와 해 위치를 다시 봐요 (날씨 자체는 15분마다 새로 받아요)
refreshWeather();
setInterval(refreshWeather, 60e3);

// ---------- 앱과 잇는 곳 ----------
export function connect(h) { Object.assign(hooks, h); }
export function setVisible(on) {
  if (visible === on) return;
  visible = on;
  root.hidden = !on;
  if (on) { clock.getDelta(); resize(); poke(); } else { hideTip(); setDrawer(false); }
}
// 이름표 옆 숫자: { lobby: { n: 3, hot: true }, ... }
export function setBadges(map) {
  for (const [k, b] of Object.entries(map)) if (ROOMS[k]) Object.assign(ROOMS[k], { n: b.n, hot: !!b.hot });
  labelsEl.querySelectorAll('.sign').forEach((el) => {
    const r = ROOMS[el.dataset.room], i = el.querySelector('i');
    i.textContent = r.n;
    i.className = r.hot ? 'hot' : '';
    i.hidden = !r.n;
  });
}
// 방마다 분류 가구에 넣을 자료: { cards: [{ room, kind, title, subject, date, status, category }], caps: [{ at: 'YYYY-MM-DD', name }] }
// 칸 이름 · 수가 바뀌었을 때만 건물을 다시 그려요 (카드가 들어올 때마다)
let toolKey = '';
export function setRoomData(data) {
  ROOM_DATA = { cards: data?.cards || [], caps: data?.caps || [] };
  const key = JSON.stringify(Object.keys(TOOL_FURN).map((k) => toolUnits(k).map(([n, l]) => `${n}:${l.length}`)));
  if (key === toolKey) return;
  const first = !toolKey;
  toolKey = key;
  if (first && !Object.keys(TOOLS).length) return; // 아직 건물을 안 그렸으면 처음 그릴 때 들어가요
  rebuild();
}
// 타교과실 도서관 책: 그 방 카드들 [{ id, subject, title }] (바뀐 게 없으면 다시 꽂지 않아요)
export function setLibrary(cards) {
  const next = (cards || []).map((c) => ({ id: c.id, subject: String(c.subject || ''), title: String(c.title || '') }));
  const key = JSON.stringify(next);
  if (key === LIB.key) return;
  LIB.key = key;
  LIB_DATA = next;
  libFill();
}
// Firebase 에서 불러온 설정으로 바꾸기 (저장하지 않고 그리기만)
export function setState(s) {
  if (!s || performance.now() - lastLocal < 3000) return;
  const keep = JSON.stringify(STATE);
  Object.assign(STATE, {
    assign: { ...DEFAULT.assign, ...onlyRooms(s.assign) },
    me: s.me || STATE.me, friend: s.friend || STATE.friend,
    gender: s.gender === 'f' ? 'f' : s.gender === 'm' ? 'm' : STATE.gender,
    theme: s.theme || STATE.theme,
    layout: s.layout || STATE.layout,
    look: s.look === 2 ? 2 : s.look === 0 ? 0 : STATE.look,
  }, PREVIEW);
  if (JSON.stringify(STATE) === keep) return;
  try { localStorage.setItem('ailab3d', JSON.stringify(STATE)); } catch {}
  rebuild();
  renderTheme();
}
// 건물 시안 8~12번이면 그 모양의 층 이름 [한 글자, 이름] (예: 리조트 2F → ['동', '동쪽 방갈로']), 아니면 null
export function areaOf(floor) { return FORM_AREAS[theme().form]?.[floor] || null; }
// 첫 화면(home) ↔ 층 화면 위쪽 띠(band)
export function setMode(m) {
  if (mode === m) return;
  mode = m;
  root.classList.toggle('band', m === 'band');
  applyBandVis();
  if (m === 'home') { stopWalk(); target = null; overview(); renderBoard(); } else { hideTip(); setDrawer(false); }
  resize();
}
// 층 화면: 그 방이 있는 층으로 카메라가 가서 그 방 한 칸만 보여요
// instant = 엘리베이터 문이 닫혀 있는 동안 도착해 있도록 바로 옮기기 (같은 층 옆방이면 옆으로 미끄러져요)
export function focusRoom(k, instant = false) {
  const f = FLOORS.find((x) => x.rooms.includes(k));
  if (!f) return;
  target = null;
  enterFloor(f.floor);
  selected = k;
  bandRooms = [k];
  bandFloor = f.floor;
  applyBandVis();
  const b = ROOMS[k].box;
  goal.yaw = -.12;
  goal.target.x = b.cx;
  goal.dist = fitDist(b.w + 1, FH + .8) + D / 2;
  clipGoal.a = b.cx - b.w / 2 - .3;
  clipGoal.b = b.cx + b.w / 2 + .3;
  markSigns();
  // 🚶 방 화면: 사장님이 들어와서 걸어 다녀요
  if (mode === 'band') { startWalk(k); goal.pitch = .5; goal.yaw = 0; stepWalk(0, t); }
  if (instant) { view.target.copy(goal.target); view.dist = goal.dist; view.yaw = goal.yaw; view.pitch = goal.pitch; Object.assign(clip, clipGoal); }
}
// 층 화면 아래: 그 방에서 일할 직원 고르기 (앱이 자리를 만들어 주면 채워요)
export function staffPicker(el, k) {
  if (!el) return;
  el.hidden = !staffable(k);
  if (el.hidden) return;
  const now = STATE.assign[k];
  const empty = ROOMS[k].store ? `<button type="button" class="pc none ${now ? '' : 'on'}" data-id="0" aria-pressed="${!now}"><span>비우기</span></button>` : '';
  el.innerHTML = `<h3>${ROOMS[k].name}에서 일할 직원</h3>
    <div class="sp-row">${empty}${STAFF.map((s) => `<button type="button" class="pc ${now === s.id ? 'on' : ''}" data-id="${s.id}" aria-pressed="${now === s.id}"><canvas aria-hidden="true"></canvas><small>${s.name}</small></button>`).join('')}</div>`;
  // 서랍의 직원 그림을 그대로 옮겨 그려요 (새로 찍지 않아서 빨라요)
  const src = staffEl.querySelectorAll('canvas');
  el.querySelectorAll('canvas').forEach((c, i) => { c.width = src[i].width; c.height = src[i].height; c.getContext('2d').drawImage(src[i], 0, 0); });
  el.onclick = (e) => {
    const b = e.target.closest('.pc');
    if (!b) return;
    const id = Number(b.dataset.id);
    if (id) STATE.assign[k] = id; else delete STATE.assign[k];
    save();
    rebuild();
    staffPicker(el, k);
  };
  el.onpointermove = (e) => { const c = e.target.closest('.pc'); if (c && Number(c.dataset.id)) showTip(staffInfo(Number(c.dataset.id)), e.clientX, e.clientY); else hideTip(); };
  el.onpointerleave = hideTip;
}
// 서랍 맨 위에 앱이 넣는 내용 (로그인 안내 · 다가오는 일정 등)
export function setTop(html) { document.getElementById('b3dTop').innerHTML = html; }
