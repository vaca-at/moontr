// AI Lab — 첫 화면은 건물 단면(A), 층 안은 엘리베이터(B), 1층 접수처는 작업 라인(D)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs, getDoc,
  serverTimestamp, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';
import { APP_NAME, ROOMS, FLOORS } from './rooms.js';

const REGION = 'asia-northeast3';
const DEFAULT_STEPS = ['주제 정하기', '참고 지도안 고르기', '내 지도안 쓰기', '수업 실행', '성찰 정리·제출'];

// riding = 엘리베이터가 움직이는 중(그동안은 화면을 다시 그리지 않아요), doorsShut = 다음 화면을 문 닫힌 채로 그리고 열기
const S = { user: null, teacher: false, cards: [], captures: [], task: null, building: null, uploading: new Map(), readStart: {}, // uploading = { 번호: { name, sent, total } }, readStart = 다 올리고 읽기 시작한 시각
 q: '', subj: '', pending: { link: '', memo: '' }, dirty: false, riding: false, doorsShut: false, focused: '', pick: {} }; // pick = 두 칸 방에서 고른 카드 { 방: 카드 id }
let auth, db, storage, fns;
let unsubs = [];
// 첫 화면 3D 건물 (building3d.js). null = 불러오는 중, false = 이 브라우저에서 3D가 안 돼서 예전 그림으로
let B3 = null;

// ---------- 작은 도구 ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
function dday(date) {
  if (!isDate(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date();
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000);
}
const ddLabel = (n) => (n === 0 ? 'D-DAY' : n > 0 ? `D-${n}` : `D+${-n}`);
function ddChip(date, endDate) {
  const n = dday(date);
  if (n === null) return '';
  const end = dday(endDate);
  if (n < 0 && end !== null && end >= 0) return '<span class="dd">진행 중</span>';
  return `<span class="dd ${n < 0 ? 'past' : n <= 7 ? '' : 'soft'}">${ddLabel(n)}</span>`;
}
function fmtDate(date) {
  if (!isDate(date)) return '';
  const [y, m, d] = date.split('-').map(Number);
  return `${m}.${d}(${'일월화수목금토'[new Date(y, m - 1, d).getDay()]})`;
}
const tsDate = (ts) => { const d = ts?.toDate?.(); return d ? `${d.getMonth() + 1}.${d.getDate()}` : ''; };
const field = (c, label) => (c.fields || []).find((f) => f.label === label)?.value || '';
const roomName = (k) => ROOMS[k]?.name || '분류 전';
const floorOf = (k) => FLOORS.find((f) => f.rooms.includes(k)) || { floor: '·', name: roomName(k), rooms: [k] };
const isUnsorted = (c) => !ROOMS[c.room]?.ai;
const cardsIn = (k) => S.cards.filter((c) => c.room === k);
const cardById = (id) => S.cards.find((c) => c.id === id);
// moontr.site의 다른 웹앱처럼 컬렉션 이름 앞에 ailab_ 을 붙입니다 (ailab_cards, ailab_captures, ailab_meta)
const dbPath = (p) => `ailab_${p}`;
const isGuest = () => !S.teacher;
const isPast = (c) => isDate(c.date) && (c.end_date || c.date) < todayStr();
function safeUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  const full = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try { return new URL(full).href; } catch { return ''; }
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

// 날짜가 다가오는 것 → 날짜 없는 것(최근순) → 지난 것(최근순)
function sortCards(list) {
  const t = todayStr();
  const up = list.filter((c) => isDate(c.date) && (c.end_date || c.date) >= t).sort((a, b) => a.date.localeCompare(b.date));
  const none = list.filter((c) => !isDate(c.date));
  const past = list.filter((c) => isDate(c.date) && (c.end_date || c.date) < t).sort((a, b) => b.date.localeCompare(a.date));
  return { live: [...up, ...none], past };
}

// ---------- 시작 ----------
async function loadConfig() {
  const { firebaseConfig } = await import('./firebase-config.js');
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) throw new Error('firebase-config.js에 Firebase 설정값을 넣어 주세요.');
  return firebaseConfig;
}

async function start() {
  document.title = APP_NAME;
  document.querySelectorAll('.app-name').forEach((el) => { el.textContent = APP_NAME; });
  const app = initializeApp(await loadConfig());
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  fns = getFunctions(app, REGION);

  onAuthStateChanged(auth, (user) => {
    unsubs.forEach((u) => u());
    unsubs = [];
    Object.assign(S, { user, teacher: false, cards: [], captures: [], task: null, building: null });
    updateAuthUI();
    render();
    if (user) subscribe();
  });

  // 머리줄 높이만큼 아래에서 3D 건물이 시작해요
  const top = $('.top');
  const setHdr = () => document.documentElement.style.setProperty('--hdr', `${top.offsetHeight}px`);
  new ResizeObserver(setHdr).observe(top);
  setHdr();
  import('./building3d.js').then((m) => {
    B3 = m;
    m.connect({ onRoom: (k) => { location.hash = k; }, onChange: saveBuilding });
    // 저장된 설정을 그리다 문제가 나도 3D 건물은 그대로 써요 (그림 건물로 바뀌지 않게)
    if (S.building) try { m.setState(S.building); } catch (e) { console.error('저장된 건물 설정을 그리지 못했어요', e); }
    render();
  }).catch((e) => { console.error('3D 건물을 불러오지 못했어요', e); B3 = false; S.b3Err = e?.message || String(e); render(); });
}

// 직원 배치 · 사장실 · 건물 시안: 로그인한 선생님이면 Firebase 에 저장 (어느 기기에서든 같게)
let buildingT = null;
function saveBuilding(state) {
  if (!S.teacher) return;
  clearTimeout(buildingT);
  buildingT = setTimeout(() => {
    setDoc(doc(db, dbPath('meta/building')), { ...state, updatedAt: serverTimestamp() })
      .catch((e) => toast(`건물 설정을 저장하지 못했어요 (${e.code})`));
  }, 800);
}

// 로그인하지 않아도 건물(첫 화면)은 보이고, 자료는 관리자(규칙의 isTeacher) 계정으로 들어와야 보여요.
function updateAuthUI() {
  document.body.classList.toggle('guest', isGuest());
  $('#authBtn').textContent = S.user ? '나가기' : '선생님 로그인';
  $('#authBtn').dataset.act = S.user ? 'logout' : 'login';
}

async function login() {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') toast(`로그인하지 못했어요 (${e.code || e.message})`);
  }
}

function subscribe() {
  const denied = (e) => {
    if (e.code === 'permission-denied') {
      toast('이 계정으로는 자료를 볼 수 없어요. 관리자 계정으로 로그인해 주세요.');
      signOut(auth);
    } else toast(`자료를 불러오지 못했어요 (${e.code})`);
  };
  unsubs.push(onSnapshot(query(collection(db, dbPath('cards')), orderBy('createdAt', 'desc')), (s) => {
    S.cards = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!S.teacher) { S.teacher = true; updateAuthUI(); }
    render();
  }, denied));
  unsubs.push(onSnapshot(query(collection(db, dbPath('captures')), orderBy('createdAt', 'desc')), (s) => {
    S.captures = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    // 문서대장 · 콘솔 결제 화면을 다 읽으면 어디에 넣었는지 알려 줘요 (카드가 생기지 않아서)
    s.docChanges().forEach((ch) => { const d = ch.doc.data(); if (ch.type === 'modified' && d.status === 'done' && (d.registryRows || d.credit != null) && d.note) toast(d.note); });
    render();
  }, denied));
  unsubs.push(onSnapshot(doc(db, dbPath('meta/task')), (s) => {
    S.task = s.exists() ? s.data() : null;
    render();
  }, denied));
  // 명단에서 찾을 내 이름 (공개되는 코드에 넣지 않고 선생님 계정에만 저장)
  unsubs.push(onSnapshot(doc(db, dbPath('meta/me')), (s) => { S.myName = s.exists() ? s.data().name || '' : ''; }, denied));
  // 사장님 계기판: AI 가 쓴 값(서버가 부를 때마다 쌓아요) · 크레딧 · 할 일 · 메모
  unsubs.push(onSnapshot(doc(db, dbPath('meta/usage')), (s) => { S.usage = s.exists() ? s.data() : null; render(); }, denied));
  unsubs.push(onSnapshot(doc(db, dbPath('meta/registry')), (s) => { S.registry = s.exists() ? s.data() : null; render(); }, denied));
  unsubs.push(onSnapshot(doc(db, dbPath('meta/desk')), (s) => { S.desk = s.exists() ? s.data() : {}; render(); }, denied));
  // 점검원 아침 브리핑 (서버 morningBrief · briefNow 가 써요)
  unsubs.push(onSnapshot(doc(db, dbPath('meta/briefing')), (s) => { S.brief = s.exists() ? s.data() : null; render(); }, denied));
  unsubs.push(onSnapshot(doc(db, dbPath('meta/building')), (s) => {
    if (!s.exists()) return;
    S.building = s.data();
    if (B3) B3.setState(S.building);
  }, denied));
}

// ---------- 화면 ----------
const route = () => decodeURIComponent(location.hash.slice(1)) || 'home';

function render() {
  if (!db || S.riding) return;
  // 글을 쓰는 중에는 화면을 다시 그리지 않고, 칸을 벗어날 때 그립니다.
  const ae = document.activeElement;
  if (ae && $('#view').contains(ae) && ae.matches('textarea, input:not([type=checkbox]):not([type=date])')) { S.dirty = true; return; }
  const r = route();
  const b3d = $('#b3d');
  document.body.append(b3d); // 화면을 다시 그리기 전에 3D 무대를 잠깐 빼 두어요 (캔버스는 그대로)
  const admin = !S.q && r === 'admin';
  const home3d = !S.q && !admin && !ROOMS[r] && B3 !== false;
  const band = !S.q && !!ROOMS[r] && !!B3;
  document.body.classList.toggle('home3d', home3d);
  if (home3d) {
    $('#view').innerHTML = '';
  } else {
    $('#view').innerHTML = S.q ? searchView() : admin ? adminView() : ROOMS[r] ? floorView(r) : homeView();
  }
  if (B3) {
    B3.setBadges(Object.fromEntries(Object.keys(ROOMS).map((k) => [k, roomBadge(k)])));
    B3.setLibrary?.(cardsIn('others')); // 타교과실 도서관 책장
    if (band) $('.b3d-slot').append(b3d); // 층 화면: 위쪽 엘리베이터 창 안으로
    B3.setMode(band ? 'band' : 'home');
    B3.setVisible(home3d || band);
    if (home3d) { B3.setTop(isGuest() ? guestSide() : homeSide()); S.focused = ''; }
    if (band && S.focused !== r) { B3.focusRoom(r, S.doorsShut || !S.focused); S.focused = r; }  }
  if (S.doorsShut) {
    S.doorsShut = false;
    setTimeout(() => $('.lift')?.classList.remove('shut'), 160);
  }
  hydrateImages();
  document.body.classList.toggle('busy', S.uploading.size > 0 || S.captures.some((c) => c.status === 'reading'));
}

// --- A. 건물 단면 ---
const PROP = {
  w: '<span class="worker"><span class="bot"></span><span class="desk"></span></span>',
  boss: '<span class="worker"><span class="bot boss"></span><span class="desk"></span></span>',
  b: '<span class="bot"></span>',
  shelf: '<span class="shelf"><i></i><i></i><i></i></span>',
  wb: '<span class="wb"><i></i><i></i><i></i><i></i><i></i><i></i></span>',
  cal: '<span class="cal"></span>',
  easel: '<span class="easel"></span>',
  mailbox: '<span class="mailbox"></span>',
  crates: '<span class="crates"><i></i><i></i><i></i></span>',
  crates6: '<span class="crates"><i></i><i></i><i></i><i></i><i></i><i></i></span>',
};
const DECO = {
  boss: ['wb', 'boss', 'shelf'], train: ['cal', 'w', 'w'], links: ['shelf', 'w', 'shelf'], moral: ['easel', 'b', 'b'],
  others: ['b', 'b', 'b', 'easel'], plans: ['w', 'w', 'shelf'], task: ['wb', 'w'], lobby: ['mailbox', 'w', 'crates'], archive: ['crates6', 'b', 'crates'],
  security: ['wb', 'w', 'w'],
  aiedu: ['wb', 'w', 'w', 'shelf'],
};
const deco = (k) => (DECO[k] || ['w', 'shelf']).map((p) => PROP[p]).join('');

function roomBadge(k) {
  if (ROOMS[k]?.store) return { n: 0, hot: false };
  const review = S.cards.filter((c) => c.status === 'review');
  if (k === 'lobby') {
    const n = S.uploading.size + S.captures.filter((c) => c.status === 'reading' || c.status === 'error').length + review.length;
    return { n, hot: n > 0 };
  }
  if (k === 'archive') return { n: S.captures.length, hot: false };
  if (k === 'boss') return { n: upcoming().filter((c) => dday(c.date) <= 7).length, hot: false };
  return { n: cardsIn(k).length, hot: cardsIn(k).some((c) => c.status === 'review') };
}

function homeView() {
  const floors = FLOORS.map((f) => `
    <div class="fl ${f.floor.startsWith('B') ? 'base' : ''}" style="--n:${f.rooms.length}">
      <span class="fl-no">${esc(f.floor)}</span>
      ${f.rooms.map((k) => {
        const b = roomBadge(k);
        return `<a class="rm" href="#${k}"><span class="rm-sign">${esc(roomName(k))}</span>${b.n ? `<span class="badge ${b.hot ? 'hot' : ''}">${b.n}</span>` : ''}${deco(k)}</a>`;
      }).join('')}
    </div>`).join('');
  // 3D 를 못 불러와 그림 건물로 보일 때: 이유와 새로고침 단추 (인터넷이 잠깐 끊기거나 그래픽이 멈췄을 때가 많아요)
  const fail = B3 === false ? `<p class="b3-fail">3D 건물을 불러오지 못해서 그림으로 보여 드려요${S.b3Err ? ` (${esc(S.b3Err)})` : ''}. <button class="btn primary" data-act="reload">새로고침</button></p>` : '';
  return `${fail}<div class="home">
    <section class="bld" aria-label="${esc(APP_NAME)} 건물">
      <div class="roof"><span class="flag"></span><span class="roof-sign">${esc(APP_NAME)}</span></div>
      ${floors}
      <div class="ground"></div>
    </section>
    <aside class="side">${isGuest() ? guestSide() : homeSide()}</aside>
  </div>`;
}

// 로그인한 선생님의 첫 화면 옆 칸 (3D 건물에서는 ☰ 메뉴 서랍 맨 위)
function homeSide() {
  const reading = S.uploading.size + S.captures.filter((c) => c.status === 'reading').length;
  const review = S.cards.filter((c) => c.status === 'review').length;
  return `<section class="panel">
      <div class="intake-mini">
        <h3>${esc(floorOf('lobby').floor)} 접수처</h3>
        <button class="btn primary" data-act="upload">사진·PDF 넣기</button>
      </div>
      <ul class="queue">
        <li>${reading ? '<span class="spin"></span>' : '<span class="pip" style="background:var(--ok)"></span>'}AI가 읽는 중 ${reading}장</li>
        <li><span class="pip"></span><a href="#lobby">확인 기다리는 카드 ${review}장</a></li>
      </ul>
      <small>캡쳐나 공문 PDF를 화면 어디에든 끌어다 놓거나 Ctrl+V로 붙여 넣어도 바로 들어가요. 공문은 본문과 첨부 PDF를 한꺼번에 넣으면 한 묶음으로 읽어요.</small>
    </section>
    <section class="panel"><h3>${esc(floorOf('boss').floor)} 사장실 · 다가오는 일정</h3>${bossView(true)}</section>`;
}

// --- 로그인 전: 건물 안내만 ---
const SYSTEM_DESC = {
  boss: '다가오는 연수·공개수업·과제 마감을 D-day 순으로 모아 보여 줘요.',
  lobby: '캡쳐를 넣는 곳이에요. 넣는 순간 AI 직원이 읽고 알맞은 방으로 보내요.',
  archive: '넣은 캡쳐 원본을 고치지 않고 그대로 보관해요.',
};
const roomDesc = (k) => SYSTEM_DESC[k] || ROOMS[k]?.desc || '';

function guestSide() {
  return `<section class="panel">
      <h3>층별 안내</h3>
      <p class="sum">연수 공문, 연수 홈페이지, 수업 공개 공문, 다른 선생님 지도안 캡쳐를 AI 직원들이 읽고 층마다 정리하는 연구실이에요.</p>
      <ul class="dir">${FLOORS.map((f) => `<li><b>${esc(f.floor)}</b><span>${f.rooms.map((k) => `<a href="#${k}">${esc(roomName(k))}</a>`).join(' · ')}</span></li>`).join('')}</ul>
      <button class="btn primary" data-act="login">선생님 로그인</button>
      <small>자료는 로그인한 선생님만 볼 수 있어요. 로그인하면 <a href="policy/">이용약관 · 개인정보 처리방침</a>에 동의한 것으로 봐요.</small>
    </section>`;
}

function guestRoom(k) {
  const fields = ROOMS[k]?.fields || [];
  return `<div class="empty">
    <p>${esc(roomDesc(k))}</p>
    ${fields.length ? `<div class="kw">${fields.map((f) => `<span class="chip">${esc(f)}</span>`).join('')}</div>` : ''}
    <p>이 방의 자료는 선생님 로그인 후에 볼 수 있어요.</p>
    <button class="btn primary" data-act="login">선생님 로그인</button>
  </div>`;
}

// --- 관리자 현황 (#admin) ---
// 방문 수(site_counts · site_devices, visit.js 가 세요)는 들어올 때 한 번 불러오고, 자료 현황은 지금 구독 중인 카드 · 캡쳐로 계산해요
const DAYS = 14;
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
async function loadStats() {
  S.statsLoading = true;
  try {
    const days = [...Array(DAYS)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (DAYS - 1 - i)); return dayKey(d); });
    const read = async (id) => { const s = await getDoc(doc(db, 'site_counts', `ailab__${id}`)); return s.exists() ? s.data().n || 0 : 0; };
    const [total, ...daily] = await Promise.all([read('total'), ...days.map((d) => read(`d${d}`))]);
    const dev = await getDocs(query(collection(db, 'site_devices'), where('app', '==', 'ailab')));
    const kinds = { phone: 0, tablet: 0, pc: 0 };
    dev.forEach((d) => { kinds[d.data().kind] = (kinds[d.data().kind] || 0) + 1; });
    S.stats = { total, days: days.map((d, i) => ({ d, n: daily[i] })), devices: dev.size, kinds, at: new Date() };
  } catch (e) {
    S.stats = { error: e.code || e.message, at: new Date() };
  }
  S.statsLoading = false;
  render();
}
function adminView() {
  if (isGuest()) return `<div class="empty"><p>현황은 관리자 계정으로 로그인해야 볼 수 있어요.</p><button class="btn primary" data-act="login">선생님 로그인</button></div>`;
  if (!S.stats && !S.statsLoading) loadStats();
  const st = S.stats;
  const caps = S.captures, cards = S.cards;
  const by = (s) => caps.filter((c) => c.status === s).length;
  const month = todayStr().slice(0, 7);
  const capMonth = caps.filter((c) => { const d = c.createdAt?.toDate?.(); return d && dayKey(d).startsWith(month); }).length;
  const review = cards.filter((c) => c.status === 'review').length;
  const tile = (n, label, extra = '') => `<div class="ad-tile ${extra}"><b>${n}</b><small>${label}</small></div>`;
  const today = st?.days?.at(-1)?.n ?? '…';
  const max = Math.max(1, ...(st?.days || []).map((x) => x.n));
  const bars = st?.days ? `<div class="ad-bars" role="img" aria-label="최근 ${DAYS}일 방문 수">${st.days.map((x, i) => {
    const [, m, d] = x.d.split('-').map(Number);
    const last = i === st.days.length - 1, top = x.n === max && x.n > 0;
    return `<div class="ad-bar" title="${m}월 ${d}일 · ${x.n}번"><span class="v">${last || top ? x.n : ''}</span><i style="height:${Math.round((x.n / max) * 100)}%"></i><span class="d">${i % 2 === (DAYS - 1) % 2 ? `${m}.${d}` : ''}</span></div>`;
  }).join('')}</div>` : `<p class="empty">${st?.error ? `방문 수를 불러오지 못했어요 (${esc(st.error)})` : '방문 수를 불러오는 중이에요…'}</p>`;
  const roomKeys = Object.keys(ROOMS).filter((k) => ROOMS[k].ai);
  const roomMax = Math.max(1, ...roomKeys.map((k) => cardsIn(k).length));
  const errs = caps.filter((c) => c.status === 'error').slice(0, 5);
  const recent = caps.slice(0, 8);
  const label = { reading: '읽는 중', done: '정리됨', error: '읽지 못함' };
  return `<div class="admin">
    <div class="flr-h"><h2>관리자 현황</h2><small>${st?.at ? `방문 수 ${st.at.getHours()}:${pad(st.at.getMinutes())} 기준` : ''}</small>
      <button class="chipbtn" data-act="stats">새로고침</button><a class="chipbtn" href="#">← 건물로</a></div>
    <section class="ad-sec"><h3>방문</h3>
      <div class="ad-tiles">${tile(today, '오늘 방문')}${tile(st?.total ?? '…', '누적 방문')}${tile(st?.devices ?? '…', '방문한 기기')}${st?.kinds ? tile(`${st.kinds.pc} · ${st.kinds.phone} · ${st.kinds.tablet}`, 'PC · 휴대폰 · 태블릿', 'sm') : ''}</div>
      <h4>최근 ${DAYS}일 방문 수</h4>${bars}
      <small>관리자 화면(#admin)과 한 번 들어온 뒤 탭을 닫기 전까지는 다시 세지 않아요.</small>
    </section>
    <section class="ad-sec"><h3>사진 읽기 (AI)</h3>
      <div class="ad-tiles">${tile(caps.length, '넣은 사진')}${tile(capMonth, '이번 달 넣은 사진')}${tile(by('reading'), '읽는 중')}${tile(by('error'), '읽지 못함', by('error') ? 'bad' : '')}${tile(review, '확인 기다리는 카드', review ? 'warn' : '')}${tile(cards.length, '정리된 카드')}</div>
      ${errs.length ? `<h4>최근 읽지 못한 사진</h4><ul class="ad-list">${errs.map((c) => `<li><span class="st-err">읽지 못함</span><b>${esc(c.name || '사진')}</b><small>${esc(c.error || '')}</small><button class="chipbtn" data-act="reread" data-cap="${c.id}">다시 읽기</button></li>`).join('')}</ul>` : ''}
    </section>
    <section class="ad-sec"><h3>방별 카드</h3>
      <ul class="ad-rooms">${roomKeys.map((k) => { const n = cardsIn(k).length; return `<li><a href="#${k}">${esc(floorOf(k).floor)} ${esc(roomName(k))}</a><span class="track"><i style="width:${Math.round((n / roomMax) * 100)}%"></i></span><b>${n}</b></li>`; }).join('')}</ul>
    </section>
    <section class="ad-sec"><h3>최근 넣은 사진</h3>
      ${recent.length ? `<ul class="ad-list">${recent.map((c) => `<li><span>${esc(tsDate(c.createdAt))}</span><b>${esc(c.name || '사진')}</b><small>${label[c.status] || ''}${c.cardCount ? ` · 카드 ${c.cardCount}` : ''}</small><button class="chipbtn" data-act="cap" data-cap="${c.id}">보기</button></li>`).join('')}</ul>` : '<p class="empty">아직 넣은 사진이 없어요.</p>'}
    </section>
  </div>`;
}

// --- B. 엘리베이터 층 화면 ---
// 3D 창 양옆 화살표: 같은 층 옆방으로 (끝 방이면 그쪽 화살표는 없어요)
const sideRoom = (k, step) => { const rooms = floorOf(k).rooms; return rooms[rooms.indexOf(k) + step]; };
function sideDoor(f, k, step) {
  const r = sideRoom(k, step);
  if (!r) return '';
  const label = `${step < 0 ? '왼쪽' : '오른쪽'} 방: ${roomName(r)}`;
  return `<a class="lift-nav ${step < 0 ? 'prev' : 'next'}" href="#${r}" aria-label="${esc(label)}" title="${esc(label)}">${step < 0 ? '‹' : '›'}</a>`;
}
addEventListener('keydown', (e) => {
  const k = route();
  if (!ROOMS[k] || S.q || S.riding || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable]') || $('#dlg')?.open) return;
  const r = sideRoom(k, e.key === 'ArrowRight' ? 1 : -1);
  if (r) { e.preventDefault(); location.hash = r; }
});
// 층 표시: 건물 시안 8~12번(도서관 · 리조트 …)이면 그 모양의 구역 이름 (예: 2F → '동' 동쪽 방갈로)
const flr = (x) => { const a = B3?.areaOf?.(x.floor); return a ? { code: a[0], name: a[1] } : { code: x.floor, name: x.name }; };
function floorView(k) {
  const f = floorOf(k);
  const floorAlert = (x) => x.rooms.some((r) => roomBadge(r).hot);
  return `<div class="mB">
    <nav class="ev" aria-label="엘리베이터">
      <a class="ev-home" href="#">← 건물 전체</a>
      <div class="ev-disp">${esc(flr(f).code)}<small>${esc(flr(f).name)}</small></div>
      <div class="ev-btns">${FLOORS.map((x) => `<a class="ev-btn ${x === f ? 'on' : ''}" href="#${x.rooms[0]}"><b>${esc(flr(x).code)}${floorAlert(x) ? '<i></i>' : ''}</b><span>${esc(flr(x).name)}</span></a>`).join('')}</div>
      ${(() => { const n = roomBadge('lobby').n; return `<a class="ev-lobby ${k === 'lobby' ? 'on' : ''}" href="#lobby" aria-label="접수처로 가기${n ? ` · 할 일 ${n}` : ''}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h4l1.5 3h5L16 13h4"/><path d="M5.5 6.5 4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5l-1.5-6.5A2 2 0 0 0 16.6 5H7.4a2 2 0 0 0-1.9 1.5Z"/></svg>
        <span>접수처<small>${n ? `할 일 ${n}` : '자료 넣기'}</small></span>${n ? `<em>${n}</em>` : ''}</a>`; })()}
    </nav>
    <section class="flr">
      <div class="flr-h"><h2>${esc(flr(f).name)}</h2>${B3 && k !== 'boss' ? `<button type="button" class="staff-btn" data-act="staffpick" aria-label="${esc(roomName(k))} 직원 고르기" title="${esc(roomName(k))} 직원 고르기"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.8.5 5 2.8 5 5.8"/></svg></button>` : ''}</div>
      ${B3 !== false ? `<div class="lift ${S.doorsShut ? 'shut' : ''}"><div class="b3d-slot"></div><div class="lift-doors" aria-hidden="true"><i></i><i></i></div>${sideDoor(f, k, -1)}${sideDoor(f, k, 1)}</div>` : ''}
      <div class="doors" role="tablist">${f.rooms.map((r) => {
        const b = roomBadge(r);
        return `<a class="door ${r === k ? 'on' : ''}" role="tab" aria-selected="${r === k}" href="#${r}">${esc(roomName(r))}${b.n ? `<span class="cnt">${b.n}</span>` : ''}</a>`;
      }).join('')}</div>
      <div class="room-body">${roomContent(k)}</div>
      <div class="guide"><span class="bot ${k === 'boss' ? 'boss' : ''}"></span><p class="bubble">${esc(guideSay(k))}</p></div>
    </section>
  </div>`;
}

function roomContent(k) {
  if (ROOMS[k]?.store) return storeRoom(k);
  if (isGuest()) return guestRoom(k);
  if (k === 'boss') return bossRoom();
  if (k === 'lobby') return lobbyView();
  if (k === 'archive') return archiveView();
  const r = ROOMS[k];
  const head = r.task ? taskPanel() : k === 'links' ? linkForm() : '';
  const list = cardsIn(k);
  if (!list.length) return head + emptyRoom(k);
  const view = { link: linksView, lesson: lessonsView, plan: plansView, split: splitView }[r.view] || eventsView;
  return head + view(list, k);
}

// 창고: 아직 쓰지 않는 칸. 새 방이 필요하면 rooms.js 에서 이 자리를 방으로 바꿔요
function storeRoom(k) {
  return `<div class="empty"><p>${esc(roomName(k))}는 아직 비어 있어요. 상자만 쌓여 있어요.</p>
    <p>새 방이 필요해지면 이 자리를 방으로 바꿔 쓸 수 있어요. (rooms.js 에서 창고 이름을 새 방으로 바꾸기)</p></div>`;
}

function emptyRoom(k) {
  return `<div class="empty"><p>아직 ${esc(roomName(k))}에 자료가 없어요. 1층 접수처에 캡쳐나 공문 PDF를 넣으면 ${esc(ROOMS[k].role || '직원')}이(가) 읽고 여기로 가져와요.</p><button class="btn primary" data-act="upload">사진·PDF 넣기</button></div>`;
}

function guideSay(k) {
  if (ROOMS[k]?.store) return '빈 창고예요. 새 방이 생기면 제가 정리해서 비워 둘게요.';
  if (isGuest()) return `${roomName(k)} ${ROOMS[k]?.role || '직원'}이에요. 선생님이 오시면 정리한 자료를 보여 드릴게요.`;
  const review = S.cards.filter((c) => c.status === 'review').length;
  if (k === 'boss') {
    const next = upcoming()[0];
    return next ? `다음 일정은 ${fmtDate(next.date)} ‘${next.title}’이에요.` : '아직 날짜가 있는 일정이 없어요.';
  }
  if (k === 'lobby') {
    const reading = S.uploading.size + S.captures.filter((c) => c.status === 'reading').length;
    if (reading) return `지금 ${reading}장을 읽고 있어요. 다 읽으면 아래에 카드가 생겨요.`;
    if (review) return `확인할 카드가 ${review}장 있어요. 노란 칸만 봐 주세요.`;
    return '사진을 넣어 주시면 바로 읽기 시작할게요.';
  }
  if (k === 'archive') return `원본 ${S.captures.length}장을 고치지 않고 그대로 보관하고 있어요.`;
  const list = cardsIn(k);
  if (!list.length) return '사진이 들어오길 기다리고 있어요.';
  if (ROOMS[k].task) {
    const steps = taskSteps();
    const n = dday(S.task?.due);
    return `과제 ${steps.filter((s) => s.done).length}/${steps.length}단계 완료${n !== null && n >= 0 ? `, 제출까지 ${ddLabel(n)}` : ''}.`;
  }
  if (ROOMS[k].view === 'lesson') {
    const week = list.filter((c) => { const n = dday(c.date); return n !== null && n >= 0 && n <= 7; }).length;
    return week ? `일주일 안에 ${roomName(k)} 공개수업이 ${week}건 있어요.` : `${roomName(k)} 공개수업 ${list.length}건을 모아 두었어요.`;
  }
  if (ROOMS[k].view === 'plan') {
    const top = Object.entries(groupBy(list, (c) => field(c, '활동 방식') || '기타')).sort((a, b) => b[1].length - a[1].length)[0];
    return `‘${top[0]}’ 지도안이 ${top[1].length}개로 가장 많아요.`;
  }
  const next = sortCards(list).live.find((c) => isDate(c.date));
  return next ? `‘${next.title}’까지 ${ddLabel(dday(next.date))}예요.` : `자료 ${list.length}건을 정리해 두었어요.`;
}

const groupBy = (list, fn) => list.reduce((m, x) => { (m[fn(x)] ||= []).push(x); return m; }, {});

// --- 카드 부품 ---
const reviewTag = (c) => (c.status === 'review' ? '<span class="chip warn">확인 전</span>' : '');
const uns = (c, key) => ((c.unsure || []).includes(key) ? 'unsure' : '');
const DUP = new Set(['연수명', '수업 제목', '과제명', '수업 주제', '사이트 이름', '공문 제목', '일시', '장소', '교과']);
const extraFields = (c) => (c.fields || []).filter((f) => f.value && !DUP.has(f.label));
function actions(c, more = '') {
  return `<div class="acts">
    ${c.status === 'review' ? `<button class="yes" data-act="confirm" data-id="${c.id}">맞아요</button>` : ''}
    <button data-act="edit" data-id="${c.id}">고치기</button>
    ${c.storagePath ? `<button class="src-btn" data-act="edit" data-id="${c.id}">${thumb(c.storagePath)}원본</button>` : ''}
    ${more}
  </div>`;
}
function periodsTable(c) {
  if (!c.periods?.length) return '';
  return `<table class="periods">${c.periods.map((p) => `<tr><th>${esc(p.label)}</th><td>${esc(p.content)}</td></tr>`).join('')}</table>`;
}
const keywords = (c) => (c.keywords?.length ? `<div class="kw">${c.keywords.map((k) => `<span class="chip">${esc(k)}</span>`).join('')}</div>` : '');
const whenText = (c) => [fmtDate(c.date) + (c.end_date && c.end_date !== c.date ? ` ~ ${fmtDate(c.end_date)}` : ''), c.time].filter(Boolean).join(' ');
function withPast(live, past, fn, wrap = (h) => h) {
  return `${live.length ? wrap(live.map(fn).join('')) : ''}
    ${past.length ? `<details class="pastbox"><summary>지난 자료 ${past.length}건</summary>${wrap(past.map(fn).join(''))}</details>` : ''}`;
}

// 자료 종류 칩: 종류마다 색이 달라요 (연수 안내 파랑 · 대상자 공문 초록 · 신청 노랑 · 홈페이지 보라 · 과제 주황)
const KIND_COLORS = [['target', /대상자|선정|명단/], ['apply', /신청|모집|선발/], ['site', /홈페이지|사이트|누리집/], ['task', /과제|제출/], ['guide', /안내|연수|계획/]];
const kindChip = (c) => (c.kind ? `<span class="chip kind-${(KIND_COLORS.find(([, re]) => re.test(c.kind)) || ['etc'])[0]}">${esc(c.kind)}</span>` : '');
// 내가 대상자인지: '대상자 여부' 칸을 보고 (AI가 헷갈린 칸이면 확인 필요)
function meBadge(c) {
  const f = (c.fields || []).find((x) => x.label === '대상자 여부' && x.value);
  if (!f) return '';
  if (f.unsure) return '<span class="me ask">대상자 여부 확인 필요</span>';
  return /아님|아닙|없음|해당\s*없|미해당|제외/.test(f.value) ? '<span class="me no">대상자 아님</span>' : '<span class="me yes">✓ 나는 대상자</span>';
}

// event: 연수·과제처럼 날짜·장소·교시가 중요한 방
// 카드는 모두 같은 크기: 제목 2줄 · 일시 · 요약 2줄 · 칩(장소 · 이수 시간 · 준비물) · 대상자 여부. 나머지는 '자세히'를 누르면 카드 안에서 펼쳐져요
const PILLS = ['이수 시간', '준비물'];
function eventCard(c) {
  const when = whenText(c);
  const pills = [c.place && ['장소', c.place, uns(c, 'place')], ...PILLS.map((l) => { const f = (c.fields || []).find((x) => x.label === l && x.value); return f && [l === '이수 시간' ? '이수' : l, f.value, f.unsure ? 'unsure' : '']; })].filter(Boolean);
  const rest = extraFields(c).filter((f) => !PILLS.includes(f.label) && f.label !== '대상자 여부');
  const more = rest.length + (c.periods?.length ? 1 : 0);
  return `<article class="card ecard ${isPast(c) ? 'past' : ''}">
    <div class="row">${ddChip(c.date, c.end_date)}${reviewTag(c)}${kindChip(c)}${dupTag(c)}</div>
    <h3 title="${esc(c.title || '')}"><span class="${uns(c, 'title')}">${esc(c.title || '(제목 없음)')}</span></h3>
    <div class="ebody">
      ${when ? `<p class="ewhen ${uns(c, 'date') || uns(c, 'time')}">${esc(when)}</p>` : ''}
      ${c.summary ? `<p class="sum">${esc(c.summary)}</p>` : ''}
      ${pills.length ? `<div class="pills">${pills.map(([k, v, u]) => `<span class="pill ${u}" title="${esc(v)}"><i>${esc(k)}</i>${esc(v)}</span>`).join('')}</div>` : ''}
      ${meBadge(c)}
      ${more ? `<details class="emore"><summary>자세히 ▾ <small>${rest.length ? `항목 ${rest.length}` : ''}${rest.length && c.periods?.length ? ' · ' : ''}${c.periods?.length ? `교시 ${c.periods.length}` : ''}</small></summary>
        ${rest.length ? `<dl class="kv">${rest.map((f) => `<dt>${esc(f.label)}</dt><dd><span class="${f.unsure ? 'unsure' : ''}">${esc(f.value)}</span></dd>`).join('')}</dl>` : ''}
        ${periodsTable(c)}</details>` : ''}
      ${c._older ? `<details class="emore series"><summary>지난 호 ${c._older.length}개 ▾</summary><ul>${c._older.map((o) => `<li><span class="t">${esc(o.title || '')}</span><small>${esc(fmtDate(o.date) || '')}</small>${actions(o)}</li>`).join('')}</ul></details>` : ''}
    </div>
    ${actions(c)}
  </article>`;
}
// 'AI교육 브리핑(10월호)'처럼 달마다 나오는 공문은 한 장으로 묶고, 최신 호를 위에 · 지난 호는 펼쳐 보기로
const MONTHLY = /\(?\s*\d{1,2}\s*월\s*호\s*\)?/;
function seriesFold(list) {
  const by = new Map();
  for (const c of list) {
    const k = MONTHLY.test(c.title || '') ? `s:${c.title.replace(MONTHLY, '').replace(/\s+/g, ' ').trim()}` : c.id;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(c);
  }
  return [...by.values()].map((g) => {
    if (g.length < 2) return g[0];
    g.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return { ...g[0], _older: g.slice(1) };
  });
}
function eventsView(list) {
  const { live, past } = sortCards(seriesFold(list));
  return withPast(live, past, eventCard, (h) => `<div class="grid2">${h}</div>`);
}

// split: 메일함처럼 왼쪽 목록에서 고르면 오른쪽에 그 공문만 크게 (정보 보안실처럼 세부 항목이 긴 방)
function splitView(list, k) {
  const { live, past } = sortCards(list);
  const all = [...live, ...past];
  const sel = all.find((c) => c.id === S.pick[k]) || all[0];
  const pick = (c) => `<button type="button" class="sp-pick ${isPast(c) ? 'past' : ''}" data-act="pickcard" data-id="${c.id}" aria-selected="${c === sel}" role="tab">
      <span class="t">${esc(c.title || '(제목 없음)')}</span>
      <small>${c.date ? `${esc(fmtDate(c.date))} · ` : ''}${esc(c.kind || '')}${c.status === 'review' ? ' · <b>확인 전</b>' : ''}</small>
    </button>`;
  const when = whenText(sel);
  return `<div class="sp">
    <div class="sp-list" role="tablist" aria-label="${esc(roomName(k))} 자료">
      ${live.map(pick).join('')}
      ${past.length ? `<p class="sp-sep">지난 자료 ${past.length}건</p>${past.map(pick).join('')}` : ''}
    </div>
    <article class="sp-detail" role="tabpanel">
      <div class="row">${ddChip(sel.date, sel.end_date)}${reviewTag(sel)}${kindChip(sel)}${dupTag(sel)}</div>
      <h3><span class="${uns(sel, 'title')}">${esc(sel.title || '(제목 없음)')}</span></h3>
      ${sel.summary ? `<p class="sum">${esc(sel.summary)}</p>` : ''}
      <dl class="kv">
        ${when ? `<dt>일시</dt><dd><span class="${uns(sel, 'date') || uns(sel, 'time')}">${esc(when)}</span></dd>` : ''}
        ${sel.place ? `<dt>장소</dt><dd><span class="${uns(sel, 'place')}">${esc(sel.place)}</span></dd>` : ''}
        ${extraFields(sel).map((f) => `<dt>${esc(f.label)}</dt><dd><span class="${f.unsure ? 'unsure' : ''}">${esc(f.value)}</span></dd>`).join('')}
      </dl>
      ${periodsTable(sel)}
      ${actions(sel)}
    </article>
  </div>`;
}

// link: 홈페이지 즐겨찾기
function linkCard(c) {
  const url = safeUrl(c.url);
  const imp = field(c, '중요 안내');
  const from = field(c, '어느 연수에서');
  return `<article class="card tile">
    <div class="row"><span class="fav">${esc((c.title || '?').slice(0, 1))}</span>${reviewTag(c)}${ddChip(c.date, c.end_date)}</div>
    <h3>${esc(c.title || '(이름 없음)')}</h3>
    ${url ? `<a class="url ${uns(c, 'url')}" href="${esc(url)}" target="_blank" rel="noopener">${esc(url.replace(/^https?:\/\//, ''))}</a>` : '<small>주소 없음 · 고치기에서 넣을 수 있어요</small>'}
    ${imp ? `<p><span class="hl">${esc(imp)}</span></p>` : ''}
    ${c.summary ? `<p class="sum">${esc(c.summary)}</p>` : ''}
    ${from ? `<small>${esc(from)}</small>` : ''}
    ${actions(c)}
  </article>`;
}
// 분류(카테고리)별로 묶어 보기. AI가 캡쳐에서 만든 링크는 '어느 연수에서'를 분류로 써요
const linkCat = (c) => c.category || field(c, '어느 연수에서') || '기타';
function linksView(list) {
  const groups = Object.entries(groupBy(list, linkCat)).sort((a, b) => (a[0] === '기타') - (b[0] === '기타') || a[0].localeCompare(b[0], 'ko'));
  return groups.map(([cat, items]) => `<section class="lgrp"><h3>${esc(cat)} <small>(${items.length})</small></h3><div class="tiles">${items.map(linkCard).join('')}</div></section>`).join('');
}
// 링크 서재 맨 위: 링크를 직접 붙여 넣기 (한 줄에 하나, 분류 · 제목 · 주소. 엑셀에서 세 칸을 복사해 붙여도 돼요)
const linkForm = () => `<details class="linkadd" ${S.cards.some((c) => c.room === 'links') ? '' : 'open'}>
    <summary>링크 직접 넣기</summary>
    <label for="linkPaste">한 줄에 하나씩 <b>분류, 제목, 주소</b> 순서로 적어요. 엑셀에서 세 칸을 복사해 붙여 넣어도 돼요.</label>
    <textarea id="linkPaste" rows="4" placeholder="연수, 서울교육연수원 이러닝, https://www.seoul.go.kr/...&#10;수업자료, 에듀넷 티-클리어, https://www.edunet.net"></textarea>
    <button class="btn primary" data-act="addLinks" type="button">링크 넣기</button>
  </details>`;
const URLISH = /^(https?:\/\/|www\.)\S+$|^[\w-]+(\.[\w-]+)+(\/\S*)?$/i;
function parseLinks(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = (line.includes('\t') ? line.split('\t') : line.split(/\s*[,|]\s*(?=\S)/)).map((s) => s.trim()).filter(Boolean);
    const i = parts.findIndex((p) => URLISH.test(p));
    if (i < 0) return null;
    const url = safeUrl(parts[i]), rest = parts.filter((_, j) => j !== i);
    const [category, title] = rest.length >= 2 ? [rest[0], rest.slice(1).join(' ')] : ['기타', rest[0] || url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]];
    return url ? { category, title, url } : null;
  }).filter(Boolean);
}
async function addLinks() {
  const box = $('#linkPaste');
  const links = parseLinks(box?.value || '');
  if (!links.length) { toast('주소가 있는 줄을 찾지 못했어요. "분류, 제목, 주소" 순서로 적어 주세요'); return; }
  const batch = writeBatch(db);
  links.forEach((l) => batch.set(doc(collection(db, dbPath('cards'))), {
    room: 'links', kind: '링크', title: l.title, url: l.url, category: l.category, summary: '', date: '', end_date: '', time: '', place: '', subject: '',
    moral_link: '', keywords: [], fields: [], periods: [], unsure: [], status: 'done', taskRef: false, captureId: '', storagePath: '', manual: true, createdAt: serverTimestamp(),
  }));
  await batch.commit();
  box.value = '';
  toast(`링크 ${links.length}개를 넣었어요`);
}

// lesson: 수업 공개
// 수업 시간은 한 가지로: 시각(15:00~16:00)이 있으면 시각만, 없으면 교시(7교시)만. 학교마다 교시 시각이 달라서 시각이 더 정확해요
function lessonTime(c) {
  const s = [c.time, field(c, '교시')].filter(Boolean).join(' ');
  const range = s.match(/\d{1,2}:\d{2}\s*[~∼-]\s*\d{1,2}:\d{2}/);
  if (range) return range[0].replace(/\s*[~∼-]\s*/, '~');
  const at = s.match(/\d{1,2}:\d{2}/);
  if (at) return at[0];
  const per = s.match(/\d+\s*교시/);
  return per ? per[0].replace(/\s+/, '') : s;
}
function lessonRow(c, k) {
  const [, m, d] = isDate(c.date) ? c.date.split('-').map(Number) : [];
  const wd = isDate(c.date) ? fmtDate(c.date).slice(-2, -1) : '';
  const period = lessonTime(c);
  const where = [field(c, '학교'), c.place || field(c, '장소'), field(c, '학년')].filter(Boolean).join(' · ');
  return `<li class="lesson ${isPast(c) ? 'past' : ''}">
    <span class="date ${uns(c, 'date')}">${m ? `<b>${m}.${d}</b>${esc(wd)} ${esc(period)}` : '<b>?</b>날짜 없음'}</span>
    <div class="body">
      <div class="row">${reviewTag(c)}${ddChip(c.date)}${dupTag(c)}</div>
      <h3>${esc(c.title || field(c, '수업 제목') || '(제목 없음)')}</h3>
      ${where ? `<small>${esc(where)}</small>` : ''}
      ${c.moral_link ? `<span class="link-tip">도덕과 연결: ${esc(c.moral_link)}</span>` : ''}
      ${actions(c)}
    </div>
    <span class="subj ${k === 'moral' ? 'moral' : 'other'} ${uns(c, 'subject')}">${esc(c.subject || field(c, '교과') || (k === 'moral' ? '도덕' : '기타'))}</span>
  </li>`;
}
// 교과 이름을 큰 묶음으로 (인공지능 수학 → 수학, 데이터 과학(정보과) → 정보, 한문 · 일본문화 → 제2외국어·한문 …). 위에서부터 먼저 맞는 묶음
const SUBJ_GROUPS = [
  ['정보', /정보|소프트웨어|데이터|코딩|프로그래밍|인공지능\s*기초|^인공지능$/],
  ['수학', /수학|미적분|기하|확률|대수|통계/],
  ['과학', /과학|물리|화학|생명|지구|천문|생물/],
  ['국어', /국어|문학|화법|작문|독서|언어와\s*매체|매체/],
  ['영어', /영어/],
  ['제2외국어·한문', /한문|일본|중국|독일|프랑스|스페인|러시아|아랍|베트남|외국어/],
  ['사회', /사회|역사|한국사|지리|경제|정치|법|세계사|동아시아/],
  ['기술·가정', /기술|가정|공학|발명/],
  ['체육', /체육|스포츠|운동/],
  ['예술', /음악|미술|예술|연극|영화|디자인/],
  ['교양', /종교|철학|진로|논리|심리|교육학|보건|환경|교양/],
];
const subjOf = (c) => c.subject || field(c, '교과') || '';
const subjGroup = (s) => (SUBJ_GROUPS.find(([, re]) => re.test(s)) || ['기타'])[0];
function lessonsView(list, k) {
  const counts = list.reduce((m, c) => { const g = subjGroup(subjOf(c)); m[g] = (m[g] || 0) + 1; return m; }, {});
  const groups = [...SUBJ_GROUPS.map(([g]) => g), '기타'].filter((g) => counts[g]);
  const cur = groups.includes(S.subj) ? S.subj : '';
  const filtered = cur ? list.filter((c) => subjGroup(subjOf(c)) === cur) : list;
  const chips = groups.length > 1 ? `<div class="row">${['', ...groups].map((g) => `<button class="chipbtn ${g === cur ? 'on' : ''}" data-act="subj" data-v="${esc(g)}">${esc(g || '전체')} <small>(${g ? counts[g] : list.length})</small></button>`).join('')}</div>` : '';
  const { live, past } = sortCards(filtered);
  return lessonBrief(filtered, cur) + chips + withPast(live, past, (c) => lessonRow(c, k), (h) => `<ul class="lessons">${h}</ul>`);
}
// 한눈 브리핑: 모인 수업 공개를 숫자로 요약 (이번 주 · 몰린 날 · 많은 교과 · 학교 · 도덕과 연결 추천). 화면에서 바로 계산해요
function lessonBrief(list, cur) {
  const t = todayStr(), live = sortCards(list).live.filter((c) => isDate(c.date));
  if (!live.length) return '';
  const top = (fn, n = 3) => Object.entries(groupBy(live, fn)).filter(([key]) => key).sort((a, b) => b[1].length - a[1].length).slice(0, n);
  const today = live.filter((c) => c.date === t).length;
  const week = live.filter((c) => { const n = dday(c.date); return n !== null && n <= 7; }).length;
  const [busyDay, busy] = top((c) => c.date, 1)[0] || [];
  const subj = cur ? [] : top((c) => subjGroup(subjOf(c)));
  const schools = top((c) => field(c, '학교'));
  const picks = live.filter((c) => c.moral_link).slice(0, 3);
  const when = (c) => `${fmtDate(c.date)}${lessonTime(c) ? ` ${lessonTime(c)}` : ''}`;
  return `<section class="brief" aria-label="한눈 브리핑">
    <h3>한눈 브리핑 <small>다가오는 공개수업 ${live.length}건${cur ? ` · ${esc(cur)}` : ''}</small></h3>
    <ul>
      <li>오늘 <b>${today}건</b>, 일주일 안에 <b>${week}건</b>${busy && busy.length > 1 ? ` · 가장 몰린 날은 <b>${esc(fmtDate(busyDay))}</b> (${busy.length}건)` : ''}</li>
      ${subj.length ? `<li>많은 교과: ${subj.map(([g, a]) => `${esc(g)} ${a.length}`).join(' · ')}</li>` : ''}
      ${schools.length ? `<li>많이 여는 학교: ${schools.map(([s, a]) => `${esc(s)} ${a.length}`).join(' · ')}</li>` : ''}
    </ul>
    ${picks.length ? `<p class="brief-sub">도덕 수업에 가져올 만한 수업</p><ol>${picks.map((c) => `<li><b>${esc(when(c))}</b> ${esc(c.title || '')} <small>${esc(field(c, '학교'))}</small><span>${esc(c.moral_link)}</span></li>`).join('')}</ol>` : ''}
  </section>`;
}

// plan: 지도안, 활동 방식별로 묶어 보기
function planCard(c) {
  const meta = ['교과·학년', '단원', '차시'].map((l) => field(c, l)).filter(Boolean).join(' · ');
  const tool = field(c, 'AI·디지털 도구');
  return `<article class="card">
    <div class="row">${reviewTag(c)}${meta ? `<span class="chip">${esc(meta)}</span>` : ''}${tool ? `<span class="chip">도구: ${esc(tool)}</span>` : ''}${c.taskRef ? '<span class="chip warn">과제에 담음</span>' : ''}</div>
    <h3>${esc(c.title || field(c, '수업 주제') || '(제목 없음)')}</h3>
    ${c.summary ? `<p class="sum">${esc(c.summary)}</p>` : ''}
    ${c.periods?.length ? `<div class="plan-flow">${c.periods.map((p) => `<div><i>${esc(p.label)}</i>${esc(p.content)}</div>`).join('')}</div>` : ''}
    ${field(c, '성취기준') ? `<small>성취기준: ${esc(field(c, '성취기준'))}</small>` : ''}
    ${keywords(c)}
    ${actions(c, `<button data-act="ref" data-id="${c.id}">${c.taskRef ? '과제에서 빼기' : '과제에 담기'}</button>`)}
  </article>`;
}
function plansView(list) {
  const groups = Object.entries(groupBy(list, (c) => field(c, '활동 방식') || '기타')).sort((a, b) => b[1].length - a[1].length);
  return groups.map(([name, cards]) => `<section class="plan-group"><h3>${esc(name)} · ${cards.length}</h3><div class="grid2">${cards.map(planCard).join('')}</div></section>`).join('');
}

// 과제 작업실 위쪽 진행판
const taskSteps = () => S.task?.steps || DEFAULT_STEPS.map((label) => ({ label, done: false }));
function taskPanel() {
  const t = S.task || {};
  const steps = taskSteps();
  const done = steps.filter((s) => s.done).length;
  const refs = S.cards.filter((c) => c.taskRef);
  return `<section class="card task">
    <div class="row between">
      <input id="taskTitle" class="title-in" value="${esc(t.title || '')}" placeholder="내 수업 사례 주제 (예: AI와 배려)" aria-label="과제 주제">
      <label class="due">제출일 <input type="date" id="taskDue" value="${esc(t.due || '')}"> ${ddChip(t.due)}</label>
    </div>
    <div class="bar"><i style="width:${Math.round((done / steps.length) * 100)}%"></i></div>
    <small>${steps.length}단계 중 ${done}단계 완료</small>
    <ol class="checks">${steps.map((s, i) => `<li class="${s.done ? 'done' : ''}"><label><input type="checkbox" data-act="step" data-i="${i}" ${s.done ? 'checked' : ''}> ${esc(s.label)}</label></li>`).join('')}</ol>
    <label class="notes-l">메모<textarea id="taskNotes" rows="4" placeholder="수업 아이디어, 실행하고 느낀 점…">${esc(t.notes || '')}</textarea></label>
    <div>
      <h4>참고로 담은 지도안 ${refs.length}</h4>
      ${refs.length ? `<ul class="refs">${refs.map((c) => `<li><a href="#plans">${esc(c.title)}</a><button class="chipbtn" data-act="ref" data-id="${c.id}">빼기</button></li>`).join('')}</ul>` : '<small>2F 지도안 연구실에서 ‘과제에 담기’를 누르면 여기에 모여요.</small>'}
    </div>
  </section>`;
}

// --- 5F 사장실 ---
function upcoming() {
  const t = todayStr();
  const list = S.cards.filter((c) => !isUnsorted(c) && isDate(c.date) && (c.end_date || c.date) >= t);
  if (isDate(S.task?.due) && S.task.due >= t) list.push({ id: 'task', room: 'task', date: S.task.due, title: `과제 제출 · ${S.task.title || '내 수업 사례'}` });
  return list.sort((a, b) => a.date.localeCompare(b.date));
}
// 사장실 탭: 사장실(일정) · 웹앱 현황(moontr.site 모든 웹앱 방문 + 브리핑) · 연수 대장(문서등록대장처럼 한 줄에 연수 하나)
const BOSS_TABS = [['home', '사장실'], ['web', '웹앱 현황'], ['ledger', '연수 대장'], ['reg', '문서대장']];
function bossRoom() {
  const tab = S.bossTab || 'home';
  const tabs = `<div class="row boss-tabs" role="tablist">${BOSS_TABS.map(([k, l]) => `<button class="chipbtn ${k === tab ? 'on' : ''}" role="tab" aria-selected="${k === tab}" data-act="bosstab" data-v="${k}">${l}</button>`).join('')}</div>`;
  return tabs + (tab === 'web' ? webView() : tab === 'ledger' ? ledgerView() : tab === 'reg' ? registryView() : bossView(false));
}

// --- 문서대장: 업무관리시스템 문서등록대장 캡쳐를 AI 가 줄마다 옮긴 표 (ailab_meta/registry) ---
// 관심 키워드가 들어간 공문, 연구소에 이미 넣은 공문(같은 공문번호)을 표시해요
const REG_KEYS = ['AI', '인공지능', '디지털', '에듀테크', '바이브', '연수', '윤리', '인권', '독서', 'IB', '수업', '보안'];
function registryView() {
  const all = Object.values(S.registry?.rows || {});
  if (!all.length) return `<p class="empty">문서대장 캡쳐를 1층 접수처에 넣으면 여기에 한 줄씩 쌓여요. 키워드나 보낸 부서로 검색한 화면을 찍어 넣으면 돼요.</p>`;
  const got = new Set(S.captures.flatMap((c) => [c.name, ...(c.sources || []), ...(c.files || []).map((f) => f.name)]).map(docNo).filter(Boolean));
  const f = S.regf || {};
  const keyOf = (r) => REG_KEYS.filter((k) => new RegExp(k, 'i').test(r.title));
  const rows = all.filter((r) => (!f.key || keyOf(r).includes(f.key)) && (!f.todo || !got.has(r.no)) && (!f.q || `${r.title} ${r.dept} ${r.no}`.includes(f.q)))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.no) - Number(a.no));
  const cnt = (k) => all.filter((r) => keyOf(r).includes(k)).length;
  return `<div class="reg-bar">
      <input id="regQ" placeholder="제목 · 부서 · 번호 찾기" value="${esc(f.q || '')}" autocomplete="off">
      <button class="chipbtn ${f.todo ? 'on' : ''}" data-act="regtodo">안 받은 것만</button>
      ${REG_KEYS.filter(cnt).map((k) => `<button class="chipbtn ${f.key === k ? 'on' : ''}" data-act="regkey" data-v="${esc(k)}">${esc(k)} <small>${cnt(k)}</small></button>`).join('')}
    </div>
    <p class="note">${all.length}건 · 보이는 것 ${rows.length}건 · ✓ = 연구소에 이미 넣은 공문 (파일 이름의 공문번호로 맞춰요)</p>
    <div class="ledger"><table><thead><tr><th>번호</th><th>날짜</th><th>제목</th><th>보낸 곳</th><th>키워드</th><th>넣음</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td class="n">${esc(r.no)}</td><td class="d">${esc(r.date ? fmtDate(r.date) : '')}</td><td>${esc(r.title)}</td><td>${esc(r.dept)}</td><td><div class="docs">${keyOf(r).map((k) => `<span class="kw">${esc(k)}</span>`).join('')}</div></td><td>${got.has(r.no) ? '<span class="lst done">✓</span>' : ''}</td></tr>`).join('')}
    </tbody></table></div>`;
}

// --- 웹앱 현황: 각 웹앱이 /visit.js 로 남기는 site_counts ("이름__total" · "이름__d2026-10-29") 를 읽어요 ---
// 이름 · 묶음 · 관리자 화면은 moontr.site 관리자 허브(/admin/)와 같게
const WEBAPPS = [
  ['ailab', '문쌤의 AI 연구소', '연구소', '/ailab/#admin'], ['desk', '교무실 타이쿤 (/tycoon)', '수업 도구', '/tycoon/?admin'], ['deskapp', '교무실 타이쿤 안드로이드 앱', '수업 도구', ''],
  ['app', '생윤 만점 다이어리', '기출 학습', '/app/?admin'], ['idea', '윤사 만점 다이어리', '기출 학습', '/idea/?admin'], ['home', '대문', '대문', '/home-admin/'],
  ['sonagi', '소나기 연수 실습', '행사 · 연수', '/sonagi/'], ['c22', '통사 학습지 (통합사회2 윤리)', '수업 도구', '/c22/'], ['110', '1학년 10반 관리', '우리반', '/110/?page=admin'],
  ['vibe', '바이브코딩 매뉴얼', '수업 도구', '/vibe/?admin'], ['note10', '우리반 생기부노트', '우리반', '/note10/#admin'], ['jinseon-gt', '50주년 해외연수', '행사 · 연수', 'https://jinseon50th.com/gt/#admin'],
  ['drs-booth', '또래상담부 부스 상황판', '행사 · 연수', '/drs/booth/#admin'], ['check04', '출석체크', '수업 도구', '/check04/#teacher'], ['0911', '9월 컨설팅장학 수업 사례', '수업 도구', '/0911/#admin'],
  ['drs', '또래상담부 DRS', '행사 · 연수', '/drs/?page=admin'], ['simin', '자성동이 AI 공부방', '공부방', 'https://jsun.site/simin/#admin'], ['study', '새싹 AI 공부방', '공부방', 'https://jsun.site/study/#admin'],
  ['stuvibe', '바이브코딩 진로탐구(이론편)', '바이브코딩 수업', '/vibeadmin/'], ['vibelab', '바이브코딩 진로탐구(실습편)', '바이브코딩 수업', '/vibeadmin/'],
];
async function loadSites() {
  S.sitesLoading = true;
  const out = {};
  try {
    (await getDocs(collection(db, 'site_counts'))).docs.forEach((d) => {
      const m = d.id.match(/^(.+)__(total|d(\d{4}-\d{2}-\d{2}))$/);
      if (!m) return;
      const o = (out[m[1]] ||= { total: 0, days: {} });
      if (m[2] === 'total') o.total = d.data().n || 0; else o.days[m[3]] = d.data().n || 0;
    });
    S.sites = { at: Date.now(), data: out };
  } catch (e) { S.sites = { at: Date.now(), data: null, error: e.code || e.message }; }
  S.sitesLoading = false;
  render();
}
const dayAdd = (d, n) => { const x = new Date(`${d}T00:00:00`); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const sumDays = (o, from, to) => { let n = 0; for (let d = from; d <= to; d = dayAdd(d, 1)) n += o.days[d] || 0; return n; };
// 잔디: 최근 20주 (20주 전 일요일부터, 칸 하나 = 하루, 진하기는 그 웹앱에서 가장 많은 날 기준) — moontr.site 현황판과 같아요
function hubGrass(days) {
  const today = todayStr(), dow = new Date(`${today}T00:00:00`).getDay(), start = dayAdd(today, -(dow + 19 * 7));
  const vals = [];
  for (let d = start; d <= today; d = dayAdd(d, 1)) vals.push([d, days[d] || 0]);
  const max = Math.max(1, ...vals.map((v) => v[1])), lv = (n) => (!n ? '' : n <= max * .25 ? 'l1' : n <= max * .5 ? 'l2' : n <= max * .75 ? 'l3' : 'l4');
  return `<div class="hub-grass" aria-hidden="true">${vals.map(([d, n]) => `<i class="${lv(n)}" title="${d.slice(5).replace('-', '/')} · ${n}"></i>`).join('')}${'<i class="fut"></i>'.repeat(6 - dow)}</div>`;
}
function webView() {
  if (!S.sites || Date.now() - S.sites.at > 10 * 60e3) { if (!S.sitesLoading) loadSites(); if (!S.sites) return '<p class="empty">웹앱 방문 기록을 불러오는 중이에요…</p>'; }
  if (!S.sites.data) return `<p class="empty">방문 기록을 읽지 못했어요 (${esc(S.sites.error)}). <button class="chipbtn" data-act="sites">다시 불러오기</button></p>`;
  const today = todayStr(), wk = dayAdd(today, -6), pwk0 = dayAdd(today, -13), pwk1 = dayAdd(today, -7), two = dayAdd(today, -13);
  const apps = WEBAPPS.map(([k, name, grp, admin]) => { const o = S.sites.data[k] || { total: 0, days: {} }; return { k, name, grp, admin, ...o, today: o.days[today] || 0, week: sumDays(o, wk, today), prev: sumDays(o, pwk0, pwk1), recent: sumDays(o, two, today), first: Object.keys(o.days).sort()[0] || '' }; })
    .sort((x, y) => y.today - x.today || y.total - x.total);
  const used = apps.filter((a) => a.today), sumToday = apps.reduce((n, a) => n + a.today, 0), sumTotal = apps.reduce((n, a) => n + a.total, 0);
  const card = (a) => `<${a.admin ? `a href="${esc(a.admin)}" target="_blank" rel="noopener"` : 'div'} class="hub-card ${a.k === 'ailab' ? 'me' : ''}"><span class="hd"><b><span class="dot ${a.today ? 'on' : ''}"></span>${esc(a.name)}</b><small>${esc(a.grp)}</small></span><span class="nums"><b>${a.today}</b><small>오늘 방문</small><b>${a.total.toLocaleString()}</b><small>누적</small></span>${hubGrass(a.days)}</${a.admin ? 'a' : 'div'}>`;
  // 브리핑: 숫자만 보고 규칙대로 (AI 안 써요)
  const nm = (a) => `<b>${esc(a.name)}</b>`;
  const rise = apps.filter((a) => a.prev >= 3 && a.week >= a.prev * 1.5).sort((x, y) => y.week / y.prev - x.week / x.prev);
  const fall = apps.filter((a) => a.prev >= 5 && a.week <= a.prev * .5).sort((x, y) => x.week / x.prev - y.week / y.prev);
  const quiet = apps.filter((a) => a.total > 0 && !a.recent);
  const fresh = apps.filter((a) => a.first && a.first >= wk && a.total <= a.week); // 누적이 모두 이번 주 것 = 정말 새로 쓰기 시작한 웹앱
  const week = [...apps].sort((x, y) => y.week - x.week).filter((a) => a.week).slice(0, 3);
  const brief = [
    `오늘 ${apps.length}개 가운데 <b>${used.length}개</b>가 쓰였고, 모두 합쳐 <b>${sumToday}회</b> 방문했어요.`,
    used.length && `오늘 가장 많이 쓰인 곳: ${used.slice(0, 3).map((a) => `${nm(a)} ${a.today}회`).join(' · ')}`,
    week.length && `최근 7일: ${week.map((a) => `${nm(a)} ${a.week}회`).join(' · ')}`,
    rise.length && `지난주보다 많이 늘었어요: ${rise.slice(0, 3).map((a) => `${nm(a)} ${a.prev} → ${a.week}회`).join(' · ')}`,
    fall.length && `지난주보다 줄었어요: ${fall.slice(0, 3).map((a) => `${nm(a)} ${a.prev} → ${a.week}회`).join(' · ')}`,
    fresh.length && `이번 주에 처음 방문이 생겼어요: ${fresh.map(nm).join(' · ')}`,
    quiet.length && `2주 동안 방문이 없어요: ${quiet.map(nm).join(' · ')} <small>(행사가 끝났거나 학기가 바뀐 웹앱이면 정리해도 돼요)</small>`,
  ].filter(Boolean);
  return `<div class="hub">
    <div class="hub-sum"><div><small>오늘 전체</small><b>${sumToday}회</b></div><div><small>누적 전체</small><b>${sumTotal.toLocaleString()}회</b></div><div><small>오늘 쓰인 웹앱</small><b>${used.length} / ${apps.length}개</b></div></div>
    <div class="hub-cards">${apps.map(card).join('')}</div>
    <section class="hub-brief"><h3>이용 브리핑 <small>${esc(fmtDate(today))} · 방문 기록으로 정리</small></h3><ul>${brief.map((s) => `<li>${s}</li>`).join('')}</ul>
      <p class="note">관리자 화면에서 연 것은 세지 않아요. 카드를 누르면 그 웹앱 관리자 화면이 새 탭으로 열려요. <button class="chipbtn" data-act="sites">새로고침</button></p></section>
  </div>`;
}

// --- 연수 대장: 연수 기록실 카드를 연수 이름으로 묶어 한 줄씩 (안내 · 대상자 · 이수증이 그 줄에 붙어요) ---
function ledgerView() {
  const key = (t) => String(t || '').replace(/20\d\d년?|[「」『』()[\]〔〕'"]/g, '').replace(/(신청|안내|대상자|선발|계획|및|직무연수|연수|중등|과정|신규|\s|·|-|–)/g, '').slice(0, 12);
  const groups = new Map();
  for (const c of cardsIn('train')) { const k = key(c.title); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); }
  const today = todayStr();
  const rows = [...groups.values()].map((g) => {
    const kinds = g.map((c) => c.kind || '자료'), title = g.map((c) => c.title || '').sort((a, b) => a.length - b.length)[0];
    const d = g.map((c) => c.date).filter(isDate).sort()[0] || '', e = g.map((c) => c.end_date || c.date).filter(isDate).sort().pop() || '';
    const hours = g.flatMap((c) => c.fields || []).find((f) => /이수 시간|차시/.test(f.label) && f.value)?.value || '';
    const mine = g.flatMap((c) => c.fields || []).find((f) => f.label === '대상자 여부' && f.value)?.value || '';
    const st = kinds.includes('이수증') ? ['done', '이수'] : kinds.some((k) => /대상자/.test(k)) ? (/아님/.test(mine) ? ['no', '대상 아님'] : e >= today ? ['go', '대상 · 진행 중'] : ['go', '대상 · 끝남']) : kinds.some((k) => /신청/.test(k)) ? ['apply', '신청함'] : ['no', '안내만'];
    const todo = st[1] === '대상 · 끝남' ? '이수증 넣기' : st[1] === '대상 · 진행 중' ? `${fmtDate(e)} 끝` : st[0] === 'apply' ? '결과 적기' : st[1] === '안내만' && d >= today ? '신청할지 정하기' : '';
    return { g, title, d, e, hours, st, kinds, todo };
  }).sort((a, b) => (a.d || '9').localeCompare(b.d || '9'));
  if (!rows.length) return '<p class="empty">연수 기록실에 카드가 들어오면 여기에 한 줄씩 모여요.</p>';
  const md = (x) => (x ? `${+x.slice(5, 7)}.${+x.slice(8, 10)}` : '');
  return `<p class="note">에듀파인 문서등록대장처럼 한 줄에 연수 하나예요. 같은 연수의 안내 · 대상자 · 이수증 카드는 한 줄로 묶여요. 자료 이름을 누르면 그 카드가 열려요.</p>
    <div class="ledger"><table><thead><tr><th>번호</th><th>연수명</th><th>기간</th><th>시간</th><th>상태</th><th>붙은 자료</th><th>남은 일</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td class="n">${todayStr().slice(0, 4)}-${String(i + 1).padStart(3, '0')}</td><td>${esc(r.title)}</td><td class="d">${md(r.d)}${r.e && r.e !== r.d ? ` ~ ${md(r.e)}` : ''}</td><td class="d">${esc(r.hours.slice(0, 14))}</td><td><span class="lst ${r.st[0]}">${r.st[1]}</span></td><td><div class="docs">${r.g.map((c) => `<button type="button" data-act="edit" data-id="${c.id}">${esc(c.kind || '자료')}</button>`).join('')}</div></td><td>${esc(r.todo)}</td></tr>`).join('')}
    </tbody></table></div>`;
}

// --- 사장님 계기판: 콘솔 크레딧 · 연구소 AI 가 쓴 값 · 급한 일 · 할 일 · 메모 (ailab_meta/desk, usage) ---
// 남은 크레딧은 Anthropic 이 API 로 알려 주지 않아요 → 콘솔에서 본 남은 값과 날짜를 적어 두면, 그 뒤에 연구소가 쓴 값을 빼서 보여 줘요
const usd = (n) => `$${(n || 0).toFixed(n >= 10 ? 1 : 2)}`;
const saveDesk = (patch) => setDoc(doc(db, dbPath('meta/desk')), { ...patch, updatedAt: serverTimestamp() }, { merge: true }).catch((e) => toast(`저장하지 못했어요 (${e.code})`));
function deskCard() {
  const d = S.desk || {}, u = S.usage || {}, days = u.days || {}, today = todayStr();
  const since = (from) => Object.entries(days).filter(([k]) => k >= from).reduce((n, [, v]) => n + v, 0);
  const month = since(today.slice(0, 8) + '01'), week = since(dayAdd(today, -6));
  const left = d.creditLeft != null && d.creditAsOf ? d.creditLeft - since(d.creditAsOf) : null;
  const dExp = isDate(d.creditExpires) ? Math.round((new Date(`${d.creditExpires}T00:00:00`) - new Date(`${today}T00:00:00`)) / 864e5) : null;
  const urgent = [
    ...upcoming().filter((c) => c.date && c.date >= today && c.date <= dayAdd(today, 3)).map((c) => `${ddChip(c.date, c.end_date)} ${esc(c.title)}`),
    ...(S.cards.some((c) => c.status === 'review') ? [`확인 기다리는 카드 ${S.cards.filter((c) => c.status === 'review').length}장 <a href="#lobby">접수처로</a>`] : []),
    ...(S.captures.some((c) => c.status === 'error') ? [`읽지 못한 자료 ${S.captures.filter((c) => c.status === 'error').length}개 <a href="#lobby">다시 읽기</a>`] : []),
    ...(dExp != null && dExp >= 0 && dExp <= 7 ? [`콘솔 크레딧이 ${dExp ? `${dExp}일 뒤` : '오늘'} 끝나요`] : []),
  ];
  const todos = d.todos || [];
  return `<section class="desk">
    <div class="desk-h"><h3>사장님 계기판</h3><small>사장님 = 개발자 · 한눈에</small></div>
    <div class="desk-grid">
      <div class="dk money"><h4>콘솔 · AI 비용</h4>
        <p class="big">${left != null ? `약 <b>${usd(left)}</b> 남음` : '<b>남은 값</b>을 적어 주세요'}${dExp != null ? ` <span class="${dExp <= 7 ? 'warn' : ''}">· 만료 D-${Math.max(0, dExp)}</span>` : ''}</p>
        ${d.creditPaid != null ? `<p>그 밖에 구매 크레딧 <b>${usd(d.creditPaid)}</b> <small>(만료 없음 · 프로모션을 다 쓰거나 만료되면 이걸 써요. 자동 충전이 꺼져 있으면 이것까지 다 쓰면 AI가 멈춰요)</small></p>` : ''}
        <p>연구소 AI가 쓴 값 · 오늘 ${usd(days[today])} · 7일 ${usd(week)} · 이번 달 ${usd(month)} · 전체 ${usd(u.total)} <small>(${u.calls || 0}번 불렀어요 · 토큰으로 어림)</small></p>
        <details><summary>콘솔에서 본 값 적기</summary>
          <div class="dk-form"><label>남은 크레딧 ($)<input id="deskLeft" type="number" step="0.01" inputmode="decimal" value="${d.creditLeft ?? ''}"></label>
          <label>본 날짜<input id="deskAsOf" type="date" value="${esc(d.creditAsOf || today)}"></label>
          <label>만료일<input id="deskExp" type="date" value="${esc(d.creditExpires || '')}"></label></div>
          <small>콘솔 Billing 화면의 남은 금액을 적어요. 교무실 타이쿤 · 아이아이노트도 같은 키를 쓰면 그쪽 사용은 여기 안 잡혀서, 가끔 콘솔 값으로 다시 맞춰 주세요. <a href="https://platform.claude.com/settings/billing" target="_blank" rel="noopener">콘솔 열기</a></small>
        </details>
      </div>
      <div class="dk"><h4>급하게 할 일 <small>3일 안</small></h4>${urgent.length ? `<ul>${urgent.map((x) => `<li>${x}</li>`).join('')}</ul>` : '<p class="note">급한 일이 없어요.</p>'}</div>
      <div class="dk"><h4>아직 안 한 일 <small>${todos.filter((t) => !t.done).length}개</small></h4>
        <ul class="todo">${todos.map((t, i) => `<li class="${t.done ? 'done' : ''}"><label><input type="checkbox" data-act="todo" data-i="${i}" ${t.done ? 'checked' : ''}> ${esc(t.t)}</label><button class="x" data-act="todoDel" data-i="${i}" aria-label="지우기">✕</button></li>`).join('')}</ul>
        <input id="todoNew" placeholder="할 일 적고 Enter" autocomplete="off"></div>
      <div class="dk"><h4>메모</h4><textarea id="deskMemo" rows="5" placeholder="아이디어 · 다음에 고칠 것 · 기억할 것">${esc(d.memo || '')}</textarea></div>
    </div></section>`;
}
// 점검원 브리핑 (AI · 매일 아침 6:30, [지금 브리핑 받기]로 바로)
function briefCard() {
  const b = S.brief, busy = S.briefing;
  const when = b ? `${fmtDate(b.date)} · ${esc(b.by || '')}` : '';
  const btn = `<button class="chipbtn" data-act="briefnow" ${busy ? 'disabled' : ''}>${busy ? 'AI가 쓰는 중… (30초쯤)' : '지금 브리핑 받기'}</button>`;
  if (!b) return `<section class="brief"><div class="brief-h"><h3>점검원 브리핑</h3>${btn}</div><p class="note">매일 아침 6시 30분에 AI 점검원이 카드 · 읽지 못한 자료 · 웹앱 방문을 살펴보고 여기에 써 둬요.</p></section>`;
  const list = (t, xs, f) => (xs?.length ? `<div><h4>${t}</h4><ul>${xs.map(f).join('')}</ul></div>` : '');
  return `<section class="brief"><div class="brief-h"><h3>점검원 브리핑 <small>${when}</small></h3>${btn}</div>
    <p class="brief-head">${esc(b.headline || '')}</p>
    <div class="brief-grid">
      ${list('오늘', b.today, (s) => `<li>${esc(s)}</li>`)}
      ${list('앞으로 2주', b.soon, (s) => `<li><b>${esc(fmtDate(s.date) || s.date)}</b> ${esc(s.title)}${s.note ? `<small>${esc(s.note)}</small>` : ''}</li>`)}
      ${list('점검원이 찾은 것', b.checks, (s) => `<li>${ROOMS[s.room] ? `<a href="#${esc(s.room)}">${esc(s.title)}</a>` : esc(s.title)}<small>${esc(s.why)}</small></li>`)}
      ${list('웹앱 이용', b.webapps, (s) => `<li>${esc(s)}</li>`)}
    </div></section>`;
}
function bossView(compact) {
  const up = upcoming().slice(0, compact ? 6 : 30);
  const month = todayStr().slice(0, 7);
  const lessons = S.cards.filter((c) => (c.room === 'moral' || c.room === 'others') && (c.date || '').startsWith(month)).length;
  const review = S.cards.filter((c) => c.status === 'review').length;
  const recent = S.cards.filter((c) => !isUnsorted(c)).slice(0, 6);
  return `${compact ? '' : deskCard() + briefCard()}<div class="stats">
      <a href="#lobby"><b>${review}</b><small>확인 대기</small></a>
      <a href="#moral"><b>${lessons}</b><small>이번 달 수업 공개</small></a>
      <a href="#archive"><b>${S.cards.length}</b><small>정리된 카드</small></a>
    </div>
    ${up.length ? `<ul class="agenda">${up.map((c) => `<li><a href="#${c.room}" ${c.id !== 'task' ? `data-act="edit" data-id="${c.id}"` : ''}>${ddChip(c.date, c.end_date)}<div><b>${esc(c.title)}</b><small>${esc([fmtDate(c.date), c.id === 'task' ? '' : lessonTime(c), roomName(c.room), c.place].filter(Boolean).join(' · '))}</small></div></a></li>`).join('')}</ul>`
      : '<p class="empty">날짜가 있는 자료가 들어오면 여기에 D-day 순으로 모여요.</p>'}
    ${!compact && recent.length ? `<h3>방금 정리된 자료</h3><ul class="agenda">${recent.map((c) => `<li><a href="#${c.room}" data-act="edit" data-id="${c.id}"><span class="chip">${esc(roomName(c.room))}</span><div><b>${esc(c.title)}</b><small>${esc(c.summary || '')}</small></div></a></li>`).join('')}</ul>` : ''}`;
}

// --- 접수처 진행 막대: 올리기는 실제로 올라간 바이트, AI 읽기는 보통 걸리는 시간(사진 75초 · 묶음 150초)으로 어림해서 95%까지 ---
const readPct = (start, exp) => Math.min(95, Math.max(3, Math.round(((Date.now() - start) / 1000 / exp) * 100)));
const pctOf = (u) => (u.total ? Math.min(100, Math.round((u.sent / u.total) * 100)) : 0);
function progressList(reading, moving) {
  if (!moving) return '<div class="prog-idle">지금 올라가거나 읽는 자료는 없어요</div>';
  const ups = [...S.uploading.entries()].map(([id, u]) => ({ id, name: u.name, up: true, pct: pctOf(u) }));
  const rd = reading.filter((c) => !S.uploading.has(c.id)).map((c) => {
    const start = S.readStart[c.id] || c.createdAt?.toMillis?.() || Date.now(), exp = c.bundle ? 150 : 75;
    return { id: c.id, name: c.name || '자료', start, exp, pct: readPct(start, exp) };
  });
  return `<ul class="prog" aria-live="polite">${[...ups, ...rd].map((p) => `<li class="${p.up ? 'up' : 'read'}" data-prog="${p.id}" ${p.up ? '' : `data-start="${p.start}" data-exp="${p.exp}"`}>
      <span class="pn">${esc(p.name)}</span><span class="ph">${p.up ? '올리는 중' : 'AI가 읽는 중'}</span><b class="pc">${p.pct}%</b>
      <span class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.pct}"><i style="width:${p.pct}%"></i></span></li>`).join('')}</ul>
    ${rd.length ? '<p class="q-note">읽기 %는 보통 걸리는 시간으로 어림한 값이에요 (사진 1분 남짓 · 공문 묶음 2~3분). 다 읽으면 카드가 바로 생겨요.</p>' : ''}`;
}
// 화면을 다시 그리지 않고 막대만 바꿔요
function setBar(id, pct) {
  const li = document.querySelector(`[data-prog="${id}"]`);
  if (!li) return;
  li.querySelector('.bar i').style.width = `${pct}%`;
  li.querySelector('.bar').setAttribute('aria-valuenow', pct);
  li.querySelector('.pc').textContent = `${pct}%`;
}
setInterval(() => document.querySelectorAll('[data-prog][data-start]').forEach((li) => setBar(li.dataset.prog, readPct(+li.dataset.start, +li.dataset.exp))), 1000);
// 파일 하나 올리기 (올라간 바이트를 알려 줘요)
const putFile = (path, blob, contentType, onBytes) => new Promise((res, rej) => {
  const t = uploadBytesResumable(ref(storage, path), blob, { contentType });
  t.on('state_changed', (s) => onBytes(s.bytesTransferred), rej, res);
});

// --- D. 1층 작업 라인 ---
function station(no, label, n, hot = false, bot = 'bot') {
  return `<div class="st ${hot && n ? 'hot' : ''}"><span class="step">${no}</span><span class="${bot}"></span><span class="lbl">${label}</span><span class="n">${n}장</span></div>`;
}
function lobbyView() {
  const reading = S.captures.filter((c) => c.status === 'reading');
  const errors = S.captures.filter((c) => c.status === 'error');
  const review = S.cards.filter((c) => c.status === 'review');
  const moving = S.uploading.size + reading.length;
  return `<div class="mD">
    <div class="intake">
      <label class="drop" for="fileInput"><span class="doc"></span><b>캡쳐나 공문 PDF를 여기에 넣기</b><small>눌러서 고르기 · 화면 어디든 끌어다 놓기 · Ctrl+V 붙여넣기<br>공문 본문(.odt) · PDF · 엑셀 · 사진 · 한글(.hwp · .hwpx)을 한꺼번에 넣으면 공문번호별로 묶어 읽어요 · 폴더째 끌어다 놓아도 돼요</small></label>
      <div class="extra">
        <label>링크 주소 <small>홈페이지 캡쳐라면 주소를 같이 적어 주세요</small><input id="pendLink" type="url" inputmode="url" placeholder="https://" value="${esc(S.pending.link)}"></label>
        <label>메모 <small>예: 3차 연수 과제 안내 / 내 이름 ○○○</small><input id="pendMemo" value="${esc(S.pending.memo)}"></label>
        <small>적어 둔 내용은 다음에 넣는 사진에 붙어서 AI가 함께 읽어요.</small>
      </div>
    </div>
    <div class="st-row">
      ${station(1, '접수', S.uploading.size)}
      ${station(2, 'AI 읽기·정리', reading.length)}
      ${station(3, '선생님 확인', review.length, true, 'bot boss')}
      ${station(4, '방에 보관', S.cards.length - review.length)}
    </div>
    ${progressList(reading, moving)}
    ${errors.length ? `<div class="errs">${errors.map((c) => `<div class="err">${thumb(c.storagePath, 'qthumb')}<div><b>읽지 못한 자료 · ${esc(c.name || '')}</b><small>${esc(c.error || '')}</small></div><button data-act="reread" data-cap="${c.id}">다시 읽기</button><button data-act="delcap" data-cap="${c.id}">지우기</button></div>`).join('')}</div>` : ''}
    <div class="q-h"><span class="pip"></span>확인을 기다리는 카드 ${review.length}장 · 노란 칸만 보면 돼요
      ${(() => { const n = review.filter((c) => !isUnsorted(c)).length; return n ? `<button class="btn primary allok" data-act="confirmAll">✓ ${n}장 한 번에 방으로 보내기</button>` : ''; })()}</div>
    ${review.some(isUnsorted) ? '<p class="q-note">방이 안 정해진 카드는 한 번에 보내기에서 빠져요. [고치기]에서 방을 골라 주세요.</p>' : ''}
    ${review.length ? `<div class="qcards">${review.map(reviewCard).join('')}</div>` : '<p class="empty">지금은 확인할 카드가 없어요.</p>'}
  </div>`;
}
function roomOptions(current) {
  const ai = Object.entries(ROOMS).filter(([, r]) => r.ai);
  return `${!ROOMS[current]?.ai ? '<option value="unknown" selected>방을 골라 주세요</option>' : ''}${ai.map(([k, r]) => `<option value="${k}" ${k === current ? 'selected' : ''}>${esc(floorOf(k).floor)} ${esc(r.name)}</option>`).join('')}`;
}
// 제목이 같은 카드 찾기 (띄어쓰기 · 괄호 · 문장부호는 무시). 같은 공문을 두 번 넣었거나 같은 연수가 또 들어온 걸 알려 줘요
const titleKey = (t) => (t || '').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
let titleIdx = { cards: null, map: new Map() };
function sameTitle(c) {
  if (titleIdx.cards !== S.cards) {
    const map = new Map();
    S.cards.forEach((x) => { const k = titleKey(x.title); if (k.length >= 4) map.set(k, [...(map.get(k) || []), x]); });
    titleIdx = { cards: S.cards, map };
  }
  // 날짜가 다르면 다른 수업 · 연수로 봐요 (같은 제목 수업을 여러 학교가 여는 경우)
  return (titleIdx.map.get(titleKey(c.title)) || []).filter((x) => x.id !== c.id && (!c.date || !x.date || x.date === c.date));
}
// 확인 표시: 누르면 같은 제목의 다른 카드가 열려요
function dupTag(c) {
  const others = sameTitle(c);
  if (!others.length) return '';
  const o = others[0];
  return `<button type="button" class="chip dup" data-act="edit" data-id="${o.id}" title="${esc(`${roomName(o.room)} · ${fmtDate(o.date) || '날짜 없음'}`)}">⚠ 같은 제목 ${others.length + 1}장 · 확인</button>`;
}
function reviewCard(c) {
  const when = whenText(c);
  const rows = [
    ['제목', c.title, uns(c, 'title')],
    when && ['일시', when, uns(c, 'date') || uns(c, 'time')],
    c.place && ['장소', c.place, uns(c, 'place')],
    c.subject && ['교과', c.subject, uns(c, 'subject')],
    c.url && ['링크', c.url, uns(c, 'url')],
    ...extraFields(c).map((f) => [f.label, f.value, f.unsure ? 'unsure' : '']),
  ].filter(Boolean);
  return `<div class="qc">
    <div class="qc-top">${thumb(c.storagePath, 'qthumb', `data-act="edit" data-id="${c.id}"`)}
      <div><b>${esc(c.kind || '자료')}</b><select data-act="move" data-id="${c.id}" aria-label="보낼 방">${roomOptions(c.room)}</select></div></div>
    ${dupTag(c)}
    <dl class="fields">${rows.map(([l, v, u]) => `<dt>${esc(l)}</dt><dd><span class="${u}">${esc(v)}</span></dd>`).join('')}</dl>
    ${c.periods?.length ? `<small>교시·흐름 ${c.periods.length}개 · 고치기에서 볼 수 있어요</small>` : ''}
    <div class="btns">
      <button class="yes" data-act="confirm" data-id="${c.id}" ${isUnsorted(c) ? 'disabled title="먼저 방을 골라 주세요"' : ''}>맞아요</button>
      <button data-act="edit" data-id="${c.id}">고치기</button>
      <button data-act="del" data-id="${c.id}">버리기</button>
    </div>
  </div>`;
}

// --- B1 원본 보관실 ---
function archiveView() {
  if (!S.captures.length) return '<p class="empty">넣은 캡쳐와 공문 PDF 원본이 여기에 날짜순으로 쌓여요.</p>';
  const label = { uploading: '올리는 중', reading: '읽는 중', done: '정리됨', error: '읽지 못함' };
  return `<div class="arch">${S.captures.map((c) => `<button class="ph" data-act="cap" data-cap="${c.id}">
    ${c.files?.length > 1 ? `<span class="pdfthumb">PDF 묶음<br>${c.files.length}개</span>` : thumb(c.storagePath, '', 'loading="lazy"')}
    <span>${esc(tsDate(c.createdAt))} · <span class="${c.status === 'error' ? 'st-err' : ''}">${label[c.status] || ''}</span>${c.cardCount ? ` · 카드 ${c.cardCount}` : ''}</span>
  </button>`).join('')}</div>`;
}

// --- 찾기 ---
function searchView() {
  const q = S.q.toLowerCase();
  const hay = (c) => [c.title, c.summary, c.place, c.subject, c.kind, c.moral_link, ...(c.keywords || []), ...(c.fields || []).map((f) => f.value), ...(c.periods || []).map((p) => p.content)].join(' ').toLowerCase();
  const hits = S.cards.filter((c) => hay(c).includes(q));
  return `<div class="flr-h" style="margin-bottom:12px"><h2>‘${esc(S.q)}’ 찾기</h2><small>${hits.length}건</small></div>
    ${hits.length ? `<div class="results">${hits.map((c) => `<div class="res">
      <span class="where">${esc(floorOf(c.room).floor)} ${esc(roomName(c.room))}</span>
      <div><b>${esc(c.title)}</b><small>${esc([whenText(c), c.place, c.summary].filter(Boolean).join(' · '))}</small></div>
      <div class="acts"><a class="btn" href="#${esc(c.room)}" data-act="clearq">방으로 가기</a><button data-act="edit" data-id="${c.id}">보기</button></div>
    </div>`).join('')}</div>` : '<p class="empty">찾는 자료가 없어요.</p>'}`;
}

// ---------- 원본 사진 ----------
// 사진은 <img>, PDF 는 작은 'PDF' 표시 (img 로는 PDF 를 그릴 수 없어서)
const isPdfPath = (p) => /\.pdf$/i.test(p || '');
function thumb(path, cls = '', attrs = '') {
  return isPdfPath(path)
    ? `<span class="pdfthumb ${cls}" ${attrs} title="PDF">PDF</span>`
    : `<img class="${cls}" ${attrs} data-path="${esc(path)}" alt="">`;
}
// 창에 보여 줄 원본 전부 (공문 묶음이면 본문 · 첨부 PDF 여러 개)
function capFiles(capId, fallbackPath) {
  const cap = S.captures.find((c) => c.id === capId);
  const files = cap?.files?.length ? cap.files : [{ path: cap?.storagePath || fallbackPath, name: cap?.name || '' }];
  return files.filter((f) => f.path);
}
const hasImage = (files) => files.some((f) => !isPdfPath(f.path));
// 사진은 크게 보여 주고, PDF 는 창 안에서 펼치지 않고 작은 파일 칸으로 (누르면 새 창에서 열려요)
function viewer(files) {
  const pdfs = files.filter((f) => isPdfPath(f.path));
  return (pdfs.length ? `<div class="filetiles">${pdfs.map((f) => `<a class="filetile" data-path="${esc(f.path)}" target="_blank" rel="noopener" title="${esc(f.name || 'PDF')} · 새 창에서 열기"><span class="pdfthumb">PDF</span><span class="fn">${esc(f.name || 'PDF')}</span></a>`).join('')}</div>` : '')
    + files.filter((f) => !isPdfPath(f.path)).map((f) => `<img data-path="${esc(f.path)}" alt="원본">`).join('');
}
// 창 오른쪽 위 닫기 단추 (form method="dialog" 라 누르면 저장하지 않고 닫혀요)
const DLG_X = '<button class="dlg-x" value="cancel" formnovalidate aria-label="닫기" title="닫기 (Esc)">✕</button>';

const urlCache = new Map();
function hydrateImages(root = document) {
  root.querySelectorAll('img[data-path]:not([src]), iframe[data-path]:not([src]), a[data-path]:not([href])').forEach(async (el) => {
    const p = el.dataset.path;
    if (!p) return;
    try {
      if (!urlCache.has(p)) urlCache.set(p, getDownloadURL(ref(storage, p)));
      const url = await urlCache.get(p);
      if (el.tagName === 'A') el.href = url; else el.src = url;
    } catch {
      urlCache.delete(p);
      if (el.tagName === 'IMG') el.alt = '원본 없음';
      if (el.tagName === 'A') { el.classList.add('gone'); el.title = '저장소에 이 파일이 없어요'; }
    }
  });
}

// ---------- 창: 카드 고치기 / 원본 보기 ----------
const dlg = $('#dlg');

function openCard(id) {
  const c = cardById(id);
  if (!c) return;
  const files = capFiles(c.captureId, c.storagePath), side = hasImage(files);
  dlg.innerHTML = `<form method="dialog" class="dlg ${side ? '' : 'one'}" id="cardForm" data-id="${c.id}">
    ${DLG_X}
    ${side ? `<div class="dlg-img">${viewer(files)}</div>` : ''}
    <div class="dlg-form">
      <h2>${c.status === 'review' ? '카드 확인하기' : '카드 고치기'}</h2>
      ${side ? '' : viewer(files)}
      <label>보낼 방<select name="room">${roomOptions(c.room)}</select></label>
      ${c.room === 'links' ? `<label>분류<input name="category" value="${esc(c.category || '')}"></label>` : ''}
      <label>제목<input name="title" value="${esc(c.title)}"></label>
      <div class="two"><label>날짜<input type="date" name="date" value="${esc(c.date)}"></label><label>끝나는 날<input type="date" name="end_date" value="${esc(c.end_date)}"></label></div>
      <div class="two"><label>시간·교시<input name="time" value="${esc(c.time)}"></label><label>장소<input name="place" value="${esc(c.place)}"></label></div>
      <div class="two"><label>교과<input name="subject" value="${esc(c.subject)}"></label><label>링크<input name="url" value="${esc(c.url)}"></label></div>
      <label>한 줄 요약<textarea name="summary" rows="2">${esc(c.summary)}</textarea></label>
      ${c.fields?.length ? `<fieldset><legend>세부 항목</legend>${c.fields.map((f, i) => `<label>${esc(f.label)}${f.unsure ? ' <span class="unsure">확인 필요</span>' : ''}<input name="f_${i}" value="${esc(f.value)}"></label>`).join('')}</fieldset>` : ''}
      <label>교시·수업 흐름 <small>한 줄에 하나씩 “1교시 | 내용”</small><textarea name="periods" rows="4">${esc((c.periods || []).map((p) => `${p.label} | ${p.content}`).join('\n'))}</textarea></label>
      <div class="dlg-acts">
        <button type="button" data-act="del" data-id="${c.id}">버리기</button>
        ${ROOMS[c.room] && route() !== c.room ? `<button type="button" data-act="gocard" data-id="${c.id}">${esc(roomName(c.room))}로 가기</button>` : ''}
        <button value="cancel" formnovalidate>닫기</button>
        <button class="yes" value="save">저장하고 보관</button>
      </div>
    </div>
  </form>`;
  hydrateImages(dlg);
  dlg.showModal();
}

async function saveCard(form) {
  const c = cardById(form.dataset.id);
  if (!c) return;
  const v = (n) => form.elements[n]?.value.trim() ?? '';
  const room = v('room');
  const data = {
    room, title: v('title'), date: v('date'), end_date: v('end_date'), time: v('time'), place: v('place'),
    subject: v('subject'), url: v('url'), summary: v('summary'),
    fields: (c.fields || []).map((f, i) => ({ label: f.label, value: v(`f_${i}`), unsure: false })),
    periods: v('periods').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [label, ...rest] = line.split('|');
      return rest.length ? { label: label.trim(), content: rest.join('|').trim() } : { label: '', content: label.trim() };
    }),
    unsure: [],
  };
  if (form.elements.category) data.category = v('category');
  if (ROOMS[room]?.ai) Object.assign(data, { status: 'done', confirmedAt: serverTimestamp() });
  await updateDoc(doc(db, dbPath(`cards/${c.id}`)), data);
  toast(ROOMS[room]?.ai ? `${roomName(room)}에 보관했어요` : '저장했어요. 방을 고르면 보관돼요.');
}

function openCapture(id) {
  const cap = S.captures.find((c) => c.id === id);
  if (!cap) return;
  const cards = S.cards.filter((c) => c.captureId === id);
  const files = capFiles(cap.id), side = hasImage(files);
  // 파일이 저장소에 없으면(올리다 막혔을 때) 다시 읽어도 소용없으니, 지우고 다시 넣으라고 알려 줘요
  const missing = /No such object|올리지 못했어요/.test(cap.error || '');
  dlg.innerHTML = `<form method="dialog" class="dlg ${side ? '' : 'one'}">
    ${DLG_X}
    ${side ? `<div class="dlg-img">${viewer(files)}</div>` : ''}
    <div class="dlg-form">
      <h2>${cap.bundle ? '원본 공문 묶음' : '원본 캡쳐'}</h2>
      <small>${side ? `${esc(cap.name || '')} · ` : ''}${esc(tsDate(cap.createdAt))}에 넣음${cap.note ? ` · ${esc(cap.note)}` : ''}</small>
      ${side ? '' : viewer(files)}
      ${cap.link ? `<small>함께 적은 링크: ${esc(cap.link)}</small>` : ''}
      ${cap.memo ? `<small>메모: ${esc(cap.memo)}</small>` : ''}
      ${cap.error ? `<div class="dlg-err"><b>${missing ? '파일이 저장소에 없어요' : '읽지 못했어요'}</b>${missing ? '<p>올리는 중에 막혀서 파일이 저장되지 않았어요. 아래 [원본과 카드 모두 지우기]를 누른 뒤 다시 넣어 주세요.</p>' : ''}<small>${esc(cap.error)}</small></div>` : ''}
      <h3>이 자료에서 나온 카드 ${cards.length}</h3>
      <div class="dlg-list">${cards.map((c) => `<a href="#${esc(c.room)}" data-act="close">${esc(floorOf(c.room).floor)} ${esc(roomName(c.room))} · ${esc(c.title)}${c.status === 'review' ? ' (확인 전)' : ''}</a>`).join('') || '<small>아직 없어요.</small>'}</div>
      <div class="dlg-acts">
        <button type="button" data-act="delcap" data-cap="${cap.id}">원본과 카드 모두 지우기</button>
        <button type="button" data-act="reread" data-cap="${cap.id}">다시 읽기</button>
        <button value="cancel">닫기</button>
      </div>
    </div>
  </form>`;
  hydrateImages(dlg);
  dlg.showModal();
}

// 방 제목 옆 직원 아이콘 → 그 방에서 일할 직원 고르기 창 (고르면 뒤의 3D 방에 바로 보여요)
function openStaffPick(k) {
  dlg.innerHTML = `<form method="dialog" class="dlg one">${DLG_X}<div class="dlg-form"><section class="staff-pick"></section></div></form>`;
  B3.staffPicker($('.staff-pick', dlg), k);
  dlg.showModal();
}

// 창 바깥(어두운 곳)을 누르면 닫혀요 (저장은 하지 않아요)
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close('cancel'); });
dlg.addEventListener('close', () => {
  const form = $('#cardForm', dlg);
  if (dlg.returnValue === 'save' && form) saveCard(form).catch((e) => toast(`저장하지 못했어요 (${e.code || e.message})`));
  dlg.returnValue = '';
});

// ---------- 사진 넣기 ----------
const OK_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

// 너무 크거나(8MB 넘음) AI가 못 읽는 형식이면 JPG로 바꿉니다. 긴 캡쳐의 글자가 뭉개지지 않게 짧은 변은 넉넉히 남깁니다.
async function prepare(file) {
  if (OK_TYPES[file.type] && file.size <= 8 * 1024 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.min(bmp.width, bmp.height), 16000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('변환 실패'))), 'image/jpeg', 0.88));
  } catch {
    return file;
  }
}

const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');

// ---------- 공문 묶음(PDF · 엑셀 · 사진) 넣기 전에 명단 거르기 ----------
// 명단(이름 · 학교 · 전화번호가 줄줄이)인 PDF 페이지 · 엑셀 시트는 이 PC 안에서만 읽고 빼요. 뺀 것은 AI에게도, 저장소에도 가지 않아요.
// 뺀 명단에서 선생님 이름이 있는 줄만 찾아 메모에 붙여 AI에게 알려 줘요 (대상자인지 알 수 있게).
// 명단 전체가 필요하면 업무관리시스템에서 공문을 찾아 보면 돼요 (카드에 공문 번호가 남아요)
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/';
const LIBS = {
  pdf: `${PDFJS}build/pdf.min.js`,
  pdfWorker: `${PDFJS}build/pdf.worker.min.js`,
  pdfLib: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  xlsx: 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
  zip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
};
const isSheet = (f) => /\.(xlsx|xls|csv)$/i.test(f.name || '') || /spreadsheet|ms-excel|text\/csv/.test(f.type);
// 문서: 업무관리시스템 본문(.odt) · 워드(.docx) · 한글 새 형식(.hwpx)은 압축 파일 안 XML, 한글 옛 형식(.hwp)은 analyzeHwp 로 이 PC 안에서 글자만 꺼내요
const isDoc = (f) => /\.(odt|docx|hwpx|hwp)$/i.test(f.name || '');
// 읽을 수 없는 옛 형식: 워드 .doc (PDF 로 바꿔서 넣어요)
const isOld = (f) => /\.doc$/i.test(f.name || '');
const loaded = {};
function loadScript(src) {
  loaded[src] ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => { delete loaded[src]; rej(new Error('읽는 도구를 불러오지 못했어요')); };
    document.head.append(s);
  });
  return loaded[src];
}
// pdf.js 는 worker 스크립트까지 불러 두면 이 페이지 안에서 바로 돌아요 (학교 PC에서 worker 가 막혀도 괜찮게)
async function pdfjs() { await loadScript(LIBS.pdf); await loadScript(LIBS.pdfWorker); return window.pdfjsLib; }
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('시간이 너무 오래 걸려요')), ms))]);

// ---- 개인정보 찾기: 이름 세 글자 · 휴대폰 번호 · 메일 주소 ----
// 이름은 '흔한 성으로 시작하는 한글 세 글자'이면서, 명단 머리(성명 · 이름)가 있는 쪽이거나 같은 줄에 학교 · 직위 · 전화번호가 있을 때만 (낱말을 이름으로 잘못 가리지 않게)
const SURNAME = '김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구민진나지엄채원천방공현함변염여추석길';
const NOT_NAME = new Set(('신청서 신청자 안내문 안내서 이수증 이수자 이메일 정보과 정보부 한국사 한문과 전문가 장학사 장학관 지원청 지원자 지도안 유치원 서울시 서초구 송파구 강남구 강동구 강서구 강북구 구로구 노원구 성동구 성북구 '
  + '하반기 상반기 방과후 방학중 공문서 공개수 담당자 남학생 여학생 고등학 전학년 진로과 주관처 원격연 연수원 심사표 심사위 채점표 배정표 성적표 추천서 홍보물 최종본 조직도 우수자 문의처 유의사 '
  + '전화번 이수시 신규자 정규직 강의실 강사료 조사서 장소는 임용자 오전에 오후에 서명란 서식을 신청은 권역별 안전한 송부용 전체적 고사장 양식은 허가서 남부청 차시별 주제명 민원인 진행자 지역별 원본은 공문은 변경시 추진단 길잡이 '
  + '주무관 교육감 교육장 행정실 교무실 정보실 과학실 상담실 보건실 도서실 전산실 방송실 음악실 미술실 체육관 교무부 진로부 학생부 연구부 안전부 부장님 담임반 전담교 정교사 기간제 강사님').split(' '));
const NAME_CTX = /학교|고등|중학|초등|여고|여중|교육지원청|교육청|교사|교감|교장|부장|주무관|장학사|연구사|01[016789]/;
const HEAD_CTX = /성\s*명|이\s*름/;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
// 글자 한 줄에서 가릴 곳 [시작, 끝] 목록 (내 이름은 빼요)
function maskHits(text, pageCtx, myName) {
  const hits = [], me = squash(myName || '');
  const ctx = pageCtx || NAME_CTX.test(text) || HEAD_CTX.test(text);
  for (const re of [/(?<![가-힣])([가-힣])\s?([가-힣])\s?([가-힣])(?![가-힣])/g]) {
    for (const m of text.matchAll(re)) {
      const w = m[1] + m[2] + m[3];
      if (!SURNAME.includes(w[0]) || NOT_NAME.has(w) || w === me) continue;
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 6);
      if (!ctx && !/^\s*(선생님|교사|교감|교장|님|부장|주무관|장학사)/.test(after)) continue;
      hits.push([m.index, m.index + m[0].length]);
    }
  }
  for (const re of [new RegExp(PHONE.source, 'g'), EMAIL]) for (const m of text.matchAll(re)) hits.push([m.index, m.index + m[0].length]);
  return hits;
}
const maskText = (line, pageCtx, myName) => maskHits(line, pageCtx, myName).sort((a, b) => b[0] - a[0]).reduce((s, [a, b]) => s.slice(0, a) + '■■■' + s.slice(b), line);

// 글자 조각을 높이(y)로 묶어 한 줄씩 (표는 한 행이 한 줄). 줄 글자마다 어느 조각 몇 번째 글자인지 기억해 두면, 가릴 곳의 자리를 알 수 있어요
function pageRows(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str?.trim()) continue;
    let r = rows.find((row) => Math.abs(row.y - it.transform[5]) < 3);
    if (!r) rows.push((r = { y: it.transform[5], items: [] }));
    r.items.push(it);
  }
  return rows.sort((a, b) => b.y - a.y).map((r) => {
    let text = '';
    const map = [];
    r.items.sort((a, b) => a.transform[4] - b.transform[4]).forEach((it) => {
      if (text) { text += ' '; map.push(null); }
      [...it.str].forEach((ch, off) => { text += ch; map.push({ it, off }); });
    });
    return { text, map };
  });
}
// 줄의 [시작, 끝] 글자 범위 → PDF 좌표 상자 [x1, y1, x2, y2]
function hitBox(row, [s, e]) {
  let box = null;
  for (let i = s; i < e; i++) {
    const c = row.map[i];
    if (!c) continue;
    const { it, off } = c, tx = it.transform, len = Math.max(1, it.str.length);
    const h = Math.hypot(tx[2], tx[3]) || it.height || 10;
    const b = [tx[4] + (it.width * off) / len, tx[5] - h * 0.3, tx[4] + (it.width * (off + 1)) / len, tx[5] + h * 0.95];
    box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b;
  }
  return box;
}
const PHONE = /01[016789][-.)\s]?\d{3,4}[-.\s]?\d{4}/g;
function looksLikeRoster(lines) {
  const text = lines.join('\n');
  const phones = (text.match(PHONE) || []).length;
  const schoolRows = lines.filter((l) => /학교|교육지원청|유치원/.test(l)).length;
  const header = /성\s*명|이\s*름/.test(text) && /연\s*번|번\s*호|순\s*번|소\s*속|학교명/.test(text);
  return phones >= 3 || (header && schoolRows >= 4) || schoolRows >= 10;
}
// 넣는 방법: keep 넣기 · mask 이름 가리고 넣기 · out 빼기. 가릴 곳이 있으면 처음부터 '가리기'
const MODES = { keep: '넣기', mask: '가리기', out: '빼기' };
const nextMode = (u) => { const order = u.hits ? ['keep', 'mask', 'out'] : ['keep', 'out']; return order[(order.indexOf(u.mode) + 1) % order.length]; };
// 가릴 곳을 작은 그림 위 덧그림에 검게 (가리기일 때만 보여요)
function drawBoxes(canvas, view, boxes) {
  const g = canvas.getContext('2d');
  g.fillStyle = '#000';
  for (const b of boxes) {
    const [x1, y1, x2, y2] = view.convertToViewportRectangle(b.r);
    g.fillRect(Math.min(x1, x2) - 1, Math.min(y1, y2) - 1, Math.abs(x2 - x1) + 2, Math.abs(y2 - y1) + 2);
  }
}
// PDF: 쪽마다 글자 · 작은 그림 · 가릴 곳
async function analyzePdf(file) {
  const lib = await pdfjs();
  const bytes = new Uint8Array(await file.arrayBuffer());
  // 한글 글꼴(CID)을 읽으려면 cmaps 가 있어야 해요. pdf.js 가 받은 사본은 가져가고, 원본 bytes 는 쪽을 자를 때 써요
  const pdf = await lib.getDocument({ data: bytes.slice(), cMapUrl: `${PDFJS}cmaps/`, cMapPacked: true, standardFontDataUrl: `${PDFJS}standard_fonts/` }).promise;
  const units = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const rows = pageRows((await page.getTextContent()).items);
    const lines = rows.map((r) => r.text.replace(/\s+/g, ' ').trim());
    const pageCtx = HEAD_CTX.test(lines.join('\n'));
    const boxes = rows.flatMap((r) => maskHits(r.text, pageCtx, S.myName).map((h) => ({ r: hitBox(r, h), w: squash(r.text.slice(h[0], h[1])) }))).filter((b) => b.r);
    const view = page.getViewport({ scale: 120 / page.getViewport({ scale: 1 }).width });
    const canvas = document.createElement('canvas'), over = document.createElement('canvas');
    canvas.width = over.width = Math.round(view.width); canvas.height = over.height = Math.round(view.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: view }).promise;
    drawBoxes(over, view, boxes);
    const noText = lines.join('').length < 20; // 스캔한 그림 PDF 는 글자를 못 읽어요 → 선생님이 직접 골라요
    const roster = !noText && looksLikeRoster(lines);
    units.push({ label: `${n}쪽`, n, canvas, over, lines, boxes, hits: boxes.length, noText, roster, mode: boxes.length ? 'mask' : 'keep' });
  }
  return { kind: 'pdf', file, bytes, pdf, units };
}
// 글자 덩이(엑셀 시트 · 문서 글 · 표): 가릴 곳 수를 세어 두고, 넣을 때 ■■■ 로 바꿔요
function textUnit(label, lines) {
  const pageCtx = HEAD_CTX.test(lines.slice(0, 3).join('\n'));
  const hits = lines.reduce((n, l) => n + maskHits(l, pageCtx, S.myName).length, 0);
  return { label, lines, rows: lines.length, pageCtx, hits, roster: looksLikeRoster(lines), mode: hits ? 'mask' : 'keep' };
}
// 엑셀: 시트마다 한 행이 한 줄. 글자로 바꿔 메모에 붙여 AI가 읽어요 (엑셀 파일 자체는 올리지 않아요)
async function analyzeSheet(file) {
  await loadScript(LIBS.xlsx);
  const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const units = wb.SheetNames.map((name) => {
    const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false, defval: '' });
    return textUnit(name, rows.map((r) => r.map((c) => String(c).trim()).filter(Boolean).join(' | ')).filter(Boolean));
  }).filter((u) => u.lines.length);
  return { kind: 'xlsx', file, units };
}
// 문서(.odt · .docx · .hwpx): 글은 문단마다 한 줄, 표는 한 행이 한 줄 ("칸 | 칸 | 칸"). 글 묶음과 표 하나하나가 따로 넣기 · 빼기 단위
const isTbl = (n) => n.localName === 'table' || n.localName === 'tbl';
const nearest = (n, test) => { for (let p = n.parentNode; p; p = p.parentNode) if (p.nodeType === 1 && test(p)) return p; return null; };
// 문단 글자 (안에 든 표 · 숨은 필드 코드는 빼고, 탭 · 줄바꿈은 띄어쓰기로)
function ownText(n) {
  let s = '';
  for (const c of n.childNodes) {
    if (c.nodeType === 3) s += c.nodeValue;
    else if (c.nodeType === 1 && !isTbl(c) && !/^(instrText|delText)$/.test(c.localName)) s += /^(tab|line-break|linebreak|lineBreak|br|cr|s)$/.test(c.localName) ? ' ' : ownText(c);
  }
  return s;
}
const clean = (s) => s.replace(/\s+/g, ' ').trim();
function tableLines(t) {
  const rowTag = t.localName === 'tbl' ? 'tr' : 'table-row', cellTag = t.localName === 'tbl' ? 'tc' : 'table-cell';
  return [...t.getElementsByTagNameNS('*', rowTag)].filter((r) => nearest(r, isTbl) === t).map((r) => {
    const cells = [...r.getElementsByTagNameNS('*', cellTag)].filter((c) => nearest(c, isTbl) === t);
    return cells.map((c) => {
      const ps = [...c.getElementsByTagNameNS('*', 'p')].filter((p) => nearest(p, isTbl) === t);
      return clean(ps.length ? ps.map(ownText).join(' ') : c.textContent);
    }).filter(Boolean).join(' | ');
  }).filter(Boolean);
}
function docBlocks(root) {
  const out = [];
  const text = (s) => { const last = out[out.length - 1]; if (last?.type === 'text') last.lines.push(s); else out.push({ type: 'text', lines: [s] }); };
  const walk = (n) => {
    for (const c of n.children) {
      if (isTbl(c)) out.push({ type: 'table', lines: tableLines(c) });
      else if (c.localName === 'p' || c.localName === 'h') {
        const s = clean(ownText(c));
        if (s) text(s);
        // 한글(.hwpx)은 표가 문단 안에 들어 있어요
        for (const t of c.getElementsByTagNameNS('*', 'tbl')) if (nearest(t, (x) => x === c || isTbl(x)) === c) out.push({ type: 'table', lines: tableLines(t) });
      } else walk(c);
    }
  };
  walk(root);
  return out.filter((b) => b.lines.length);
}
// 한글 옛 형식(.hwp 5.0): 저장 파일(CFB) 안 BodyText/Section0, 1 … 에 문단 글자 기록(HWPTAG_PARA_TEXT = 67)이 들어 있어요.
// 표 칸 글자도 문단으로 들어 있어서 한 줄씩 나와요 (표 모양은 없어지지만 글자는 다 읽어요). CFB 는 엑셀용 SheetJS 에 들어 있어요
// 압축이 끝난 뒤에 남는 꼬리 바이트가 있으면 브라우저가 오류를 내요. 그때까지 풀린 내용만 써요
async function inflateRaw(u8) {
  const reader = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const parts = [];
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); } } catch (e) { if (!parts.length) throw e; }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function hwpParaText(b, off, size) {
  let s = '';
  for (let i = 0; i + 1 < size;) {
    const c = b[off + i] | (b[off + i + 1] << 8);
    if (c >= 32) { s += String.fromCharCode(c); i += 2; continue; }
    // 한 칸짜리 조종 문자(줄바꿈 · 문단 끝 · 띄어쓰기 종류)와, 8칸(16바이트)을 차지하는 표 · 그림 · 탭 같은 조종 문자
    if ([0, 10, 13, 24, 25, 26, 27, 28, 29, 30, 31].includes(c)) { if (c === 10 || c >= 30) s += ' '; i += 2; } else { if (c === 9) s += ' '; i += 16; }
  }
  return s;
}
async function analyzeHwp(file) {
  await loadScript(LIBS.xlsx);
  const cfb = window.XLSX.CFB.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
  const entries = cfb.FullPaths.map((p, i) => [p, cfb.FileIndex[i]]);
  const head = entries.find(([p]) => /\/FileHeader$/i.test(p))?.[1]?.content;
  if (!head) throw new Error('한글(.hwp) 파일로 열리지 않아요');
  const flags = head[36] | (head[37] << 8);
  if (flags & 2) throw new Error('비밀번호가 걸린 한글 파일이에요');
  if (flags & 4) throw new Error('배포용(읽기 전용) 한글 파일이라 글자를 꺼낼 수 없어요. PDF로 바꿔서 넣어 주세요');
  const secs = entries.filter(([p]) => /\/BodyText\/Section\d+$/i.test(p)).sort(([a], [b]) => parseInt(a.match(/(\d+)$/)[1], 10) - parseInt(b.match(/(\d+)$/)[1], 10));
  const blocks = [];
  for (const [, e] of secs) {
    let b = new Uint8Array(e.content);
    if (flags & 1) b = await inflateRaw(b);
    blocks.push(...hwpBlocks(hwpTree(hwpRecords(b))));
  }
  // 표 · 글 묶음마다 넣기 · 가리기 · 빼기 (.odt · .hwpx 와 같게)
  const seen = new Set();
  let t = 0, g = 0;
  const units = blocks.filter((x) => { const k = x.lines.join('\n'); if (seen.has(k)) return false; seen.add(k); return true; })
    .map((x) => textUnit(x.type === 'table' ? `표 ${++t}` : `글 ${++g}`, x.lines));
  if (!units.length) throw new Error(`${file.name} 에서 글자를 찾지 못했어요`);
  return { kind: 'doc', file, units };
}
// 기록 하나 = 머리 4바이트(종류 10비트 · 깊이 10비트 · 크기 12비트, 크기가 0xFFF 면 뒤 4바이트) + 내용
function hwpRecords(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), out = [];
  for (let p = 0; p + 4 <= b.length;) {
    const h = dv.getUint32(p, true);
    p += 4;
    let size = (h >>> 20) & 0xfff;
    if (size === 0xfff) { size = dv.getUint32(p, true); p += 4; }
    out.push({ tag: h & 0x3ff, level: (h >>> 10) & 0x3ff, data: b.subarray(p, p + size), kids: [] });
    p += size;
  }
  return out;
}
// 깊이로 나무 모양 만들기 (깊이 n+1 기록은 바로 앞 깊이 n 기록의 자식)
function hwpTree(recs) {
  const root = { level: -1, kids: [] }, stack = [root];
  for (const r of recs) {
    while (stack.length > 1 && stack[stack.length - 1].level >= r.level) stack.pop();
    stack[stack.length - 1].kids.push(r);
    stack.push(r);
  }
  return root.kids;
}
// 문단(66) → 글자(67) · 조종(71). 조종 안에 표(77)가 있으면 칸(72)마다 문단을 모아 행으로 (표 기록의 '행마다 칸 수'로 나눠요)
const HWP = { para: 66, text: 67, ctrl: 71, list: 72, table: 77 };
function hwpBlocks(nodes) {
  const out = [];
  const text = (s) => { const last = out[out.length - 1]; if (last?.type === 'text') last.lines.push(s); else out.push({ type: 'text', lines: [s] }); };
  const table = (lines) => out.push({ type: 'table', lines });
  const para = (n, onText, onTable) => {
    const t = n.kids.find((k) => k.tag === HWP.text);
    const s = t ? clean(hwpParaText(t.data, 0, t.data.length)) : '';
    if (s) onText(s);
    for (const k of n.kids) if (k.tag === HWP.ctrl) ctrl(k, onText, onTable);
  };
  // 칸 속 글자 (칸 안의 표는 ' / ' 로 이어 붙여요)
  const cellText = (paras) => { const parts = []; for (const p of paras) para(p, (s) => parts.push(s), (ls) => parts.push(ls.join(' / '))); return parts.join(' '); };
  const ctrl = (c, onText, onTable) => {
    const cells = [];
    let cur = null;
    for (const k of c.kids) {
      if (k.tag === HWP.list) { cur = k.kids.filter((q) => q.tag === HWP.para); cells.push(cur); } // 문단이 칸의 자식으로 오는 경우
      else if (k.tag === HWP.para) { if (!cur) { cur = []; cells.push(cur); } cur.push(k); } // 칸 뒤에 형제로 오는 경우
    }
    const tbl = c.kids.find((k) => k.tag === HWP.table);
    if (!tbl) { for (const cell of cells) for (const p of cell) para(p, onText, onTable); return; } // 머리말 · 글상자 같은 것: 그냥 글로
    const texts = cells.map(cellText), d = tbl.data, dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    const nRows = d.length >= 8 ? dv.getUint16(4, true) : 0, nCols = d.length >= 8 ? dv.getUint16(6, true) : 0;
    let sizes = d.length >= 18 + nRows * 2 ? Array.from({ length: nRows }, (_, r) => dv.getUint16(18 + r * 2, true)) : [];
    if (sizes.reduce((a, x) => a + x, 0) !== texts.length) sizes = nCols ? Array.from({ length: Math.ceil(texts.length / nCols) }, () => nCols) : texts.map(() => 1);
    const lines = [];
    let i = 0;
    for (const n of sizes) { const row = texts.slice(i, i + n).filter(Boolean).join(' | '); i += n; if (row) lines.push(row); }
    if (lines.length) onTable(lines);
  };
  for (const n of nodes) if (n.tag === HWP.para) para(n, text, table);
  return out.filter((x) => x.lines.length);
}
async function analyzeDoc(file) {
  if (/\.hwp$/i.test(file.name)) return analyzeHwp(file);
  await loadScript(LIBS.zip);
  const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
  const xmlOf = async (p) => { const s = await zip.file(p)?.async('string'); return s ? new DOMParser().parseFromString(s, 'application/xml').documentElement : null; };
  let roots;
  if (/\.odt$/i.test(file.name)) {
    // 업무관리시스템 본문(.odt)은 기관명 · 수신 · 제목이 머리말에, 시행 번호 · 연락처가 꼬리말에 있어요 (styles.xml)
    const st = await xmlOf('styles.xml');
    const part = (tag) => (st ? [...st.getElementsByTagNameNS('*', tag)] : []);
    roots = [...part('header'), await xmlOf('content.xml'), ...part('footer')];
  } else if (/\.docx$/i.test(file.name)) {
    roots = [await xmlOf('word/document.xml')];
  } else {
    const secs = Object.keys(zip.files).filter((p) => /^Contents\/section\d+\.xml$/i.test(p)).sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
    roots = await Promise.all(secs.map(xmlOf));
  }
  const seen = new Set();
  const blocks = roots.filter(Boolean).flatMap(docBlocks).filter((b) => { const k = b.lines.join('\n'); if (seen.has(k)) return false; seen.add(k); return true; });
  let t = 0, g = 0;
  const units = blocks.map((b) => textUnit(b.type === 'table' ? `표 ${++t}` : `글 ${++g}`, b.lines));
  if (!units.length) throw new Error(`${file.name} 에서 글자를 찾지 못했어요`);
  return { kind: 'doc', file, units };
}
const squash = (s) => s.replace(/\s/g, '');
// 가리거나 뺀 쪽 · 시트에서 내 이름이 있는 줄만 (최대 5줄)
function myLines(list, name) {
  if (!squash(name)) return [];
  return list.flatMap((a) => a.units.filter((u) => u.mode !== 'keep').flatMap((u) => u.lines.filter((l) => squash(l).includes(squash(name)))))
    .slice(0, 5).map((l) => l.slice(0, 200));
}
// PDF 다시 만들기: 넣기 쪽은 그대로, 가리기 쪽은 그림으로 그려 검은 상자를 칠해서 (글자층이 남지 않게), 빼기 쪽은 없이
async function keepPages(a, myName) {
  try {
    if (a.units.every((u) => u.mode === 'keep')) return a.file;
    if (a.units.every((u) => u.mode === 'out')) return null;
    await loadScript(LIBS.pdfLib);
    const { PDFDocument } = window.PDFLib;
    const src = await PDFDocument.load(a.bytes, { ignoreEncryption: true });
    const out = await PDFDocument.create();
    const me = squash(myName || '');
    for (const u of a.units) {
      if (u.mode === 'keep') { const [p] = await out.copyPages(src, [u.n - 1]); out.addPage(p); }
      if (u.mode !== 'mask') continue;
      const page = await a.pdf.getPage(u.n);
      const base = page.getViewport({ scale: 1 }), view = page.getViewport({ scale: 2 });
      const c = document.createElement('canvas');
      c.width = Math.round(view.width); c.height = Math.round(view.height);
      await page.render({ canvasContext: c.getContext('2d'), viewport: view }).promise;
      drawBoxes(c, view, u.boxes.filter((b) => !me || b.w !== me));
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
      const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      out.addPage([base.width, base.height]).drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
    }
    return new File([await out.save()], a.file.name, { type: 'application/pdf' });
  } finally {
    a.pdf?.destroy();
  }
}
// 넣는 엑셀 시트 · 문서 글 · 표를 글자로 (가리기는 ■■■, 한 덩이 8천 자, 모두 4만 자까지)
const unitText = (u, myName) => (u.mode === 'mask' ? u.lines.map((l) => maskText(l, u.pageCtx, myName)) : u.lines);
function sheetText(list, myName) {
  const parts = list.filter((a) => a.kind !== 'pdf').flatMap((a) => a.units.filter((u) => u.mode !== 'out').map((u) => `[${a.kind === 'xlsx' ? '첨부 엑셀' : '문서'} ${a.file.name} · ${u.label}]\n${unitText(u, myName).join('\n').slice(0, 8000)}`));
  return parts.join('\n\n').slice(0, 40000);
}
// PDF · 사진 없이 문서 · 엑셀만 넣었을 때: AI가 읽을 파일이 하나는 있어야 해서, 앞부분 글자로 표지 그림을 만들어요 (내용은 메모 글자로 같이 가요)
async function coverImage(list, myName) {
  const first = list.find((a) => a.kind !== 'pdf');
  const lines = [first.file.name, '', ...first.units.filter((u) => u.mode !== 'out').flatMap((u) => unitText(u, myName))].slice(0, 40);
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 120 + lines.length * 34;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#22303a'; g.font = '24px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
  g.fillText('공문 본문 (글자로 함께 보냄)', 40, 60);
  lines.forEach((l, i) => g.fillText(l.slice(0, 70), 40, 120 + i * 34));
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9));
  return new File([blob], '본문 표지.jpg', { type: 'image/jpeg' });
}
const pageSpan = (ns) => ns.reduce((acc, n) => { const last = acc[acc.length - 1]; if (last && n === last[1] + 1) last[1] = n; else acc.push([n, n]); return acc; }, []).map(([a, b]) => (a === b ? `${a}쪽` : `${a}~${b}쪽`)).join(', ');
const modeLabel = (a, mode) => { const us = a.units.filter((u) => u.mode === mode); return a.kind === 'pdf' ? pageSpan(us.map((u) => u.n)) : us.map((u) => (a.kind === 'xlsx' ? `'${u.label}' 시트` : u.label)).join(', '); };

// 거르기를 못 했을 때: 개인정보가 없는 공문이면 그대로 넣을 수 있게 물어봐요 (엑셀 · 문서는 읽지 못하니 빼요)
function askPlain(reason, pdfs) {
  dlg.innerHTML = `<form method="dialog" class="dlg one">${DLG_X}<div class="dlg-form">
    <h2>개인정보 거르기를 못 했어요</h2>
    <div class="dlg-err"><b>${esc(reason)}</b><p>이름 · 연락처가 없는 공문이면 PDF를 그대로 넣어도 돼요. 있으면 [취소]를 누르고 잠시 뒤 다시 넣어 주세요.</p></div>
    <div class="dlg-acts"><button value="cancel">취소</button><button type="button" class="yes" id="goPlain">${pdfs.length ? 'PDF 그대로 넣기' : '사진만 넣기'}</button></div>
  </div></form>`;
  let ok = false;
  $('#goPlain', dlg).addEventListener('click', () => { ok = true; dlg.close(); });
  dlg.showModal();
  return new Promise((res) => dlg.addEventListener('close', () => res(ok ? { files: pdfs, note: '' } : null), { once: true }));
}
// 넣기 전 확인 창: 쪽 · 시트 · 표를 누를 때마다 넣기 → 가리기 → 빼기. [이대로 넣기]를 누르면 { files, note }, 닫으면 null
async function checkFiles(pdfs, sheets, docs, hasImgs, label = '') {
  toast('이름 · 연락처가 있는지 이 PC 안에서 살펴보고 있어요…');
  // 파일마다 따로 읽어서, 비밀번호가 걸렸거나 못 읽는 파일은 그 파일만 빼고 넣어요 (명단 엑셀에 비밀번호를 거는 공문이 많아요)
  const jobs = [...pdfs.map((f) => [f, analyzePdf]), ...sheets.map((f) => [f, analyzeSheet]), ...docs.map((f) => [f, analyzeDoc])];
  let settled;
  try {
    settled = await withTimeout(Promise.allSettled(jobs.map(([f, fn]) => fn(f))), 40000);
  } catch (e) {
    return askPlain(`${e.message || e}`, pdfs);
  }
  const list = [], skipped = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') list.push(r.value);
    else skipped.push({ name: jobs[i][0].name, why: /password|encrypt|비밀번호/i.test(r.reason?.message || r.reason?.name || '') ? '비밀번호가 걸려 있어요' : `읽지 못했어요 (${r.reason?.message || r.reason})` });
  });
  if (!list.length) {
    toast(`${skipped.map((s) => `${s.name}: ${s.why}`).join(' · ')}${hasImgs ? ' — 사진만 넣을게요' : ''}`);
    return hasImgs ? { files: [], note: '' } : null;
  }
  const skippedBox = skipped.length ? `<div class="dlg-err"><b>빼고 넣는 파일 ${skipped.length}개</b>${skipped.map((s) => `<p>${esc(s.name)} — ${esc(s.why)}</p>`).join('')}<small>비밀번호가 걸린 명단은 업무관리시스템에서 직접 열어 보세요.</small></div>` : '';
  const tag = (u) => (u.hits ? ` · 이름 등 ${u.hits}곳` : u.roster ? ' · 명단 같음' : u.noText ? ' · 그림' : '');
  const tile = (a, i) => a.units.map((u, j) => `<button type="button" class="pg ${u.mode} ${a.kind}" data-f="${i}" data-p="${j}">
      ${a.kind === 'pdf' ? '<span class="cv"></span>' : `<span class="sh">${u.rows}줄</span>`}
      <small>${esc(u.label)}${tag(u)}</small><b>${MODES[u.mode]}</b></button>`).join('');
  dlg.innerHTML = `<form method="dialog" class="dlg one pdfcheck">${DLG_X}<div class="dlg-form">
    <h2>넣기 전에 개인정보 가리기${label ? ` <small>${esc(label)}</small>` : ''}</h2>
    <p class="note">이름 세 글자 · 휴대폰 번호 · 메일 주소로 보이는 곳은 까맣게 <b>가리고</b> 넣어요. 가린 쪽은 그림으로 다시 만들어서 가린 글자가 AI에게도, 저장소에도 가지 않아요. 누를 때마다 <b>넣기 → 가리기 → 빼기</b>로 바뀌어요.</p>
    ${skippedBox}
    <label>내 이름 <small>(내 이름은 가리지 않고, 명단에 있는지 AI에게 알려 줘요)</small><input id="myName" autocomplete="off" placeholder="예: 홍길동" value="${esc(S.myName || '')}"></label>
    ${list.map((a, i) => `<section class="pc-file"><h3>${{ xlsx: '엑셀 · ', doc: '문서 · ' }[a.kind] || ''}${esc(a.file.name)}</h3><div class="pgrid">${tile(a, i)}</div></section>`).join('')}
    <div class="found" id="found"></div>
    <div class="dlg-acts"><button value="cancel">취소</button><button type="button" class="yes" id="goPdf">${skipped.length ? `${skipped.length}개 빼고 넣기` : '이대로 넣기'}</button></div>
  </div></form>`;
  dlg.querySelectorAll('.pg.pdf').forEach((b) => { const u = list[b.dataset.f].units[b.dataset.p]; b.querySelector('.cv').append(u.canvas, u.over); });
  const nameEl = $('#myName', dlg), foundEl = $('#found', dlg);
  const some = (mode) => list.filter((a) => a.units.some((u) => u.mode === mode));
  const note = () => {
    const name = nameEl.value.trim(), masked = some('mask').length, out = some('out').length;
    if (!masked && !out) return '';
    const what = [masked && '이름 · 연락처는 까맣게 가리고', out && '명단 일부는 빼고'].filter(Boolean).join(', ');
    const mine = myLines(list, name);
    return `개인정보라 ${what} 넣었어요.${name ? (mine.length ? ` 명단에서 찾은 ${name} 줄: ${mine.join(' / ')}` : ` 가린 명단에 ${name} 이름은 없었어요.`) : ''}`;
  };
  const show = () => {
    const name = nameEl.value.trim(), mine = myLines(list, name);
    const line = (mode, label) => { const fs = some(mode); return fs.length ? `<b>${label}</b> ${fs.map((a) => `${esc(a.file.name.replace(/\.(pdf|xlsx?|csv|odt|docx|hwpx?)$/i, '').slice(-24))} ${esc(modeLabel(a, mode))}`).join(' · ')}<br>` : ''; };
    const body = line('mask', '가리는 것') + line('out', '빼는 것');
    foundEl.innerHTML = body
      ? `${body}<b>AI에게 알려 줄 내 줄</b> ${name ? (mine.length ? mine.map(esc).join(' / ') : '명단에 이름이 없어요') : '이름을 적으면 찾아요'}`
      : '<b>가리거나 빼는 것 없음</b> 이름 · 연락처로 보이는 곳이 없어서 그대로 넣어요.';
  };
  dlg.querySelector('.pdfcheck').addEventListener('click', (e) => {
    const b = e.target.closest('.pg');
    if (!b) return;
    const u = list[b.dataset.f].units[b.dataset.p];
    b.classList.remove(u.mode);
    u.mode = nextMode(u);
    b.classList.add(u.mode);
    b.querySelector('b').textContent = MODES[u.mode];
    show();
  });
  nameEl.addEventListener('input', show);
  show();
  let ok = false;
  $('#goPdf', dlg).addEventListener('click', () => { ok = true; dlg.close(); });
  dlg.showModal();
  await new Promise((res) => dlg.addEventListener('close', res, { once: true }));
  if (!ok) { list.forEach((a) => a.pdf?.destroy()); return null; }
  const name = nameEl.value.trim();
  if (name !== (S.myName || '')) {
    S.myName = name;
    setDoc(doc(db, dbPath('meta/me')), { name, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
  }
  toast('개인정보를 가린 파일을 만들고 있어요…');
  const files = (await Promise.all(list.filter((a) => a.kind === 'pdf').map((a) => keepPages(a, name)))).filter(Boolean);
  if (!files.length && !hasImgs && list.some((a) => a.kind !== 'pdf' && a.units.some((u) => u.mode !== 'out'))) files.push(await coverImage(list, name));
  return { files, note: [note(), sheetText(list, name)].filter(Boolean).join('\n\n') };
}

// 전에 넣은 파일 이름 (묶음은 넣은 파일 전부 · 본문 .odt · 엑셀 포함). 'image.png' 같은 붙여넣기 이름은 빼요
const GENERIC = /^(image|붙여넣은 이미지|본문 표지)(\s*\(\d+\))?\.\w+$/i;
function dupFiles(files) {
  // 파일 이름 모양이 달라도(번호가 앞 · 뒤) 공문번호와 본문 · 첨부가 같으면 같은 파일로 봐요
  const sig = (n) => { const no = docNo(n); return no ? `#${no}|${/\(첨부\)/.test(n) ? '첨부' : '본문'}|${n.split('.').pop().toLowerCase()}` : ''; };
  const seen = new Map();
  for (const cap of S.captures) {
    const names = cap.sources || cap.files?.map((f) => f.name) || [cap.name];
    names.filter(Boolean).forEach((n) => { for (const k of [n, sig(n)]) if (k && !seen.has(k)) seen.set(k, cap); });
  }
  const hit = (f) => seen.get(f.name) || (sig(f.name) && seen.get(sig(f.name)));
  return files.filter((f) => !GENERIC.test(f.name || '') && hit(f)).map((f) => ({ file: f, cap: hit(f) }));
}
// 같은 이름 파일이 있으면 물어봐요: 'skip' 같은 파일 빼고 · 'all' 모두 넣기 · null 취소
function askDup(dups) {
  dlg.innerHTML = `<form method="dialog" class="dlg one">${DLG_X}<div class="dlg-form">
    <h2>전에 넣은 파일이 있어요</h2>
    <p class="note">이름이 같은 파일을 전에 넣었어요. 같은 공문을 또 넣으면 카드가 두 장씩 생겨요.</p>
    <ul class="dup-list">${dups.map((d) => `<li>${esc(d.file.name)} <small>· ${esc(tsDate(d.cap.createdAt) || '전에')} 넣음</small></li>`).join('')}</ul>
    <div class="dlg-acts"><button value="cancel">취소</button><button type="button" id="dupAll">그래도 모두 넣기</button><button type="button" class="yes" id="dupSkip">같은 파일 빼고 넣기</button></div>
  </div></form>`;
  let choice = null;
  $('#dupAll', dlg).addEventListener('click', () => { choice = 'all'; dlg.close(); });
  $('#dupSkip', dlg).addEventListener('click', () => { choice = 'skip'; dlg.close(); });
  dlg.showModal();
  return new Promise((res) => dlg.addEventListener('close', () => res(choice), { once: true }));
}

// 업무관리시스템에서 받은 파일 이름 속 공문번호 (두 모양 다): '… [진선여자고등학교-10941 (본문)].pdf' · '(진선여자고등학교-10941 (첨부) …) ….pdf'
const docNo = (name) => String(name || '').match(/[가-힣A-Za-z]+-(\d{3,7})\s*\((?:본문|첨부)/)?.[1] || '';
// 폴더째 끌어다 놓으면 안쪽 파일을 모두 꺼내요 (하위 폴더까지)
async function dropFiles(dt) {
  const entries = [...(dt.items || [])].map((it) => it.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.some((e) => e.isDirectory)) return [...dt.files];
  const out = [];
  const walk = async (e) => {
    if (e.isFile) { out.push(await new Promise((res, rej) => e.file(res, rej))); return; }
    const reader = e.createReader();
    for (;;) {
      const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const x of batch) await walk(x);
    }
  };
  for (const e of entries) await walk(e);
  return out.filter((f) => !/^(\.|~\$|thumbs\.db$|desktop\.ini$)/i.test(f.name));
}

// 파일 여러 개를 넣으면 이름 속 공문번호로 나눠서, 공문마다 본문 + 첨부를 한 묶음으로 차례로 읽어요
// 번호가 없는 PDF · 문서는 지금처럼 한 묶음, 사진은 한 장씩
async function upload(fileList) {
  let all = [...fileList];
  const dups = dupFiles(all);
  if (dups.length) {
    const choice = await askDup(dups);
    if (!choice) return;
    if (choice === 'skip') all = all.filter((f) => !dups.some((d) => d.file === f));
    if (!all.length) { toast('모두 전에 넣은 파일이라 넣지 않았어요'); return; }
  }
  const groups = new Map();
  for (const f of all) { const k = docNo(f.name) || '-'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
  const sets = [...groups.entries()].sort(([a], [b]) => (a === '-') - (b === '-') || Number(a) - Number(b));
  if (sets.length < 2) { await uploadSet(all); return; }
  toast(`공문 ${sets.length - (groups.has('-') ? 1 : 0)}건으로 나눠서 차례로 넣을게요`);
  const pending = { ...S.pending };
  for (const [i, [no, files]] of sets.entries()) {
    S.pending = { ...pending };
    const label = `${i + 1} / ${sets.length} · ${no === '-' ? '번호 없는 파일' : `공문 ${no}번`}`;
    if ((await uploadSet(files, label)) === 'cancel') { toast(`${label}에서 멈췄어요`); break; }
  }
  S.pending = { link: '', memo: '' };
}
// 공문 한 묶음 넣기 (label: 여러 공문을 차례로 넣을 때 확인 창에 보이는 순서). 확인 창에서 취소하면 'cancel'
async function uploadSet(all, label = '') {
  const pdfs = all.filter(isPdf), sheets = all.filter(isSheet), docs = all.filter(isDoc);
  const imgs = all.filter((f) => !isPdf(f) && !isSheet(f) && !isDoc(f) && f.type.startsWith('image/'));
  if (all.some(isOld)) toast('워드 .doc 파일은 읽을 수 없어서 빼고 넣어요. PDF로 바꿔서 넣어 주세요');
  if (!pdfs.length && !imgs.length && !sheets.length && !docs.length) { toast(`${label ? `${label}: ` : ''}사진 · PDF · 엑셀 · 문서(.odt · .docx · .hwp · .hwpx) 파일만 넣을 수 있어요`); return; }
  // PDF · 엑셀 · 문서는 먼저 이 PC 안에서 명단을 걸러요
  let checked = null;
  if (pdfs.length || sheets.length || docs.length) {
    checked = await checkFiles(pdfs, sheets, docs, imgs.length > 0, label);
    if (!checked) return 'cancel';
    if (!checked.files.length && !imgs.length) { toast('모두 빼서 넣을 것이 없어요'); return; }
  }
  const { link } = S.pending;
  const memo = [S.pending.memo, checked?.note].filter(Boolean).join('\n');
  S.pending = { link: '', memo: '' };
  if (S.q) { S.q = ''; $('#search').value = ''; }
  if (route() !== 'lobby') location.hash = 'lobby';
  // PDF · 엑셀 · 문서가 있으면 사진까지 한 묶음 (엑셀 · 문서 내용은 메모에 글자로 붙어 같이 가요)
  if (checked) {
    const pdfN = checked.files.filter(isPdf).length;
    const what = [docs.length && `문서 ${docs.length}개`, pdfN && `PDF ${pdfN}개`, sheets.length && `엑셀 ${sheets.length}개`, imgs.length && `사진 ${imgs.length}장`].filter(Boolean).join(' · ');
    toast(`${what}를 공문 한 묶음으로 넣었어요. 다 올라가면 읽기 시작해요.`);
    await uploadBundle([...checked.files, ...imgs], link, memo, all.map((f) => f.name).filter(Boolean));
    return;
  }
  toast(`1층 접수처에 ${imgs.length}장 들어왔어요. 바로 읽기 시작해요.`);
  await Promise.all(imgs.map((f) => uploadOne(f, link, memo)));
}

// 공문 묶음: 파일을 ailab/bundles/{번호}/ 에 모두 올린 뒤, 서버 함수 readBundle 에 '다 올렸어요' 하고 읽기를 맡겨요
// sources = 선생님이 넣은 원래 파일 이름 전부 (다음에 같은 파일을 또 넣으면 알려 주려고)
async function uploadBundle(files, link, memo, sources = files.map((f) => f.name)) {
  const capRef = doc(collection(db, dbPath('captures')));
  const up = { name: sources.length > 1 ? `${sources[0]} 외 ${sources.length - 1}개` : files[0].name, sent: 0, total: 0 };
  S.uploading.set(capRef.id, up);
  render();
  try {
    const total = files.reduce((n, f) => n + f.size, 0);
    if (total > 20 * 1024 * 1024) throw new Error('파일이 합쳐서 20MB를 넘어요. 나눠서 넣어 주세요');
    const list = [];
    for (const [i, f] of files.entries()) {
      const pdf = isPdf(f);
      const blob = pdf ? f : await prepare(f);
      const type = pdf ? 'application/pdf' : blob.type || 'image/jpeg';
      list.push({ path: `ailab/bundles/${capRef.id}/${i + 1}.${pdf ? 'pdf' : OK_TYPES[type] || 'img'}`, name: f.name || `파일 ${i + 1}`, type, blob });
    }
    const meta = list.map(({ path, name, type }) => ({ path, name, type }));
    const name = sources.length > 1 ? `${sources[0]} 외 ${sources.length - 1}개` : sources[0] || files[0].name;
    await setDoc(capRef, { status: 'uploading', bundle: true, name, files: meta, sources, storagePath: meta[0].path, link, memo, createdAt: serverTimestamp() });
    up.total = list.reduce((n, x) => n + x.blob.size, 0);
    const sent = list.map(() => 0);
    await Promise.all(list.map((x, i) => putFile(x.path, x.blob, x.type, (b) => { sent[i] = b; up.sent = sent.reduce((n, v) => n + v, 0); setBar(capRef.id, pctOf(up)); })));
    S.readStart[capRef.id] = Date.now();
    await updateDoc(capRef, { status: 'reading' });
  } catch (e) {
    await setDoc(capRef, { status: 'error', bundle: true, error: `올리지 못했어요 (${e.code || e.message})`, createdAt: serverTimestamp() }, { merge: true }).catch(() => {});
    S.uploading.delete(capRef.id);
    render();
    return;
  }
  S.uploading.delete(capRef.id);
  render();
  // 읽는 데 1~3분 걸려요. 기다리지 않고, 결과 카드는 화면에 저절로 들어와요
  httpsCallable(fns, 'readBundle', { timeout: 540000 })({ captureId: capRef.id })
    .catch((e) => toast(`공문 묶음을 읽지 못했어요 (${e.message})`));
}

async function uploadOne(file, link, memo) {
  const capRef = doc(collection(db, dbPath('captures')));
  const up = { name: file.name || '붙여넣은 이미지', sent: 0, total: 0 };
  S.uploading.set(capRef.id, up);
  render();
  try {
    const blob = await prepare(file);
    up.total = blob.size;
    const path = `ailab/captures/${capRef.id}.${OK_TYPES[blob.type] || 'img'}`;
    await setDoc(capRef, { status: 'reading', name: file.name || '붙여넣은 이미지', storagePath: path, link, memo, createdAt: serverTimestamp() });
    await putFile(path, blob, blob.type || 'image/jpeg', (b) => { up.sent = b; setBar(capRef.id, pctOf(up)); });
    S.readStart[capRef.id] = Date.now();
  } catch (e) {
    await setDoc(capRef, { status: 'error', error: `올리지 못했어요 (${e.code || e.message})`, createdAt: serverTimestamp() }, { merge: true }).catch(() => {});
  } finally {
    S.uploading.delete(capRef.id);
    render();
  }
}

async function reread(capId) {
  toast('다시 읽고 있어요');
  try {
    await httpsCallable(fns, 'rereadCapture', { timeout: 300000 })({ captureId: capId });
  } catch (e) {
    toast(`다시 읽지 못했어요 (${e.message})`);
  }
}

async function deleteCapture(capId) {
  const cap = S.captures.find((c) => c.id === capId);
  if (!cap || !confirm('이 원본과 여기서 나온 카드를 모두 지울까요? 되돌릴 수 없어요.')) return;
  const cards = await getDocs(query(collection(db, dbPath('cards')), where('captureId', '==', capId)));
  const batch = writeBatch(db);
  cards.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, dbPath(`captures/${capId}`)));
  await batch.commit();
  const paths = cap.files?.length ? cap.files.map((f) => f.path) : [cap.storagePath].filter(Boolean);
  await Promise.all(paths.map((p) => deleteObject(ref(storage, p)).catch(() => {})));
  if (dlg.open) dlg.close();
  toast('지웠어요');
}

// ---------- 과제 저장 ----------
function saveTask(patch) {
  return setDoc(doc(db, dbPath('meta/task')), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
    .catch((e) => toast(`저장하지 못했어요 (${e.code})`));
}

// ---------- 이벤트 ----------
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.tagName === 'SELECT' || b.type === 'checkbox') return;
  const { act, id, cap } = b.dataset;
  try {
    switch (act) {
      case 'upload':
        if (isGuest()) { toast('선생님 로그인 후에 사진을 넣을 수 있어요'); await login(); } else $('#fileInput').click();
        break;
      case 'login': await login(); break;
      case 'logout': await signOut(auth); break;
      case 'confirm':
        await updateDoc(doc(db, dbPath(`cards/${id}`)), { status: 'done', unsure: [], confirmedAt: serverTimestamp() });
        toast(`${roomName(cardById(id)?.room)}에 보관했어요`);
        break;
      case 'confirmAll': {
        const batch = writeBatch(db);
        const list = S.cards.filter((c) => c.status === 'review' && !isUnsorted(c));
        list.forEach((c) => batch.update(doc(db, dbPath(`cards/${c.id}`)), { status: 'done', unsure: [], confirmedAt: serverTimestamp() }));
        await batch.commit();
        toast(`${list.length}장을 각 방에 보관했어요`);
        break;
      }
      case 'edit': e.preventDefault(); openCard(id); break;
      case 'del':
        if (confirm('이 카드를 버릴까요? 원본 사진은 B1 보관실에 남아요.')) {
          await deleteDoc(doc(db, dbPath(`cards/${id}`)));
          if (dlg.open) dlg.close();
          toast('버렸어요');
        }
        break;
      case 'ref': {
        const c = cardById(id);
        await updateDoc(doc(db, dbPath(`cards/${id}`)), { taskRef: !c?.taskRef });
        toast(c?.taskRef ? '과제에서 뺐어요' : '2F 과제 작업실에 담았어요');
        break;
      }
      case 'subj': S.subj = b.dataset.v; render(); break;
      case 'stats': S.stats = null; render(); break;
      case 'bosstab': S.bossTab = b.dataset.v; render(); break;
      case 'regkey': S.regf = { ...S.regf, key: S.regf?.key === b.dataset.v ? '' : b.dataset.v }; render(); break;
      case 'regtodo': S.regf = { ...S.regf, todo: !S.regf?.todo }; render(); break;
      case 'todoDel': saveDesk({ todos: (S.desk?.todos || []).filter((_, i) => i !== Number(b.dataset.i)) }); break;
      case 'briefnow':
        S.briefing = true; render();
        try { await httpsCallable(fns, 'briefNow', { timeout: 300000 })(); toast('브리핑을 새로 받았어요'); } catch (err) { toast(err.message || '브리핑을 받지 못했어요'); }
        S.briefing = false; render();
        break;
      case 'sites': S.sites = null; render(); break;
      case 'cap': openCapture(cap); break;
      case 'staffpick': openStaffPick(route()); break;
      case 'pickcard': S.pick[route()] = id; render(); break;
      case 'addLinks': await addLinks(); break;
      case 'reload': location.reload(); break;
      // 강력 새로고침: 화면 파일을 브라우저 저장본 말고 새로 받아 둔 뒤 다시 열어요 (방금 올린 새 화면이 바로 보이게)
      case 'hardReload': {
        b.disabled = true;
        const files = ['./', 'index.html', 'app.js', 'building3d.js', 'rooms.js', 'style.css'];
        await Promise.allSettled(files.map((f) => fetch(f, { cache: 'reload' })));
        location.reload();
        break;
      }
      // 카드 창에서 그 방으로: 고른 카드가 보이게 (두 칸 방은 그 카드를 고르고, 교과 거르기는 풀어요)
      case 'gocard': { const c = cardById(id); if (!c) break; S.pick[c.room] = id; S.subj = ''; dlg.close(); location.hash = c.room; break; }
      case 'reread': if (dlg.open) dlg.close(); await reread(cap); break;
      case 'delcap': await deleteCapture(cap); break;
      case 'close': dlg.close(); break;
      case 'clearq': S.q = ''; $('#search').value = ''; setTimeout(render); break;
      default: break;
    }
  } catch (err) {
    toast(`처리하지 못했어요 (${err.code || err.message})`);
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.matches('select[data-act=move]')) {
    updateDoc(doc(db, dbPath(`cards/${t.dataset.id}`)), { room: t.value }).then(() => toast(`${roomName(t.value)}(으)로 보냈어요`));
  } else if (t.matches('input[data-act=step]')) {
    const steps = taskSteps().map((s, i) => (i === Number(t.dataset.i) ? { ...s, done: t.checked } : s));
    saveTask({ steps });
  } else if (t.matches('input[data-act=todo]')) {
    saveDesk({ todos: (S.desk?.todos || []).map((x, i) => (i === Number(t.dataset.i) ? { ...x, done: t.checked } : x)) });
  } else if (t.id === 'deskLeft') saveDesk({ creditLeft: t.value === '' ? null : Number(t.value), creditAsOf: $('#deskAsOf')?.value || todayStr() });
  else if (t.id === 'deskAsOf') saveDesk({ creditAsOf: t.value });
  else if (t.id === 'deskExp') saveDesk({ creditExpires: t.value });
  else if (t.id === 'deskMemo') saveDesk({ memo: t.value });
  else if (t.id === 'regQ') { S.regf = { ...S.regf, q: t.value.trim() }; t.blur(); render(); }
  else if (t.id === 'taskTitle') saveTask({ title: t.value.trim() });
  else if (t.id === 'taskDue') saveTask({ due: t.value });
  else if (t.id === 'taskNotes') saveTask({ notes: t.value });
  else if (t.id === 'fileInput') { upload(t.files); t.value = ''; }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'pendLink') S.pending.link = e.target.value.trim();
  if (e.target.id === 'pendMemo') S.pending.memo = e.target.value.trim();
  if (e.target.id === 'search') { S.q = e.target.value.trim(); render(); }
});

document.addEventListener('focusout', () => {
  if (S.dirty) setTimeout(() => { S.dirty = false; render(); });
});

// ---------- 엘리베이터: 다른 층으로 가면 문이 닫히고, 층 표시가 바뀌고, 문이 열려요 ----------
let lastRoute = route();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 학교 컴퓨터처럼 Windows '애니메이션 효과'가 꺼져 있어도 엘리베이터는 움직여요 (움직임이 이 앱의 핵심이라서)
async function ride(from, to) {
  S.riding = true;
  $('.lift')?.classList.add('shut');
  await sleep(400);
  const i = FLOORS.indexOf(from), j = FLOORS.indexOf(to), step = j > i ? 1 : -1;
  const disp = $('.ev-disp');
  for (let n = i + step; disp && n !== j + step; n += step) {
    disp.innerHTML = `${step < 0 ? '▲' : '▼'} ${esc(FLOORS[n].floor)}<small>${esc(FLOORS[n].name)}</small>`;
    await sleep(260);
  }
  S.riding = false;
  S.doorsShut = true;
  render();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => {
  S.subj = '';
  const next = route();
  const a = ROOMS[lastRoute] ? floorOf(lastRoute) : null, b = ROOMS[next] ? floorOf(next) : null;
  lastRoute = next;
  if (B3 && a && b && a !== b && !S.q && !S.riding) { ride(a, b); return; }
  if (B3 && !a && b) S.doorsShut = true; // 첫 화면에서 들어올 때도 문이 열리며
  render();
  window.scrollTo(0, 0);
});

// 화면 어디든 끌어다 놓기 / 붙여넣기
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { if (S.teacher && e.dataTransfer?.types.includes('Files')) { dragDepth++; $('#dropOverlay').hidden = false; } });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#dropOverlay').hidden = true; } });
window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  if (!e.dataTransfer?.files.length) return;
  e.preventDefault();
  dragDepth = 0;
  $('#dropOverlay').hidden = true;
  if (S.teacher) dropFiles(e.dataTransfer).then((files) => (files.length ? upload(files) : toast('폴더 안에 넣을 파일이 없어요'))).catch((err) => toast(`폴더를 열지 못했어요 (${err.message || err})`));
});
// 계기판 할 일: 적고 Enter
document.addEventListener('keydown', (e) => {
  if (e.target.id !== 'todoNew' || e.key !== 'Enter' || e.isComposing) return;
  const t = e.target.value.trim();
  if (!t) return;
  e.target.value = '';
  saveDesk({ todos: [...(S.desk?.todos || []), { t, done: false }] });
});
document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/') || isPdf(f) || isSheet(f) || isDoc(f));
  if (!S.teacher || !files.length) return;
  e.preventDefault();
  upload(files);
});

start().catch((e) => {
  $('#view').innerHTML = `<p class="empty">Firebase 설정을 읽지 못했어요: ${esc(e.message)}</p>`;
});
