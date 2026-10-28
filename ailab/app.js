// AI Lab — 첫 화면은 건물 단면(A), 층 안은 엘리베이터(B), 1층 접수처는 작업 라인(D)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs, getDoc,
  serverTimestamp, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';
import { APP_NAME, ROOMS, FLOORS } from './rooms.js';

const REGION = 'asia-northeast3';
const DEFAULT_STEPS = ['주제 정하기', '참고 지도안 고르기', '내 지도안 쓰기', '수업 실행', '성찰 정리·제출'];

// riding = 엘리베이터가 움직이는 중(그동안은 화면을 다시 그리지 않아요), doorsShut = 다음 화면을 문 닫힌 채로 그리고 열기
const S = { user: null, teacher: false, cards: [], captures: [], task: null, building: null, uploading: new Map(), q: '', subj: '', pending: { link: '', memo: '' }, dirty: false, riding: false, doorsShut: false, focused: '' };
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
    if (S.building) m.setState(S.building);
    render();
  }).catch(() => { B3 = false; render(); });
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
    render();
  }, denied));
  unsubs.push(onSnapshot(doc(db, dbPath('meta/task')), (s) => {
    S.task = s.exists() ? s.data() : null;
    render();
  }, denied));
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
    if (band) $('.b3d-slot').append(b3d); // 층 화면: 위쪽 엘리베이터 창 안으로
    B3.setMode(band ? 'band' : 'home');
    B3.setVisible(home3d || band);
    if (home3d) { B3.setTop(isGuest() ? guestSide() : homeSide()); S.focused = ''; }
    if (band && S.focused !== r) { B3.focusRoom(r, S.doorsShut || !S.focused); S.focused = r; }
  }
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
  return `<div class="home">
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
        <button class="btn primary" data-act="upload">사진 넣기</button>
      </div>
      <ul class="queue">
        <li>${reading ? '<span class="spin"></span>' : '<span class="pip" style="background:var(--ok)"></span>'}AI가 읽는 중 ${reading}장</li>
        <li><span class="pip"></span><a href="#lobby">확인 기다리는 카드 ${review}장</a></li>
      </ul>
      <small>캡쳐를 화면 어디에든 끌어다 놓거나 Ctrl+V로 붙여 넣어도 바로 들어가요.</small>
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
function floorView(k) {
  const f = floorOf(k);
  const floorAlert = (x) => x.rooms.some((r) => roomBadge(r).hot);
  return `<div class="mB">
    <nav class="ev" aria-label="엘리베이터">
      <a class="ev-home" href="#">← 건물 전체</a>
      <div class="ev-disp">${esc(f.floor)}<small>${esc(f.name)}</small></div>
      <div class="ev-btns">${FLOORS.map((x) => `<a class="ev-btn ${x === f ? 'on' : ''}" href="#${x.rooms[0]}"><b>${esc(x.floor)}${floorAlert(x) ? '<i></i>' : ''}</b><span>${esc(x.name)}</span></a>`).join('')}</div>
    </nav>
    <section class="flr">
      <div class="flr-h"><h2>${esc(f.name)}</h2></div>
      ${B3 !== false ? `<div class="lift ${S.doorsShut ? 'shut' : ''}"><div class="b3d-slot"></div><div class="lift-doors" aria-hidden="true"><i></i><i></i></div></div>` : ''}
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
  if (k === 'boss') return bossView(false);
  if (k === 'lobby') return lobbyView();
  if (k === 'archive') return archiveView();
  const r = ROOMS[k];
  const head = r.task ? taskPanel() : '';
  const list = cardsIn(k);
  if (!list.length) return head + emptyRoom(k);
  const view = { link: linksView, lesson: lessonsView, plan: plansView }[r.view] || eventsView;
  return head + view(list, k);
}

// 창고: 아직 쓰지 않는 칸. 새 방이 필요하면 rooms.js 에서 이 자리를 방으로 바꿔요
function storeRoom(k) {
  return `<div class="empty"><p>${esc(roomName(k))}는 아직 비어 있어요. 상자만 쌓여 있어요.</p>
    <p>새 방이 필요해지면 이 자리를 방으로 바꿔 쓸 수 있어요. (rooms.js 에서 창고 이름을 새 방으로 바꾸기)</p></div>`;
}

function emptyRoom(k) {
  return `<div class="empty"><p>아직 ${esc(roomName(k))}에 자료가 없어요. 1층 접수처에 캡쳐를 넣으면 ${esc(ROOMS[k].role || '직원')}이(가) 읽고 여기로 가져와요.</p><button class="btn primary" data-act="upload">사진 넣기</button></div>`;
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
const DUP = new Set(['연수명', '수업 제목', '과제명', '수업 주제', '사이트 이름', '일시', '장소', '교과']);
const extraFields = (c) => (c.fields || []).filter((f) => f.value && !DUP.has(f.label));
function actions(c, more = '') {
  return `<div class="acts">
    ${c.status === 'review' ? `<button class="yes" data-act="confirm" data-id="${c.id}">맞아요</button>` : ''}
    <button data-act="edit" data-id="${c.id}">고치기</button>
    <button class="src-btn" data-act="edit" data-id="${c.id}"><img data-path="${esc(c.storagePath)}" alt="">원본</button>
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

// event: 연수·과제처럼 날짜·장소·교시가 중요한 방
function eventCard(c) {
  const when = whenText(c);
  return `<article class="card ${isPast(c) ? 'past' : ''}">
    <div class="row">${ddChip(c.date, c.end_date)}${reviewTag(c)}${c.kind ? `<span class="chip">${esc(c.kind)}</span>` : ''}</div>
    <h3><span class="${uns(c, 'title')}">${esc(c.title || '(제목 없음)')}</span></h3>
    ${c.summary ? `<p class="sum">${esc(c.summary)}</p>` : ''}
    <dl class="kv">
      ${when ? `<dt>일시</dt><dd><span class="${uns(c, 'date') || uns(c, 'time')}">${esc(when)}</span></dd>` : ''}
      ${c.place ? `<dt>장소</dt><dd><span class="${uns(c, 'place')}">${esc(c.place)}</span></dd>` : ''}
      ${extraFields(c).map((f) => `<dt>${esc(f.label)}</dt><dd><span class="${f.unsure ? 'unsure' : ''}">${esc(f.value)}</span></dd>`).join('')}
    </dl>
    ${periodsTable(c)}
    ${actions(c)}
  </article>`;
}
function eventsView(list) {
  const { live, past } = sortCards(list);
  return withPast(live, past, eventCard, (h) => `<div class="grid2">${h}</div>`);
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
const linksView = (list) => `<div class="tiles">${list.map(linkCard).join('')}</div>`;

// lesson: 수업 공개
function lessonRow(c, k) {
  const [, m, d] = isDate(c.date) ? c.date.split('-').map(Number) : [];
  const wd = isDate(c.date) ? fmtDate(c.date).slice(-2, -1) : '';
  const period = field(c, '교시') || c.time;
  const where = [field(c, '학교'), c.place || field(c, '장소'), field(c, '학년')].filter(Boolean).join(' · ');
  return `<li class="lesson ${isPast(c) ? 'past' : ''}">
    <span class="date ${uns(c, 'date')}">${m ? `<b>${m}.${d}</b>${esc(wd)} ${esc(period)}` : '<b>?</b>날짜 없음'}</span>
    <div class="body">
      <div class="row">${reviewTag(c)}${ddChip(c.date)}</div>
      <h3>${esc(c.title || field(c, '수업 제목') || '(제목 없음)')}</h3>
      ${where ? `<small>${esc(where)}</small>` : ''}
      ${c.moral_link ? `<span class="link-tip">도덕과 연결: ${esc(c.moral_link)}</span>` : ''}
      ${actions(c)}
    </div>
    <span class="subj ${k === 'moral' ? 'moral' : 'other'} ${uns(c, 'subject')}">${esc(c.subject || field(c, '교과') || (k === 'moral' ? '도덕' : '기타'))}</span>
  </li>`;
}
function lessonsView(list, k) {
  const subjects = [...new Set(list.map((c) => c.subject || field(c, '교과')).filter(Boolean))];
  const filtered = S.subj && subjects.includes(S.subj) ? list.filter((c) => (c.subject || field(c, '교과')) === S.subj) : list;
  const chips = subjects.length > 1 ? `<div class="row">${['', ...subjects].map((s) => `<button class="chipbtn ${s === (subjects.includes(S.subj) ? S.subj : '') ? 'on' : ''}" data-act="subj" data-v="${esc(s)}">${esc(s || '전체')}</button>`).join('')}</div>` : '';
  const { live, past } = sortCards(filtered);
  return chips + withPast(live, past, (c) => lessonRow(c, k), (h) => `<ul class="lessons">${h}</ul>`);
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
function bossView(compact) {
  const up = upcoming().slice(0, compact ? 6 : 30);
  const month = todayStr().slice(0, 7);
  const lessons = S.cards.filter((c) => (c.room === 'moral' || c.room === 'others') && (c.date || '').startsWith(month)).length;
  const review = S.cards.filter((c) => c.status === 'review').length;
  const recent = S.cards.filter((c) => !isUnsorted(c)).slice(0, 6);
  return `<div class="stats">
      <a href="#lobby"><b>${review}</b><small>확인 대기</small></a>
      <a href="#moral"><b>${lessons}</b><small>이번 달 수업 공개</small></a>
      <a href="#archive"><b>${S.cards.length}</b><small>정리된 카드</small></a>
    </div>
    ${up.length ? `<ul class="agenda">${up.map((c) => `<li><a href="#${c.room}">${ddChip(c.date, c.end_date)}<div><b>${esc(c.title)}</b><small>${esc([fmtDate(c.date), c.time, roomName(c.room), c.place].filter(Boolean).join(' · '))}</small></div></a></li>`).join('')}</ul>`
      : '<p class="empty">날짜가 있는 자료가 들어오면 여기에 D-day 순으로 모여요.</p>'}
    ${!compact && recent.length ? `<h3>방금 정리된 자료</h3><ul class="agenda">${recent.map((c) => `<li><a href="#${c.room}"><span class="chip">${esc(roomName(c.room))}</span><div><b>${esc(c.title)}</b><small>${esc(c.summary || '')}</small></div></a></li>`).join('')}</ul>` : ''}`;
}

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
      <label class="drop" for="fileInput"><span class="doc"></span><b>캡쳐를 여기에 넣기</b><small>눌러서 고르기 · 화면 어디든 끌어다 놓기 · Ctrl+V 붙여넣기<br>넣는 순간 AI가 읽기 시작해요</small></label>
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
    <div class="belt-wrap ${moving ? 'run' : ''}" aria-hidden="true"><div class="belt"></div>${'<span class="belt-item"><span class="doc"></span></span>'.repeat(Math.min(4, moving))}</div>
    ${errors.length ? `<div class="errs">${errors.map((c) => `<div class="err"><img class="qthumb" data-path="${esc(c.storagePath)}" alt=""><div><b>읽지 못한 사진 · ${esc(c.name || '')}</b><small>${esc(c.error || '')}</small></div><button data-act="reread" data-cap="${c.id}">다시 읽기</button><button data-act="delcap" data-cap="${c.id}">지우기</button></div>`).join('')}</div>` : ''}
    <div class="q-h"><span class="pip"></span>확인을 기다리는 카드 ${review.length}장 · 노란 칸만 보면 돼요
      ${review.filter((c) => !isUnsorted(c)).length > 1 ? '<button class="chipbtn" data-act="confirmAll">방이 정해진 카드 모두 맞아요</button>' : ''}</div>
    ${review.length ? `<div class="qcards">${review.map(reviewCard).join('')}</div>` : '<p class="empty">지금은 확인할 카드가 없어요.</p>'}
  </div>`;
}
function roomOptions(current) {
  const ai = Object.entries(ROOMS).filter(([, r]) => r.ai);
  return `${!ROOMS[current]?.ai ? '<option value="unknown" selected>방을 골라 주세요</option>' : ''}${ai.map(([k, r]) => `<option value="${k}" ${k === current ? 'selected' : ''}>${esc(floorOf(k).floor)} ${esc(r.name)}</option>`).join('')}`;
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
    <div class="qc-top"><img class="qthumb" data-act="edit" data-id="${c.id}" data-path="${esc(c.storagePath)}" alt="원본 보기">
      <div><b>${esc(c.kind || '자료')}</b><select data-act="move" data-id="${c.id}" aria-label="보낼 방">${roomOptions(c.room)}</select></div></div>
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
  if (!S.captures.length) return '<p class="empty">넣은 캡쳐 원본이 여기에 날짜순으로 쌓여요.</p>';
  const label = { reading: '읽는 중', done: '정리됨', error: '읽지 못함' };
  return `<div class="arch">${S.captures.map((c) => `<button class="ph" data-act="cap" data-cap="${c.id}">
    <img data-path="${esc(c.storagePath)}" alt="" loading="lazy">
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
const urlCache = new Map();
function hydrateImages(root = document) {
  root.querySelectorAll('img[data-path]:not([src])').forEach(async (img) => {
    const p = img.dataset.path;
    if (!p) return;
    try {
      if (!urlCache.has(p)) urlCache.set(p, getDownloadURL(ref(storage, p)));
      img.src = await urlCache.get(p);
    } catch {
      urlCache.delete(p);
      img.alt = '원본 없음';
    }
  });
}

// ---------- 창: 카드 고치기 / 원본 보기 ----------
const dlg = $('#dlg');

function openCard(id) {
  const c = cardById(id);
  if (!c) return;
  dlg.innerHTML = `<form method="dialog" class="dlg" id="cardForm" data-id="${c.id}">
    <div class="dlg-img"><img data-path="${esc(c.storagePath)}" alt="원본 캡쳐"></div>
    <div class="dlg-form">
      <h2>${c.status === 'review' ? '카드 확인하기' : '카드 고치기'}</h2>
      <label>보낼 방<select name="room">${roomOptions(c.room)}</select></label>
      <label>제목<input name="title" value="${esc(c.title)}"></label>
      <div class="two"><label>날짜<input type="date" name="date" value="${esc(c.date)}"></label><label>끝나는 날<input type="date" name="end_date" value="${esc(c.end_date)}"></label></div>
      <div class="two"><label>시간·교시<input name="time" value="${esc(c.time)}"></label><label>장소<input name="place" value="${esc(c.place)}"></label></div>
      <div class="two"><label>교과<input name="subject" value="${esc(c.subject)}"></label><label>링크<input name="url" value="${esc(c.url)}"></label></div>
      <label>한 줄 요약<textarea name="summary" rows="2">${esc(c.summary)}</textarea></label>
      ${c.fields?.length ? `<fieldset><legend>세부 항목</legend>${c.fields.map((f, i) => `<label>${esc(f.label)}${f.unsure ? ' <span class="unsure">확인 필요</span>' : ''}<input name="f_${i}" value="${esc(f.value)}"></label>`).join('')}</fieldset>` : ''}
      <label>교시·수업 흐름 <small>한 줄에 하나씩 “1교시 | 내용”</small><textarea name="periods" rows="4">${esc((c.periods || []).map((p) => `${p.label} | ${p.content}`).join('\n'))}</textarea></label>
      <div class="dlg-acts">
        <button type="button" data-act="del" data-id="${c.id}">버리기</button>
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
  if (ROOMS[room]?.ai) Object.assign(data, { status: 'done', confirmedAt: serverTimestamp() });
  await updateDoc(doc(db, dbPath(`cards/${c.id}`)), data);
  toast(ROOMS[room]?.ai ? `${roomName(room)}에 보관했어요` : '저장했어요. 방을 고르면 보관돼요.');
}

function openCapture(id) {
  const cap = S.captures.find((c) => c.id === id);
  if (!cap) return;
  const cards = S.cards.filter((c) => c.captureId === id);
  dlg.innerHTML = `<form method="dialog" class="dlg">
    <div class="dlg-img"><img data-path="${esc(cap.storagePath)}" alt="원본 캡쳐"></div>
    <div class="dlg-form">
      <h2>원본 캡쳐</h2>
      <small>${esc(cap.name || '')} · ${esc(tsDate(cap.createdAt))}에 넣음${cap.note ? ` · ${esc(cap.note)}` : ''}</small>
      ${cap.link ? `<small>함께 적은 링크: ${esc(cap.link)}</small>` : ''}
      ${cap.memo ? `<small>메모: ${esc(cap.memo)}</small>` : ''}
      ${cap.error ? `<p class="unsure">${esc(cap.error)}</p>` : ''}
      <h3>이 사진에서 나온 카드 ${cards.length}</h3>
      <div class="dlg-list">${cards.map((c) => `<a href="#${esc(c.room)}" data-act="close">${esc(floorOf(c.room).floor)} ${esc(roomName(c.room))} · ${esc(c.title)}${c.status === 'review' ? ' (확인 전)' : ''}</a>`).join('') || '<small>아직 없어요.</small>'}</div>
      <div class="dlg-acts">
        <button type="button" data-act="delcap" data-cap="${cap.id}">사진과 카드 모두 지우기</button>
        <button type="button" data-act="reread" data-cap="${cap.id}">다시 읽기</button>
        <button value="cancel">닫기</button>
      </div>
    </div>
  </form>`;
  hydrateImages(dlg);
  dlg.showModal();
}

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

async function upload(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/'));
  if (!files.length) { toast('사진(이미지) 파일만 넣을 수 있어요'); return; }
  const { link, memo } = S.pending;
  S.pending = { link: '', memo: '' };
  toast(`1층 접수처에 ${files.length}장 들어왔어요. 바로 읽기 시작해요.`);
  if (S.q) { S.q = ''; $('#search').value = ''; }
  if (route() !== 'lobby') location.hash = 'lobby';
  await Promise.all(files.map((f) => uploadOne(f, link, memo)));
}

async function uploadOne(file, link, memo) {
  const capRef = doc(collection(db, dbPath('captures')));
  S.uploading.set(capRef.id, file.name);
  render();
  try {
    const blob = await prepare(file);
    const path = `ailab/captures/${capRef.id}.${OK_TYPES[blob.type] || 'img'}`;
    await setDoc(capRef, { status: 'reading', name: file.name || '붙여넣은 이미지', storagePath: path, link, memo, createdAt: serverTimestamp() });
    await uploadBytes(ref(storage, path), blob, { contentType: blob.type || 'image/jpeg' });
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
  if (!cap || !confirm('이 사진과 사진에서 나온 카드를 모두 지울까요? 되돌릴 수 없어요.')) return;
  const cards = await getDocs(query(collection(db, dbPath('cards')), where('captureId', '==', capId)));
  const batch = writeBatch(db);
  cards.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, dbPath(`captures/${capId}`)));
  await batch.commit();
  if (cap.storagePath) await deleteObject(ref(storage, cap.storagePath)).catch(() => {});
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
      case 'cap': openCapture(cap); break;
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
  } else if (t.id === 'taskTitle') saveTask({ title: t.value.trim() });
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
  if (S.teacher) upload(e.dataTransfer.files);
});
document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
  if (!S.teacher || !files.length) return;
  e.preventDefault();
  upload(files);
});

start().catch((e) => {
  $('#view').innerHTML = `<p class="empty">Firebase 설정을 읽지 못했어요: ${esc(e.message)}</p>`;
});
