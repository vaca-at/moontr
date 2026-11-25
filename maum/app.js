/* ============================================================
   🌿 마음한편 웹 (moontr.site/maum) — 2026-11-25 1차
   · 아이폰 앱과 같은 계정 · 같은 기록: Firestore maum_users/{uid}/{묶음}/{기록 번호} 에 { j: 기록(JSON 글), u: 고친 때 }
     묶음 = checkins(마음 기록) · practices(활동 · 쓴 글 · AI 기록) · found(숨은 마음) · tests(테스트) · members(가족 · 학생) · minds(예전 마음 결) · settings/me(별명 · 모드 · 오늘 해 볼 것 …)
     기록 모양은 앱 CloudSync.swift 와 같아요 (날짜는 1970년부터 '초'). 앱이 열리면 웹에서 남긴 것을 받아 가요.
   · 로그인: 이름 붙은 파이어베이스 앱 'maum' (관리자 로그인과 섞이지 않게) — 구글 · 카카오 · Apple
   · AI 마음 티쳐: moontr-auth 서버 POST /maum (앱과 같은 서버 · 같은 하루 횟수)
   · 내용(테스트 문항 · 도감 · 문장 · 도움 받을 곳)은 tests.js · content.js (앱 Swift 파일에서 옮긴 것)
   ============================================================ */
(() => {
const FB = { apiKey: "AIzaSyA3CxawUPIfGeBWyffsNbCSM3ymjKHLH6o", authDomain: "moon-d528d.firebaseapp.com", projectId: "moon-d528d",
  messagingSenderId: "126636401536", appId: "1:126636401536:web:25b8a8296ec42b86f99765" };
const AI_URL = 'https://moontr-auth.bellachord.workers.dev/maum';
const COLS = ['checkins', 'practices', 'found', 'tests', 'members', 'minds'];
const C = window.MaumContent || {}, T = window.MaumTests || null;
const $ = (s, el = document) => el.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get(k, d) { try { const v = localStorage.getItem('maum.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
             set(k, v) { try { localStorage.setItem('maum.' + k, JSON.stringify(v)); } catch {} } };
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2)).toUpperCase();
const sec = d => Math.round((d instanceof Date ? d.getTime() : d) / 1000 * 1000) / 1000;   // 앱처럼 '초' (소수 셋째 자리)
const dayStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromSec = s => new Date((+s || 0) * 1000);
const sortKeys = o => Array.isArray(o) ? o.map(sortKeys) : (o && typeof o === 'object') ? Object.keys(o).sort().reduce((a, k) => (a[k] = sortKeys(o[k]), a), {}) : o;
const toast = t => { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 2200); };

/* ── 상태 ── */
const S = { user: null, set: {}, col: Object.fromEntries(COLS.map(c => [c, {}])), loaded: new Set(), view: 'home', sub: {} };
let app, auth, db, unsub = [];
const list = c => Object.entries(S.col[c]).map(([key, v]) => ({ key, ...v }));
const checkins = () => list('checkins').sort((a, b) => b.at - a.at);
const practices = () => list('practices').sort((a, b) => b.at - a.at);
const tests = () => list('tests').sort((a, b) => b.at - a.at);
const members = () => list('members').sort((a, b) => (a.order || 0) - (b.order || 0));
const mode = () => S.set.mode || 'all';

/* ── 저장 (앱과 같은 칸 · 같은 모양) ── */
const ref = (col, key) => db.doc(`maum_users/${S.user.uid}/${col}/${key}`);
async function put(col, key, rec){
  S.col[col][key] = rec; render();
  await ref(col, key).set({ j: JSON.stringify(sortKeys(rec)), u: firebase.firestore.FieldValue.serverTimestamp() });
}
async function del(col, key){ delete S.col[col][key]; render(); await ref(col, key).delete(); }
async function saveSet(patch){
  S.set = { ...S.set, ...patch }; render();
  await ref('settings', 'me').set({ j: JSON.stringify(sortKeys(S.set)), u: firebase.firestore.FieldValue.serverTimestamp() });
}
function listen(uid){
  unsub.forEach(f => f()); unsub = []; S.loaded.clear();
  for (const c of COLS) unsub.push(db.collection(`maum_users/${uid}/${c}`).onSnapshot(snap => {
    const o = {}; snap.forEach(d => { try { o[d.id] = JSON.parse(d.data().j); } catch {} }); S.col[c] = o; S.loaded.add(c); render();
  }, e => console.warn(c, e.code)));
  unsub.push(db.doc(`maum_users/${uid}/settings/me`).onSnapshot(d => {
    try { S.set = d.exists ? JSON.parse(d.data().j) : {}; } catch { S.set = {}; }
    S.loaded.add('settings'); render();
  }, e => console.warn('settings', e.code)));
}

/* ── 숫자 (앱 Stats 와 같게) ── */
function lastDays(n = 7){
  const by = {}; for (const c of checkins()) by[ymd(fromSec(c.day))] = by[ymd(fromSec(c.day))] || c;
  return [...Array(n)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return by[ymd(d)] || null; });
}
function streak(){
  const set = new Set(checkins().map(c => ymd(fromSec(c.day)))); let d = new Date(), n = 0;
  if (!set.has(ymd(d))) d.setDate(d.getDate() - 1);
  while (set.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const todayCheckin = () => checkins().find(c => ymd(fromSec(c.day)) === ymd());
const top = a => (a || []).reduce((bi, v, i, arr) => v > arr[bi] ? i : bi, 0);
const myTest = k => tests().find(t => t.kind === k && !t.who);
const weekCount = kinds => practices().filter(p => kinds.includes(p.kind) && fromSec(p.day) >= dayStart(new Date(Date.now() - 6 * 864e5))).length;

/* ── 마음 날씨 그림 (앱 Mood: 5 맑음 · 4 구름 사이 해 · 3 흐림 · 2 비 · 1 소나기) ── */
const MOOD = { 5: ['맑음', '#C9765E'], 4: ['구름 사이 해', '#D9A28C'], 3: ['흐림', '#9C978E'], 2: ['비', '#6F8FB3'], 1: ['소나기', '#3B5A85'] };
const moodName = m => (C.checkin && C.checkin.moods && C.checkin.moods[m] && C.checkin.moods[m].weatherName) || (MOOD[m] || [''])[0];
function wx(m){
  const c = (MOOD[m] || MOOD[3])[1];
  const sun = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#E7A13F"/>`;
  const cloud = f => `<path d="M7 18.5h10.2a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8 1.4A3.3 3.3 0 0 0 7 18.5z" fill="${f}"/>`;
  const drops = `<g stroke="${c}" stroke-width="1.8" stroke-linecap="round"><path d="M9 20.5l-.8 2M13 20.5l-.8 2M17 20.5l-.8 2"/></g>`;
  const body = m == 5 ? `${sun(12, 12, 5)}<g stroke="#E7A13F" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/></g>`
    : m == 4 ? `${sun(15.5, 8.5, 3.8)}${cloud(c)}` : m == 3 ? cloud(c) : m == 2 ? `<g transform="translate(0 -3)">${cloud(c)}</g>${drops}`
    : `<g transform="translate(0 -3)">${cloud(c)}</g><path d="M12.6 15.6 10.4 19.4h2.2L11.4 22.6l3.4-4.4h-2.3l1.4-2.6z" fill="#E7A13F"/>`;
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

/* ── 로그인 ── */
const IN_APP = /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(inapp|DaumApps/i.test(navigator.userAgent);
async function login(kind){
  if (IN_APP) return toast('카톡 같은 앱 안에서는 로그인이 막혀요. ⋯ 메뉴에서 [Safari로 열기]를 눌러 주세요');
  const p = kind === 'google' ? new firebase.auth.GoogleAuthProvider() : new firebase.auth.OAuthProvider(kind === 'kakao' ? 'oidc.kakao' : 'apple.com');
  if (kind === 'google') p.setCustomParameters({ prompt: 'select_account' });
  try { await auth.signInWithPopup(p); }
  catch (e) {
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return auth.signInWithRedirect(p);
    if (e.code === 'auth/account-exists-with-different-credential') return toast('이 이메일은 다른 방법으로 가입했어요. 처음 가입한 방법으로 로그인해 주세요');
    if (kind === 'apple') return toast('웹에서는 Apple 로그인이 아직 안 돼요. 앱의 내 계정 › 로그인 방법에서 구글 · 카카오를 이어 주세요');
    toast('로그인하지 못했어요 (' + (e.code || e.message) + ')');
  }
}

/* ── AI 마음 티쳐 ── */
async function ai(task, payload){
  if (S.demo) return { error: '둘러보기에서는 AI 마음 티쳐를 쓸 수 없어요. 로그인하면 바로 써요.' };
  try {
    const idToken = await S.user.getIdToken();
    const care = C.safety && C.safety.needsCare ? !!C.safety.needsCare(checkins().map(c => ({ day: ymd(fromSec(c.day)), at: c.at, mood: c.mood, reasons: c.reasons })), riskDays()) : false;
    const r = await fetch(AI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, idToken, task, mode: mode(), care }) });
    const j = await r.json(); if (j.off) return null; return j;
  } catch { return null; }
}
const aiStats = () => ({ week: lastDays(7).map(c => c ? c.mood : 0), moves: weekCount(['breath', 'body', 'ground', 'face', 'neck', 'stretch', 'hands', 'eyes', 'senses', 'heart']), streak: streak(), types: myTypes() });
function myTypes(){
  const out = []; if (!T) return out;
  for (const k of ['mind', 'temper', 'type16']) { const t = myTest(k); if (!t) continue; try { const l = T.line ? T.line(k, t.scores, t.code) : ''; if (l) out.push(String(l).slice(0, 30)); } catch {} }
  return out;
}
const askConsent = () => new Promise(ok => {
  if (ls.get('aiConsent', false)) return ok(true);
  sheet(`<b style="font-size:18px">AI 마음 티쳐에게 보낼까요?</b><p class="sub">적은 글은 답을 만들기 위해 Anthropic(Claude)의 AI로 보내져요. 마음한편 서버에는 저장하지 않아요. 이름 · 연락처 같은 개인 정보는 쓰지 말아 주세요.</p>
    <div class="row"><button class="btn main" id="cOk">보내기</button><button class="btn" id="cNo">그만두기</button></div>`);
  $('#cOk').onclick = () => { ls.set('aiConsent', true); closeSheet(); ok(true); };
  $('#cNo').onclick = () => { closeSheet(); ok(false); };
});
/* 위험한 말이면 AI 로 보내지 않고 마음 지킴 · 117 화면 */
const riskDays = () => ({ riskDays: ls.get('riskDays', []), hurtDays: ls.get('hurtDays', []), softDays: ls.get('softDays', []) });
const markDay = k => { const a = ls.get(k, []); a.push(Date.now()); ls.set(k, a.slice(-60)); };
function safetyGate(text){
  const k = C.safety && C.safety.check ? C.safety.check(text) : null;
  if (k === 'life') markDay('riskDays'); if (k === 'hurt') markDay('hurtDays');
  if (C.safety && C.safety.soft && C.safety.soft(text)) markDay('softDays');
  if (k === 'life') { showHelp('life'); return false; }
  if (k === 'hurt') { showHelp('hurt'); return false; }
  return true;
}
async function aiLog(t, q, fields){
  const key = uuid(), now = new Date(), d = { t, q }; for (const [k, v] of Object.entries(fields || {})) if (v) d[k] = String(v);
  await put('practices', key, { kind: 'ai', at: sec(now), day: sec(dayStart(now)), text: JSON.stringify(sortKeys(d)) });
}

/* ── 시트 ── */
function sheet(html){ const s = $('#sheet'); s.innerHTML = `<div class="in fade-in"><button class="x" aria-label="닫기">✕</button>${html}</div>`; s.hidden = false; $('.x', s).onclick = closeSheet; s.onclick = e => { if (e.target === s) closeSheet(); }; }
function closeSheet(){ $('#sheet').hidden = true; $('#sheet').innerHTML = ''; }

/* ── 도움 받을 곳 ── */
/* 도움 받을 곳 (content.js: 학생 = 1388 · 109 · Wee클래스 · Wee센터 · 청소년상담복지센터 / 교사 = 교사 자신의 마음 / 어른) */
function helpLines(){
  const L = C.safety && C.safety.helpLines ? C.safety.helpLines(mode()) : [];
  return L.length ? L : [{ name: '자살예방상담 109', detail: '24시간', tel: '109' }, { name: '청소년상담 1388', detail: '24시간', tel: '1388' }];
}
const lineHTML = h => { const href = h.tel ? `tel:${h.tel}` : h.sms ? `sms:${h.sms}` : h.web || '';
  return `${href ? `<a href="${esc(href)}"${h.web && !h.tel && !h.sms ? ' target="_blank" rel="noopener"' : ''}>` : '<div class="line">'}<div><b>${esc(h.name)}</b><div class="sub small">${esc(h.detail || '')}</div></div><span class="num">${esc(h.tel || h.sms || (h.web ? '›' : ''))}</span>${href ? '</a>' : '</div>'}`; };
function showHelp(kind){
  if (kind === 'hurt' && C.safety && C.safety.hurtView) {
    const H = C.safety.hurtView(mode());
    return sheet(`<b class="unz" style="font-size:28px">${esc(H.heading)}</b><p>${esc(H.body)}</p>
      <div class="help">${lineHTML({ name: H.big117.title, detail: H.big117.sub, tel: H.big117.tel })}${(H.rows || []).map(lineHTML).join('')}</div>
      ${H.evidence ? `<div class="box"><div class="eyebrow">${esc(H.evidence.title)}</div><p style="margin:6px 0 0">${esc(H.evidence.body)}</p></div>` : ''}`);
  }
  const V = (C.safety && C.safety.safetyView) || {};
  const head = kind === 'life' ? (V.heading || '많이 힘든 이야기 같아요. 혼자 견디지 않아도 돼요.') : ((C.safety && C.safety.helpView && C.safety.helpView.heading) || '힘들 때 도움 받을 곳');
  const body = kind === 'life' ? (V.body || '지금 바로 이야기할 수 있는 곳이 있어요.') : ((C.safety && C.safety.helpView && C.safety.helpView.note) || '');
  const emer = kind === 'life' && V.emergency ? V.emergency.map(e => lineHTML({ name: e.label, tel: e.tel })).join('') : '';
  sheet(`<b class="unz" style="font-size:26px">${esc(head)}</b>${body ? `<p>${esc(body)}</p>` : ''}<div class="help">${helpLines().map(lineHTML).join('')}${emer}</div>`);
}

/* ── 오늘 해 볼 것 (앱 Plan.swift 와 같은 settings.dayPlan) ── */
function plan(){
  let p = null; try { p = S.set.dayPlan ? JSON.parse(S.set.dayPlan) : null; } catch {}
  if ((!p || p.day !== ymd() || !p.todo || !p.todo.length) && S.loaded.has('settings') && S.loaded.has('tests') && C.plan && C.plan.makePlan) {
    const who = { mind: myTest('mind') ? top(myTest('mind').scores) : (list('minds')[0] ? top(list('minds')[0].scores) : null),
                  temper: myTest('temper') ? top(myTest('temper').scores) : null, nine: myTest('nine') ? top(myTest('nine').scores) : null };
    p = C.plan.makePlan(who, p); saveSet({ dayPlan: JSON.stringify(sortKeys(p)) });
  }
  return p;
}
function togglePlan(item){
  const p = plan(); if (!p) return;
  p.done = p.done.includes(item) ? p.done.filter(x => x !== item) : [...p.done, item];
  saveSet({ dayPlan: JSON.stringify(sortKeys(p)) });
}

/* ── 오늘의 문장 (AI, 하루 한 번 · 없으면 앱과 같은 기본 문장) ── */
let todayBusy = false;
function todayLine(){
  const key = ymd() + '#' + (ls.get('seed', 0)); const c = ls.get('today', null);
  if (c && c.key === key) return c;
  const fb = C.home && C.home.todayFallback ? C.home.todayFallback({ weekMoods: lastDays(7).map(x => x ? x.mood : 0), moves: weekCount(['body', 'ground', 'face', 'neck', 'stretch']), breaths: weekCount(['breath']), seed: ls.get('seed', 0) + dayOfYear() }) : { weather: '오늘이\n첫 쪽이에요', body: '하루 한 번, 마음 출석으로 오늘 쪽을 시작해요.' };
  if (!todayBusy && S.user && S.loaded.has('checkins')) {
    todayBusy = true;
    ai('today', { ...aiStats(), seed: ls.get('seed', 0) }).then(a => { todayBusy = false; if (a && a.weather) { ls.set('today', { key, weather: a.weather.replace(/\\n/g, '\n'), body: a.body, ai: true }); render(); } });
  }
  return { ...fb, key };
}
const dayOfYear = () => Math.floor((dayStart() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);

/* ============ 화면 ============ */
// 메뉴 차례 (2026-11-25 문쌤: 단순하게 · 한 줄씩 · 사용 설명서 → 문의하기 → 힘들 때 도움 받을 곳, 앱 ☰ 메뉴와 같은 차례)
const NAV = [['home', '홈'], ['write', '마음 기록'], ['ai', 'AI 마음 티쳐'], ['breath', '숨 고르기'], ['test', '테스트'], ['dex', '숨은 마음 도감'], ['vault', '기록 보관함'], ['me', '내 계정'], ['guide', '사용 설명서'], ['ask', '문의하기'], ['help', '힘들 때 도움 받을 곳']];
/* 📖 사용 설명서 — 앱 GuideView.swift 와 같은 글 (고칠 땐 둘 다) */
const GUIDE = [{"title": "홈 · 아래 탭", "lines": ["아래 탭: 테스트 · 마음근력 · 가운데 둥근 [홈] · 도감 · AI 티쳐.", "홈 모양은 8가지예요(앱). 맨 위 번호를 누르거나 ◀ ▶ 로 넘겨 나에게 맞는 홈을 골라요. 바탕 색은 ☰ › 모양 고르기에서 바꿔요.", "홈을 위에서 아래로 당기면 AI 마음 티쳐가 오늘 문장을 새로 써 줘요."]}, {"title": "오늘 마음 남기기", "lines": ["홈의 마음 날씨(맑음 ~ 소나기)를 누르면 기록 창이 열려요. 까닭 태그를 고르고 좋았던 점이나 나를 위로하는 한 줄을 남겨요.", "까닭 태그는 [＋ 더하기]로 직접 만들 수 있어요.", "하루에 한 번 남기는 출석부예요. 다시 누르면 오늘 기록을 고쳐요."]}, {"title": "오늘 해 볼 것 · 내려놓을 것", "lines": ["날마다 세 개씩 골라 줘요. 테스트를 하면 나에게 맞는 것으로 골라요.", "체크 칸을 누르면 체크, 화살표 단추로 다른 세 개로 바꿔요."]}, {"title": "AI 마음 티쳐", "lines": ["마음 풀기: 내 마음을 적으면 '마음의 말'로 풀어 주고, '그 사람 이해하기'는 숨은 마음 도감에서도 찾아 줘요.", "물어보기 · 이야기: 궁금한 것을 묻거나 친구에게 말하듯 털어놓아요.", "답은 '지난 기록'에 쌓이고, 고치거나 지울 수 있어요. 쓰던 글은 저절로 임시 저장돼요.", "AI 마음 티쳐는 상담 선생님이 아니에요. 많이 힘들 땐 도움 받을 곳(109 · 1388)을 이용해 주세요."]}, {"title": "마음근력", "lines": ["내 3D 캐릭터가 먼저 보여 주고 따라 해요: 발바닥 느끼기 · 얼굴 풀기 · 목 · 어깨 풀기 · 1분 호흡 등.", "감사 한 줄 · 나에게 다정하게 한 줄도 여기서 써요. 하루에 여러 번 해도 돼요."]}, {"title": "테스트", "lines": ["타고난 기질 → 살면서 다듬은 성격 → 16가지 유형 → 9가지 유형 → 마음 결 → 행동 스타일, 그리고 짧은 테스트 · 밸런스 게임.", "9가지 유형은 '1w2'처럼 보여 줘요: 앞 숫자가 바탕 번호, w 뒤가 날개 번호예요.", "다시 하면 다른 문항으로 묻고, 지난번과 얼마나 비슷한지 보여 줘요.", "위쪽 사람 칩에서 가족 · 학생을 고르면 그 사람을 떠올리며 답하고, 결과는 그 사람 칸에 따로 저장돼요. 둘 다 하면 '닮은 점 · 다른 점'을 볼 수 있어요.", "표준화된 심리검사나 진단이 아니에요."]}, {"title": "숨은 마음 도감", "lines": ["'내 주변엔 마음은 여린데 겉으로는 세 보이는 사람이 있어'처럼 적으면 그 사람의 숨은 마음을 도감에서 찾아 보고서로 알려 줘요.", "못 찾은 칸을 누르면 힌트가 나와요. 찾은 마음에는 내 메모를 남길 수 있어요."]}, {"title": "홈 화면 위젯", "lines": ["아이폰 홈 화면을 꾹 눌러 [편집] › [위젯 추가]에서 '마음한편'을 골라요.", "탭하면 오늘 마음 · 오늘 해 볼 것 · 오늘의 문장 · 캐릭터 한마디가 넘어가요. 날씨를 누르면 바로 기록해요."]}, {"title": "내 계정 · 여러 기기", "lines": ["같은 로그인이면 아이폰 · 아이패드 · 웹(moontr.site/maum)에서 같은 기록이 보여요.", "구글 · 카카오 · Apple 로그인을 한 계정으로 이을 수 있어요 (내 계정 › 로그인 방법).", "별명 · 나 소개 · 캐릭터는 내 계정에서 고쳐요."]}, {"title": "힘들 때", "lines": ["☰ › 힘들 때 도움 받을 곳: 109 · 1388 · Wee클래스 등. 위험한 말이 보이면 AI로 보내지 않고 도움 받을 곳을 먼저 보여 줘요.", "학교폭력이 걱정되면 117 신고와 증거 남기는 법을 알려 줘요."]}, {"title": "문의하기", "lines": ["☰ › 문의하기: 쓰는 법 · 고칠 점을 남기면 AI 가 먼저 답하고, 만든 선생님도 확인해서 답해요."]}];
function render(){
  if (!S.user) return;
  if (!S.loaded.has('settings')) { $('#view').innerHTML = '<p class="sub" style="padding:40px">기록을 불러오고 있어요…</p>'; return; }
  // 처음: 동의 · 별명
  if (!S.set.consentAt) return renderConsent();
  if (!S.set.nickname) return renderSetup();
  const v = S.view;
  document.querySelectorAll('.side a.nav').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  $('#meName').textContent = S.set.nickname || '나'; $('#meSub').textContent = S.set.grade || '';
  const f = { home: vHome, write: vWrite, ai: vAI, breath: vBreath, test: vTest, dex: vDex, vault: vVault, me: vMe, help: vHelp, guide: vGuide }[v] || vHome;
  const keep = document.activeElement && document.activeElement.id && ['aiText', 'dexText', 'talkText'].includes(document.activeElement.id) ? document.activeElement.id : null;
  $('#view').innerHTML = f();
  bind(v);
  if (keep && $('#' + keep)) { const el = $('#' + keep); el.focus(); el.selectionStart = el.selectionEnd = el.value.length; }
}
function go(v, sub){ S.view = v; S.sub = sub || {}; location.hash = '#/' + v; render(); window.scrollTo(0, 0); }

function renderConsent(){
  $('#view').innerHTML = `<div class="gate fade-in"><img src="/admin/app-maum.jpg" alt=""><b class="unz" style="font-size:30px">마음한편에 오신 걸 환영해요</b>
    <p class="sub">기록은 내 로그인 계정에만 저장되고 나만 볼 수 있어요. 운영자도 보지 않아요.</p>
    <p class="small"><a href="/maum/terms.html" target="_blank">이용약관</a> · <a href="/maum/privacy.html" target="_blank">개인정보 처리방침</a>을 읽었고, 만 14세 이상이에요.</p>
    <button class="btn main" id="agree">동의하고 시작하기</button></div>`;
  $('#agree').onclick = () => saveSet({ consentAt: sec(new Date()) });
}
function renderSetup(){
  const F = ["별빛", "햇살", "바람", "새벽", "노을", "구름", "봄비", "무지개", "달빛", "파도"], B = ["고래", "여우", "다람쥐", "부엉이", "펭귄", "수달", "고양이", "사슴", "토끼", "곰"];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  let nick = S.sub.nick || `${pick(F)} ${pick(B)}`; S.sub.nick = nick;
  $('#view').innerHTML = `<div class="gate fade-in"><b class="unz" style="font-size:30px">반가워요!</b><p class="sub">출석부에 쓸 별명을 골라요. 진짜 이름은 쓰지 않아요.</p>
    <b class="unz" style="font-size:40px" id="nk">${esc(nick)}</b><div class="row" style="justify-content:center"><button class="btn" id="again">다른 별명</button></div>
    <div class="eyebrow">나는 (여러 개 골라도 돼요)</div><div class="row" style="justify-content:center" id="roles">${[['student', '학생'], ['parent', '부모'], ['teacher', '교사'], ['worker', '직장인']].map(([k, n]) => `<button class="chip" data-r="${k}">${n}</button>`).join('')}</div>
    <button class="btn main" id="start">시작하기</button></div>`;
  const roles = new Set();
  $('#again').onclick = () => { S.sub.nick = `${pick(F)} ${pick(B)}`; renderSetup(); };
  document.querySelectorAll('#roles .chip').forEach(b => b.onclick = () => { roles.has(b.dataset.r) ? roles.delete(b.dataset.r) : roles.add(b.dataset.r); b.classList.toggle('on'); });
  $('#start').onclick = () => {
    const r = [...roles], names = { student: '학생', parent: '엄마', teacher: '교사', worker: '직장인' };
    const patch = { nickname: S.sub.nick, grade: r.map(x => names[x]).join(' · ') };
    if (r.length) { patch.mode = r[0]; patch.meTags = JSON.stringify(sortKeys({ roles: r, grade: '', kids: [], parent: '엄마' })); }
    saveSet(patch);
  };
}

/* 홈: 한눈에 보는 대시보드 */
function vHome(){
  const t = todayLine(), today = todayCheckin(), p = plan() || { todo: [], letgo: [], done: [] };
  const all = checkins(), red = all.filter(c => c.mood <= 2).length, yel = all.filter(c => c.mood === 3).length, grn = all.filter(c => c.mood >= 4).length;
  const care = C.safety && C.safety.needsCare && C.safety.needsCare(all.map(c => ({ day: ymd(fromSec(c.day)), at: c.at, mood: c.mood, reasons: c.reasons })), riskDays());
  const days = lastDays(7), wd = ['일', '월', '화', '수', '목', '금', '토'];
  const d = new Date();
  return `<div class="stack fade-in">
    <div class="row sub small" style="justify-content:space-between"><span>${d.getMonth() + 1}.${d.getDate()} ${wd[d.getDay()]}요일 · ${new Set(all.map(c => ymd(fromSec(c.day)))).size}쪽</span>
      <select id="modeSel" class="chip" aria-label="모드">${[['all', '전체 보기'], ['student', '학생 모드'], ['parent', '부모 모드'], ['worker', '직장인 모드'], ['teacher', '교사 모드']].map(([k, n]) => `<option value="${k}"${mode() === k ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
    ${care ? `<div class="care"><span>요즘 많이 힘든 날이 이어졌어요. 혼자 견디지 않아도 돼요.</span><button class="btn small" data-go="help">도움 받을 곳</button></div>` : ''}
    <div class="grid21">
      <div class="today"><div><div class="eyebrow">오늘의 마음 날씨${t.ai ? ' · AI 마음 티쳐' : ''}</div><div class="w">${esc(t.weather)}</div><div class="sub">${esc(t.body)}</div>
        <button class="btn small" id="reLine" style="margin-top:10px">다른 문장</button></div><img src="/maum/character.png" alt=""></div>
      <div class="box"><div class="eyebrow">오늘 마음 ${today ? '· ' + esc(moodName(today.mood)) : ''}</div>
        <div class="moods" style="margin-top:8px">${[5, 4, 3, 2, 1].map(m => `<button data-mood="${m}" class="${today && today.mood === m ? 'on' : ''}" aria-label="${moodName(m)}">${wx(m)}<span>${moodName(m)}</span></button>`).join('')}</div>
        <div class="sub small" style="margin-top:6px">${today ? '눌러서 고칠 수 있어요' : '날씨를 누르면 까닭 · 한 줄을 써요'} · 연속 ${streak()}일</div>
        <div class="eyebrow" style="margin-top:12px">지금까지 쌓인 기분 · ${all.length}일</div>
        <div class="lights"><div><b style="background:var(--red)">${red}</b>힘든 날</div><div><b style="background:var(--yellow)">${yel}</b>그저 그런</div><div><b style="background:var(--green)">${grn}</b>좋은 날</div></div></div>
    </div>
    <div class="grid2 keep">
      <div class="box"><div class="eyebrow">오늘 해 볼 것</div>${p.todo.map(s => `<button class="chk${p.done.includes(s) ? ' on' : ''}" data-plan="${esc(s)}"><span class="sq"></span><span>${esc(s)}</span></button>`).join('')}</div>
      <div class="box"><div class="eyebrow">내려놓을 것</div>${p.letgo.map(s => `<button class="chk${p.done.includes(s) ? ' on' : ''}" data-plan="${esc(s)}"><span class="sq"></span><span>${esc(s)}</span></button>`).join('')}</div>
    </div>
    <div class="grid2">
      <div class="box"><div class="eyebrow">이번 주 마음</div><div class="week">${days.map((c, i) => { const x = new Date(); x.setDate(x.getDate() - (6 - i)); return `<div>${c ? wx(c.mood) : '<div class="none"></div>'}${wd[x.getDay()]}</div>`; }).join('')}</div></div>
      <div class="box"><div class="eyebrow">AI 마음 티쳐에게</div><button class="askbox" data-go="ai" style="margin-top:8px">요즘 마음에 걸리는 일을 적어 보세요<b>↑</b></button>
        <div class="row" style="margin-top:8px"><button class="chip" data-ai="translate">내 마음 풀어 보기</button><button class="chip" data-ai="other">그 사람 이해하기</button><button class="chip" data-ai="talk">이야기</button></div></div>
    </div></div>`;
}

/* 마음 기록 (시트) */
function openWrite(m){
  const ex = todayCheckin(), mood = m || (ex ? ex.mood : 4);
  const base = (C.checkin && C.checkin.reasons && (C.checkin.reasons[mode()] || C.checkin.reasons.all)) || ['친구', '가족', '공부', '일', '몸', '잠', '날씨'];
  const mine = String(S.set.myReasons || '').split('\n').filter(Boolean);
  const tags = [...new Set([...base, ...mine])];
  const sel = new Set(ex ? ex.reasons : []);
  let comfort = ex ? ex.lineKind === 'comfort' : mood <= 2, cur = mood;
  const draw = () => {
    sheet(`<div class="eyebrow">오늘 마음 남기기</div><b class="unz" style="font-size:30px">${esc(moodName(cur))}</b>
      <div class="moods">${[5, 4, 3, 2, 1].map(x => `<button data-m="${x}" class="${x === cur ? 'on' : ''}">${wx(x)}<span>${moodName(x)}</span></button>`).join('')}</div>
      <div class="eyebrow">무엇 때문에?</div><div class="row">${tags.map(t => `<button class="chip${sel.has(t) ? ' on' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}<button class="chip" id="addTag">＋ 더하기</button></div>
      <div class="seg"><button class="${comfort ? '' : 'on'}" data-k="good">오늘 좋았던 점</button><button class="${comfort ? 'on' : ''}" data-k="comfort">나를 위로하는 한 줄</button></div>
      <textarea id="good" rows="3" placeholder="${comfort ? '예) 오늘 많이 애썼어. 쉬어도 괜찮아' : '예) 아이랑 저녁 산책을 했다'}">${esc(ls.get('draft.checkin', ex ? ex.good : ''))}</textarea>
      <button class="btn main" id="saveC" style="justify-content:center">남기기</button>`);
    document.querySelectorAll('#sheet [data-m]').forEach(b => b.onclick = () => { cur = +b.dataset.m; if (!ex) comfort = cur <= 2; draw(); });
    document.querySelectorAll('#sheet [data-t]').forEach(b => b.onclick = () => { sel.has(b.dataset.t) ? sel.delete(b.dataset.t) : sel.add(b.dataset.t); b.classList.toggle('on'); });
    document.querySelectorAll('#sheet [data-k]').forEach(b => b.onclick = () => { comfort = b.dataset.k === 'comfort'; draw(); });
    $('#good').oninput = e => ls.set('draft.checkin', e.target.value);
    $('#addTag').onclick = () => { const t = (prompt('더할 까닭 (8글자까지)') || '').trim().slice(0, 8); if (t && !tags.includes(t)) { tags.push(t); sel.add(t); saveSet({ myReasons: [...mine, t].join('\n') }); draw(); } };
    $('#saveC').onclick = async () => {
      const good = $('#good').value.trim(), now = new Date();
      const rec = { day: sec(dayStart(now)), at: sec(now), mood: cur, reasons: tags.filter(t => sel.has(t)), good, lineKind: comfort ? 'comfort' : 'good' };
      closeSheet(); ls.set('draft.checkin', '');
      await put('checkins', ex ? ex.key : uuid(), rec);
      toast('오늘 마음을 남겼어요');
      if (good && !safetyGate(good)) return;
    };
  };
  draw();
}
function vWrite(){ setTimeout(() => openWrite(), 0); S.view = 'home'; return vHome(); }

/* AI 마음 티쳐: 내 마음 풀어 보기 · 그 사람 이해하기 · 물어보기 · 이야기 */
function vAI(){
  const tab = S.sub.tab || ls.get('aiTab', 'translate');
  const tabs = [['translate', '내 마음 풀어 보기'], ['other', '그 사람 이해하기'], ['ask', '물어보기'], ['talk', '이야기']];
  const draft = ls.get('draft.' + tab, '');
  const logs = practices().filter(p => p.kind === 'ai').map(p => { try { return { ...p, d: JSON.parse(p.text) }; } catch { return null; } }).filter(x => x && x.d.t === tab).slice(0, 20);
  const a = S.sub.answer;
  let body = '';
  if (tab === 'talk') {
    const chat = ls.get('talk.' + ymd(), []);
    body = `<div class="stack" style="gap:8px">${chat.length ? `<div class="row" style="justify-content:space-between"><span class="eyebrow">오늘 나눈 이야기</span><button class="btn small" id="newTalk">새 이야기</button></div>` : '<b class="unz" style="font-size:28px">무엇이 마음에 걸려요?</b>'}
      <div style="display:grid;gap:8px">${chat.map(m => `<div class="bubble ${m.me ? 'me' : 'ai'}">${esc(m.t)}</div>`).join('')}${S.sub.loading ? '<div class="sub small">AI 마음 티쳐가 듣고 있어요…</div>' : ''}</div>
      <div class="row" style="flex-wrap:nowrap"><textarea id="talkText" rows="2" placeholder="이어서 이야기해 보세요">${esc(draft)}</textarea><button class="btn main" id="send">보내기</button></div></div>`;
  } else {
    body = `<div class="box" style="display:grid;gap:8px"><div class="sub small">${tab === 'other' ? '궁금한 사람의 말투 · 행동을 적어 보세요 (이름은 빼고) · 숨은 마음 도감에서도 찾아 줘요' : tab === 'ask' ? '마음에 대해 무엇이든 물어보세요' : '지금 마음을 그대로 적어 보세요'}</div>
      <textarea id="aiText" rows="${tab === 'ask' ? 2 : 5}" maxlength="500" placeholder="${tab === 'ask' ? '예) 잠이 안 올 때 어떻게 해요?' : ''}">${esc(draft)}</textarea>
      <div class="row" style="justify-content:space-between"><span class="sub small">${draft.length} / 500${draft ? ' · 임시 저장됨' : ''}</span><button class="btn main" id="goAI"${S.sub.loading ? ' disabled' : ''}>${tab === 'ask' ? '물어보기' : '풀어 보기'}</button></div></div>
      ${S.sub.loading ? '<div class="answer"><small>AI 마음 티쳐</small>생각하고 있어요…</div>' : ''}
      ${a ? (a.error ? `<div class="box">${esc(a.error)}</div>` : `<div class="answer fade-in"><small>AI 마음 티쳐</small>${a.feeling ? `<div class="feel">“${esc(a.feeling)}”</div>` : ''}${a.why ? `<div><small>왜 그럴까요</small><br>${esc(a.why)}</div>` : ''}${a.tryThis ? `<div><small>해 볼 것</small><br>${esc(a.tryThis)}</div>` : ''}${a.reply ? `<div>${esc(a.reply)}</div>` : ''}</div>
        ${a.ring && C.dex ? `<button class="box" data-dex="${a.ring}" style="border:1.5px solid var(--acc);cursor:pointer;text-align:left;font:inherit;color:inherit"><div class="eyebrow">숨은 마음 도감 · ${a.ringNew ? '새로 찾았어요!' : '이미 찾은 마음'}</div><b>No.${String(a.ring).padStart(3, '0')} ${esc((C.dex.type(a.ring) || {}).name || '')}</b><div class="sub small">보고서 보기 ›</div></button>` : ''}`) : ''}`;
  }
  return `<div class="stack fade-in"><h2 class="title">AI 마음 티쳐</h2>
    <div class="seg">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('')}</div>${body}
    ${logs.length ? `<div class="eyebrow" style="margin-top:6px">지난 기록</div>${logs.map(l => `<div class="log"><div class="h"><b>${esc(l.d.q.slice(0, 40))}${l.d.q.length > 40 ? '…' : ''}</b><span>${fromSec(l.at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span></div>
      ${l.d.feeling ? `<div class="unz" style="font-size:19px">“${esc(l.d.feeling)}”</div>` : ''}${l.d.why ? `<div class="small">${esc(l.d.why)}</div>` : ''}${l.d.tryThis ? `<div class="small"><b>해 볼 것</b> ${esc(l.d.tryThis)}</div>` : ''}${l.d.reply ? `<div class="small">${esc(l.d.reply)}</div>` : ''}
      <div class="row" style="justify-content:flex-end"><button class="btn small" data-reuse="${esc(l.d.q)}">이 글로 다시</button><button class="btn small" data-dellog="${l.key}">지우기</button></div></div>`).join('')}` : ''}</div>`;
}
async function runAI(){
  const tab = S.sub.tab || ls.get('aiTab', 'translate'), text = ($('#aiText') || {}).value || '';
  const t = text.trim(); if (t.length < (tab === 'ask' ? 2 : 4)) return toast('조금 더 적어 주세요');
  if (!safetyGate(t)) return;
  if (!(await askConsent())) return;
  S.sub.loading = true; S.sub.answer = null; render();
  if (tab === 'ask') {
    const a = await ai('ask', { text: t });
    S.sub.loading = false; S.sub.answer = a && a.reply ? { reply: a.reply } : { error: (a && a.error) || 'AI 마음 티쳐와 연결되지 않았어요. 잠시 뒤에 다시 해 주세요.' };
    if (a && a.crisis) return render(), showHelp('life');
    if (a && a.reply) { await aiLog('ask', t, { reply: a.reply }); ls.set('draft.ask', ''); }
    return render();
  }
  const other = tab === 'other';
  const [a, r] = await Promise.all([ai('translate', { text: t, other }), other ? ai('ring', { text: t, who: '그 사람' }) : Promise.resolve(null)]);
  S.sub.loading = false;
  if (a && a.crisis) { render(); return showHelp('life'); }
  if (!a || a.error || !a.feeling) { S.sub.answer = { error: (a && a.error) || '쓴 글은 지난 기록에 남겼어요. AI 마음 티쳐와 연결되지 않아 지금은 풀이를 만들지 못했어요.' }; await aiLog(tab, t, {}); return render(); }
  let ring = null, ringNew = false;
  if (other) {
    ring = (r && r.no) || (C.dex && C.dex.matchDex ? (C.dex.matchDex(t)[0] || {}).no : null);
    if (ring) { ringNew = !list('found').some(f => f.no === ring); await put('found', uuid(), { no: ring, who: '그 사람', at: sec(new Date()), story: '', report: (r && r.report) || [] }); }
  }
  S.sub.answer = { feeling: a.feeling, why: a.why, tryThis: a.tryThis, ring, ringNew };
  await aiLog(tab, t, { feeling: a.feeling, why: a.why, tryThis: a.tryThis, ring: ring ? String(ring) : '' });
  ls.set('draft.' + tab, ''); render();
}
async function sendTalk(){
  const el = $('#talkText'), t = (el.value || '').trim(); if (!t) return;
  if (!safetyGate(t)) return;
  if (!(await askConsent())) return;
  const k = 'talk.' + ymd(), chat = ls.get(k, []), history = chat.slice(-6);
  chat.push({ me: true, t }); ls.set(k, chat); ls.set('draft.talk', ''); S.sub.loading = true; render();
  const a = await ai('talk', { text: t, history });
  S.sub.loading = false;
  if (a && a.crisis) { ls.set(k, []); render(); return showHelp('life'); }
  const reply = a && a.reply ? a.reply : (a && a.error) || '들려줘서 고마워요. 쓴 글은 지난 이야기에 남겼어요. 지금은 AI 마음 티쳐와 연결되지 않아서, 대신 1분 숨 고르기를 해 볼까요?';
  chat.push({ me: false, t: reply }); ls.set(k, chat);
  await aiLog('talk', t, a && a.reply ? { reply } : {});
  render();
}

/* 숨 고르기 (앱 BreathView: 준비 3초 · 들이쉬기 4초 · 내쉬기 6초, 1분) */
let breathTimer = null;
function vBreath(){
  const B = (C.breath || {}), inS = B.inhale || 4, outS = B.exhale || 6;
  return `<div class="stack fade-in"><h2 class="title">1분 숨 고르기</h2><div class="breath"><div class="ring"><i id="bCircle"></i><span class="say" id="bSay">준비해요</span></div>
    <div class="sub" id="bLeft">원이 커지면 들이쉬고 (${inS}초), 작아지면 내쉬어요 (${outS}초)</div><button class="btn main" id="bStart">시작하기</button></div>
    <p class="sub small">마음근력의 3D 캐릭터 따라 하기(발바닥 느끼기 · 얼굴 풀기 · 목 · 어깨)는 앱에서 할 수 있어요. 웹에는 2차에 넣을 거예요.</p></div>`;
}
function startBreath(){
  const B = (C.breath || {}), ready = B.ready || 3, inS = B.inhale || 4, outS = B.exhale || 6, total = 60;
  const c = $('#bCircle'), say = $('#bSay'), left = $('#bLeft'); let t = -ready; clearInterval(breathTimer);
  $('#bStart').disabled = true;
  breathTimer = setInterval(() => {
    if (!$('#bCircle')) return clearInterval(breathTimer);
    if (t < 0) { say.textContent = String(-t); t++; return; }
    const ph = t % (inS + outS), inhale = ph < inS;
    if (ph === 0) { c.style.transition = `transform ${inS}s ease-in-out`; c.style.transform = 'scale(1.55)'; }
    if (ph === inS) { c.style.transition = `transform ${outS}s ease-in-out`; c.style.transform = 'scale(1)'; }
    say.textContent = inhale ? '들이쉬어요' : '내쉬어요'; left.textContent = `${total - t}초 남았어요`;
    t++;
    if (t > total) { clearInterval(breathTimer); say.textContent = '잘했어요'; left.textContent = '1분 숨 고르기를 했어요'; const now = new Date();
      put('practices', uuid(), { kind: 'breath', at: sec(now), day: sec(dayStart(now)), text: '' }); $('#bStart').disabled = false; }
  }, 1000);
}

/* 테스트: 목록 → 문항 → 결과 (tests.js 가 앱과 같은 문항 · 점수) */
function vTest(){
  if (!T) return `<h2 class="title">테스트</h2><p class="sub">테스트를 불러오지 못했어요. 새로고침해 주세요.</p>`;
  if (S.sub.run) return vRun();
  if (S.sub.result) return vResult();
  const who = S.sub.who ? members().find(m => m.key === S.sub.who) : null;
  let cards = []; try { cards = T.list(mode(), who ? { name: who.name, role: who.role } : null) || []; } catch (e) { console.warn(e); }
  const doneK = new Set(tests().filter(t => (t.who || '') === (who ? who.key : '')).map(t => t.kind));
  const groups = []; for (const c of cards) { const g = c.group || ''; let G = groups.find(x => x.g === g); if (!G) groups.push(G = { g, items: [] }); G.items.push(c); }
  return `<div class="stack fade-in"><h2 class="title">테스트</h2>
    <div class="row"><button class="chip${who ? '' : ' on'}" data-who="">나</button>${members().map(m => `<button class="chip${who && who.key === m.key ? ' on' : ''}" data-who="${m.key}">${esc(m.name)}</button>`).join('')}<button class="chip" id="addMember">＋ 가족 · 학생 더하기</button></div>
    ${who ? `<div class="sub small">${esc(who.name)}을(를) 떠올리며 답해요. 결과는 ${esc(who.name)} 칸에 따로 저장돼요.${tests().some(t => !t.who) && tests().some(t => t.who === who.key) ? ` <button class="btn small" id="showMatch">나와 ${esc(who.name)} 닮은 점 · 다른 점</button>` : ''}</div>` : ''}
    ${groups.map(G => `${G.g ? `<div class="eyebrow">${esc(G.g)}</div>` : ''}<div class="tcards">${G.items.map(c => `<button class="tcard" data-kind="${esc(c.kind)}"><b>${esc(c.title)}</b><small>${esc(c.sub || '')}</small>${c.minutes ? `<small>${c.minutes}분쯤</small>` : ''}${doneK.has(c.kind) ? '<span class="done">✓ 해 봤어요 · 결과 보기</span>' : ''}</button>`).join('')}</div>`).join('')}</div>`;
}
function startTest(kind){
  const who = S.sub.who ? members().find(m => m.key === S.sub.who) : null;
  const prev = tests().filter(t => t.kind === kind && (t.who || '') === (who ? who.key : ''));
  let set = 0; try { set = T.nextSet ? T.nextSet(kind, prev) : prev.length; } catch {}
  let run; try { run = T.start(kind, { set, member: who ? { name: who.name, role: who.role } : null }); } catch (e) { return toast('이 테스트를 열지 못했어요'); }
  S.sub.run = { ...run, kind, set: run.set ?? set, i: 0, ans: [], who: who ? who.key : '' }; render();
}
function vRun(){
  const R = S.sub.run, it = R.items[R.i], n = R.items.length, U = T.ui || {};
  return `<div class="stack fade-in" style="max-width:720px"><div class="row" style="justify-content:space-between"><button class="btn small" id="qPrev"${R.i ? '' : ' disabled'}>‹ ${esc(U.back || '이전 문항')}</button><b>${esc(R.title || '')}</b><button class="btn small" id="qOut">${esc(U.quit || '나가기')}</button></div>
    <div class="progress"><i style="width:${Math.round(R.i / n * 100)}%"></i></div><div class="sub small">${R.i + 1} / ${n}${R.i === 0 && R.intro ? ' · ' + esc(R.intro) : ''}</div>
    <div class="qcard">${it.lead ? `<div class="eyebrow">${esc(it.lead)}</div>` : ''}<div class="q">${esc(it.text)}</div>
    <div class="${it.type === 'likert' ? 'likert' : 'picks'}">${(it.options || []).map(o => `<button data-a="${o.value}" class="${R.ans[R.i] === o.value ? 'on' : ''}">${esc(o.label)}</button>`).join('')}</div></div>
    ${R.footer ? `<div class="sub small">${esc(R.footer)}</div>` : ''}</div>`;
}
async function answer(v){
  const R = S.sub.run; R.ans[R.i] = v;
  if (R.i < R.items.length - 1) { R.i++; return render(); }
  let sc; try { sc = T.score(R.kind, R.ans, R.set); } catch (e) { console.warn(e); return toast('점수를 내지 못했어요'); }
  const rec = { kind: R.kind, scores: sc.scores || [], code: sc.code || '', at: sec(new Date()), who: R.who || '', set: sc.set ?? R.set ?? 0 };
  const key = uuid(); S.sub = { who: S.sub.who, result: key }; await put('tests', key, rec);
}
/* 결과 조각 (tests.js 의 섹션 모양: note · box[text · strong · caption · bar · para · axis · big · chips]) */
function itemHTML(it){
  switch (it.k) {
    case 'text': return `<p style="margin:6px 0 0">${esc(it.text)}</p>`;
    case 'strong': return `<p style="margin:6px 0 0"><b>${esc(it.text)}</b></p>`;
    case 'caption': return `<p class="sub small" style="margin:6px 0 0">${esc(it.text)}</p>`;
    case 'big': return `<p class="unz" style="margin:6px 0 0;font-size:24px">${esc(it.text)}</p>`;
    case 'para': return `<p style="margin:8px 0 0"><b>${esc(it.label || '')}</b><br>${esc(it.text)}</p>`;
    case 'bar': return `<div class="rbar"><span>${esc(it.label)}</span><span class="t"><i style="width:${Math.max(0, Math.min(100, +it.value || 0))}%"></i></span><b>${esc(it.shown ?? Math.round(it.value))}</b></div>${it.beforeText ? `<div class="sub small" style="text-align:right">${esc(it.beforeText)}</div>` : ''}`;
    case 'axis': return `<div style="margin-top:10px"><div class="small"><b>${esc(it.title || '')}</b></div><div class="row small" style="justify-content:space-between"><span${it.leftOn ? ' style="font-weight:700"' : ''}>${esc(it.left)}</span><span${it.leftOn ? '' : ' style="font-weight:700"'}>${esc(it.right)}</span></div><div class="progress"><i style="width:${Math.max(0, Math.min(100, +it.value || 0))}%"></i></div><div class="sub small" style="text-align:center">${esc(it.shown || '')}</div></div>`;
    case 'chips': return `<div class="row" style="margin-top:8px">${(it.list || []).map(c => `<span class="chip">${esc(c)}</span>`).join('')}</div>`;
    default: return it.text ? `<p style="margin:6px 0 0">${esc(it.text)}</p>` : '';
  }
}
const secHTML = sct => sct.type === 'note' ? `<p class="sub small">${esc(sct.text)}</p>` : `<div class="box">${sct.h ? `<div class="eyebrow">${esc(sct.h)}</div>` : ''}${(sct.items || []).map(itemHTML).join('')}</div>`;
/* 날짜: 저장은 초, tests.js 는 밀리초라 1000 을 곱해 넘겨요 */
function vResult(){
  const r = S.col.tests[S.sub.result]; if (!r) return '<p class="sub">결과를 불러오는 중…</p>';
  const who = r.who ? members().find(m => m.key === r.who) : null;
  const same = tests().filter(t => t.kind === r.kind && (t.who || '') === (r.who || ''));
  const prev = same.filter(t => t.at < r.at)[0];
  let R = {}; try { R = T.result(r.kind, r.scores, r.code, { member: who ? { name: who.name, role: who.role } : null, previous: prev ? { scores: prev.scores, code: prev.code, at: prev.at * 1000, set: prev.set } : null, set: r.set, at: r.at * 1000, results: tests().filter(t => (t.who || '') === (r.who || '')).map(t => ({ ...t, at: t.at * 1000 })) }) || {}; } catch (e) { console.warn(e); }
  const H = R.hero || {};
  return `<div class="stack fade-in" style="max-width:760px"><button class="btn small" id="backTests" style="justify-self:start">‹ 테스트 목록</button>
    <div class="today" style="grid-template-columns:1fr"><div><div class="eyebrow">${esc(H.small || R.title || '')}${who ? ' · ' + esc(who.name) : ''}</div><div class="w">${esc(H.big || R.nickname || '')}</div>${H.text ? `<div class="sub">${esc(H.text)}</div>` : ''}${H.foot ? `<div class="sub small" style="margin-top:6px">${esc(H.foot)}</div>` : ''}</div></div>
    ${(R.sections || []).map(secHTML).join('')}
    <div class="row"><button class="btn" id="again">다른 문항으로 다시 하기</button></div></div>`;
}
function vMatch(m){
  const ms = t => ({ ...t, at: t.at * 1000 });
  let M = null; try { M = T.match(tests().filter(t => !t.who).map(ms), tests().filter(t => t.who === m.key).map(ms), { name: m.name, role: m.role }); } catch (e) { console.warn(e); }
  if (!M || !(M.sections || []).length) return toast((M && M.missing) || '같은 테스트를 둘 다 해야 볼 수 있어요');
  sheet(`<b class="unz" style="font-size:28px">${esc(M.title || '')}</b>${M.head ? `<div class="sub">${esc(M.head)}</div>` : ''}
    ${M.sections.map(x => `<div class="box"><div class="eyebrow">${esc(x.h || '')}</div>${x.summary ? `<p style="margin:6px 0 0"><b>${esc(x.summary)}</b></p>` : ''}
      ${(x.rows || []).map(rw => `<div style="margin-top:10px"><div class="row small" style="justify-content:space-between"><b>${esc(rw.name)}</b><span class="sub">나 ${rw.me ?? ''} · ${esc(m.name)} ${rw.other ?? ''}</span></div><p class="small" style="margin:4px 0 0">${esc(rw.text || '')}</p></div>`).join('')}</div>`).join('')}
    <p class="sub small">좋고 나쁨이 아니라 '어디가 닮고 어디가 다른지'예요. 다른 점은 서로를 채워 주는 자리이기도 해요.</p>`);
}
function addMember(){
  sheet(`<b style="font-size:18px">가족 · 학생 더하기</b><input type="text" id="mName" maxlength="10" placeholder="별명 (예: 첫째, 남편)">
    <div class="row" id="mRole">${[['child', '아이'], ['partner', '남편 · 아내'], ['student', '학생'], ['coworker', '동료']].map(([k, n], i) => `<button class="chip${i ? '' : ' on'}" data-r="${k}">${n}</button>`).join('')}</div>
    <button class="btn main" id="mSave" style="justify-content:center">더하기</button>`);
  let role = 'child';
  document.querySelectorAll('#mRole .chip').forEach(b => b.onclick = () => { role = b.dataset.r; document.querySelectorAll('#mRole .chip').forEach(x => x.classList.toggle('on', x === b)); });
  $('#mSave').onclick = async () => { const name = $('#mName').value.trim(); if (!name) return; closeSheet(); const key = uuid(); await put('members', key, { name, role, avatar: '', order: members().length + 1, at: sec(new Date()) }); S.sub = { who: key }; render(); };
}

/* 숨은 마음 도감 */
function vDex(){
  const D = C.dex; if (!D) return '<h2 class="title">숨은 마음 도감</h2><p class="sub">도감을 불러오지 못했어요.</p>';
  const found = list('found'), have = new Set(found.map(f => f.no));
  const types = D.types || [];
  if (S.sub.no) {
    const t = D.type(S.sub.no) || {}, fs = found.filter(f => f.no === S.sub.no), rep = (fs.find(f => f.report && f.report.length) || {}).report || [];
    const titles = (D.report || []).map(r => Array.isArray(r) ? r[0] : r);
    return `<div class="stack fade-in" style="max-width:760px"><button class="btn small" id="dexBack" style="justify-self:start">‹ 도감</button>
      <div class="answer"><small>No.${String(t.no).padStart(3, '0')} · 「${esc(t.hint || '')}」</small><div class="feel">${esc(t.name || '')}</div><div>${esc(t.line || '')}</div></div>
      ${fs.length ? `<div class="sub small">찾은 곳 · ${[...new Set(fs.map(f => f.who))].map(esc).join(' · ')} · ${fs.length}번</div>` : ''}
      ${titles.map((h, i) => `<div class="box"><div class="eyebrow">${esc(h)}</div><p style="margin:6px 0 0" class="${rep[i] ? '' : 'sub'}">${esc(rep[i] || (Array.isArray(D.report[i]) ? D.report[i][1] : ''))}</p></div>`).join('')}
      <p class="sub small">${esc(rep.length ? (D.text && D.text.reportNoteAI) || '' : (D.text && D.text.reportNoteEmpty) || '')}</p></div>`;
  }
  return `<div class="stack fade-in"><h2 class="title">숨은 마음 도감 <span class="sub small">${have.size} / ${D.total || types.length}</span></h2>
    <div class="box" style="display:grid;gap:8px"><div class="eyebrow">어떤 사람이 궁금해요?</div>
      <textarea id="dexText" rows="3" placeholder="예) 내 주변엔 마음은 여린데 겉으로는 세 보이는 사람이 있어">${esc(ls.get('draft.dex', ''))}</textarea>
      <div class="row" style="justify-content:space-between"><span class="sub small">도감을 찾는 데만 써요</span><button class="btn main" id="dexGo"${S.sub.loading ? ' disabled' : ''}>${S.sub.loading ? '찾는 중…' : '도감 찾기'}</button></div></div>
    <div class="dex">${[...Array(D.total || types.length)].map((_, i) => { const no = i + 1, t = D.type(no);
      return have.has(no) && t ? `<button data-dex="${no}"><span class="no">No.${String(no).padStart(3, '0')}</span><b>${esc(t.name)}</b><span class="sub small">「${esc(t.hint || '')}」</span></button>`
        : `<button class="lock" data-clue="${no}"><span class="no">No.${String(no).padStart(3, '0')}</span><span>${t ? '「' + esc(t.hint || '') + '」' : '?'}</span></button>`; }).join('')}</div></div>`;
}
async function dexFind(){
  const t = ($('#dexText').value || '').trim(); if (t.length < 6) return toast('조금 더 적어 주세요');
  if (!safetyGate(t)) return; if (!(await askConsent())) return;
  S.sub.loading = true; render();
  const r = await ai('ring', { text: t, who: '주변 사람' });
  S.sub.loading = false;
  if (r && r.crisis) { render(); return showHelp('life'); }
  const no = (r && r.no) || (C.dex.matchDex ? (C.dex.matchDex(t)[0] || {}).no : null);
  if (!no) { render(); return toast('숨은 마음을 찾지 못했어요. 조금 더 자세히 적어 주세요'); }
  await put('found', uuid(), { no, who: '주변 사람', at: sec(new Date()), story: '', report: (r && r.report) || [] });
  ls.set('draft.dex', ''); S.sub = { no }; render();
}

/* 기록 보관함 */
function vVault(){
  const cs = checkins().slice(0, 60), ps = practices().filter(p => ['thanks', 'self'].includes(p.kind)).slice(0, 30);
  const ts = tests().slice(0, 30);
  return `<div class="stack fade-in"><h2 class="title">기록 보관함</h2>
    <div class="box"><div class="eyebrow">마음 기록 · ${checkins().length}일</div>${cs.map(c => `<div style="display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;margin-top:10px"><span style="width:30px;height:30px">${wx(c.mood)}</span><div><b>${esc(moodName(c.mood))}</b> <span class="sub small">${esc((c.reasons || []).join(' · '))}</span>${c.good ? `<div class="small">${esc(c.good)}</div>` : ''}</div><span class="sub small">${fromSec(c.day).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span></div>`).join('') || '<p class="sub">아직 없어요</p>'}</div>
    ${ps.length ? `<div class="box"><div class="eyebrow">감사 · 다정한 한 줄</div>${ps.map(p => `<p style="margin:8px 0 0"><span class="sub small">${p.kind === 'thanks' ? '감사' : '나에게'}</span> ${esc(p.text)}</p>`).join('')}</div>` : ''}
    <div class="box"><div class="eyebrow">테스트 결과</div>${ts.map(t => { let title = t.kind; try { title = `${T.title ? T.title(t.kind) : t.kind} · ${T.line ? T.line(t.kind, t.scores, t.code) : ''}`; } catch {} const w = t.who ? (members().find(m => m.key === t.who) || {}).name : '';
      return `<button class="chk" data-res="${t.key}" style="justify-content:space-between"><span>${esc(title)}${w ? ` <span class="sub small">· ${esc(w)}</span>` : ''}</span><span class="sub small">${fromSec(t.at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span></button>`; }).join('') || '<p class="sub">아직 없어요</p>'}</div>
    <div class="box"><div class="eyebrow">AI 마음 티쳐와 나눈 기록</div><p class="sub small" style="margin:6px 0 0">AI 마음 티쳐 화면 아래 '지난 기록'에 있어요.</p><button class="btn small" data-go="ai" style="margin-top:8px">보러 가기</button></div></div>`;
}

/* 내 계정 */
function vMe(){
  return `<div class="stack fade-in" style="max-width:640px"><h2 class="title">내 계정</h2>
    <div class="box"><div class="eyebrow">별명</div><div class="row" style="justify-content:space-between"><b class="unz" style="font-size:26px">${esc(S.set.nickname || '')}</b><button class="btn small" id="nickEdit">고치기</button></div>
      <div class="eyebrow" style="margin-top:12px">나 소개</div><div class="row" style="justify-content:space-between"><span>${esc(S.set.grade || '아직 없어요')}</span><button class="btn small" id="gradeEdit">고치기</button></div>
      <div class="eyebrow" style="margin-top:12px">로그인</div><div class="small">${esc(S.user.providerData.map(p => ({ 'google.com': 'Google', 'oidc.kakao': '카카오', 'apple.com': 'Apple' }[p.providerId] || p.providerId)).join(' · '))}</div></div>
    <div class="box"><div class="eyebrow">앱과 함께 써요</div><p class="small" style="margin:6px 0 0">아이폰 앱과 같은 기록이에요. 앱에서 남긴 마음 · 테스트 · AI 기록이 여기에도 보이고, 여기서 남긴 것도 앱을 열면 그대로 보여요. 캐릭터 · 마음근력 · 건강 앱 · 위젯은 앱에서 써요.</p>
      <a class="btn small" href="https://apps.apple.com/kr/app/id6838529122" target="_blank" rel="noopener" style="margin-top:8px">App Store</a></div>
    <div class="row"><a class="btn small" href="/maum/privacy.html" target="_blank">개인정보 처리방침</a><a class="btn small" href="/maum/terms.html" target="_blank">이용약관</a><button class="btn small" id="logout">로그아웃</button></div>
    <div class="box"><div class="eyebrow">문의하기</div><p class="small" style="margin:6px 0 0">쓰는 법이 궁금하거나 고칠 점이 있으면 남겨 주세요. AI 가 먼저 답하고, 만든 선생님도 확인해서 답해요. 마음 상담은 'AI 마음 티쳐'나 힘들 때 도움 받을 곳을 이용해 주세요.</p><a class="btn small" href="#/ask" style="margin-top:8px">💬 문의하기</a></div>
    <p class="sub small">계정 지우기는 아이폰 앱의 ☰ › 계정 지우기에서 할 수 있어요.</p></div>`;
}
function vGuide(){
  return `<div class="stack fade-in" style="max-width:760px"><h2 class="title">마음한편을 이렇게 써요</h2>${GUIDE.map((g, i) => `<details class="box"${i ? '' : ' open'}><summary style="cursor:pointer;font-weight:700;font-size:16px">${esc(g.title)}</summary><ul style="margin:10px 0 0;padding-left:20px">${g.lines.map(l => `<li style="margin:4px 0">${esc(l.replace('아이폰 홈 화면을', '(아이폰 앱) 홈 화면을'))}</li>`).join('')}</ul></details>`).join('')}
    <p class="sub small">웹에서는 3D 캐릭터 따라 하기 · 건강 앱 · 위젯을 빼고 모두 쓸 수 있어요.</p></div>`;
}
function vHelp(){ setTimeout(() => showHelp(), 0); S.view = 'home'; return vHome(); }

/* ── 단추 잇기 ── */
function bind(v){
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  document.querySelectorAll('[data-dex]').forEach(b => b.onclick = () => go('dex', { no: +b.dataset.dex }));
  if (v === 'home') {
    $('#modeSel').onchange = e => saveSet({ mode: e.target.value });
    $('#reLine').onclick = () => { ls.set('seed', ls.get('seed', 0) + 1); render(); };
    document.querySelectorAll('[data-mood]').forEach(b => b.onclick = () => openWrite(+b.dataset.mood));
    document.querySelectorAll('[data-plan]').forEach(b => b.onclick = () => togglePlan(b.dataset.plan));
    document.querySelectorAll('[data-ai]').forEach(b => b.onclick = () => { ls.set('aiTab', b.dataset.ai); go('ai', { tab: b.dataset.ai }); });
  }
  if (v === 'ai') {
    const tab = S.sub.tab || ls.get('aiTab', 'translate');
    document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { ls.set('aiTab', b.dataset.tab); S.sub = { tab: b.dataset.tab }; render(); });
    const ta = $('#aiText') || $('#talkText'); if (ta) ta.oninput = e => ls.set('draft.' + tab, e.target.value);
    if ($('#goAI')) $('#goAI').onclick = runAI;
    if ($('#send')) { $('#send').onclick = sendTalk; $('#talkText').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendTalk(); } }; }
    if ($('#newTalk')) $('#newTalk').onclick = () => { ls.set('talk.' + ymd(), []); render(); };
    document.querySelectorAll('[data-reuse]').forEach(b => b.onclick = () => { ls.set('draft.' + tab, b.dataset.reuse); S.sub.answer = null; render(); });
    document.querySelectorAll('[data-dellog]').forEach(b => b.onclick = () => { if (confirm('이 기록을 지울까요? 다른 기기에서도 지워져요.')) del('practices', b.dataset.dellog); });
  }
  if (v === 'breath') $('#bStart').onclick = startBreath;
  if (v === 'test') {
    document.querySelectorAll('[data-who]').forEach(b => b.onclick = () => { S.sub = { who: b.dataset.who || null }; render(); });
    if ($('#addMember')) $('#addMember').onclick = addMember;
    if ($('#showMatch')) $('#showMatch').onclick = () => vMatch(members().find(m => m.key === S.sub.who));
    document.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => {
      const who = S.sub.who || ''; const done = tests().find(t => t.kind === b.dataset.kind && (t.who || '') === who);
      if (done && !confirm('지난 결과를 볼까요?\n[확인] 결과 보기 · [취소] 새 문항으로 다시 하기')) return startTest(b.dataset.kind);
      if (done) { S.sub = { who: S.sub.who, result: done.key }; return render(); }
      startTest(b.dataset.kind);
    });
    document.querySelectorAll('[data-a]').forEach(b => b.onclick = () => answer(+b.dataset.a));
    if ($('#qPrev')) $('#qPrev').onclick = () => { S.sub.run.i = Math.max(0, S.sub.run.i - 1); render(); };
    if ($('#qOut')) $('#qOut').onclick = () => { if (confirm('테스트를 그만둘까요? 답한 것은 저장되지 않아요.')) { S.sub = { who: S.sub.who }; render(); } };
    if ($('#backTests')) $('#backTests').onclick = () => { S.sub = { who: S.sub.who }; render(); };
    if ($('#again')) $('#again').onclick = () => { const r = S.col.tests[S.sub.result]; S.sub = { who: r.who || null }; startTest(r.kind); };
  }
  if (v === 'dex') {
    if ($('#dexBack')) $('#dexBack').onclick = () => { S.sub = {}; render(); };
    if ($('#dexText')) $('#dexText').oninput = e => ls.set('draft.dex', e.target.value);
    if ($('#dexGo')) $('#dexGo').onclick = dexFind;
    document.querySelectorAll('[data-clue]').forEach(b => b.onclick = () => { const no = +b.dataset.clue; toast(C.dex.clueText ? C.dex.clueText(no) : '도감 위 칸에 궁금한 사람 이야기를 적어 찾아봐요'); });
  }
  if (v === 'vault') document.querySelectorAll('[data-res]').forEach(b => b.onclick = () => { S.view = 'test'; S.sub = { result: b.dataset.res }; render(); });
  if (v === 'me') {
    $('#logout').onclick = () => auth.signOut();
    $('#nickEdit').onclick = () => { const t = (prompt('별명 (12글자까지)', S.set.nickname || '') || '').trim().slice(0, 12); if (t) saveSet({ nickname: t }); };
    $('#gradeEdit').onclick = () => { const t = (prompt('나 소개 (예: 초4 · 초2 엄마 · 교사)', S.set.grade || '') || '').trim().slice(0, 30); saveSet({ grade: t }); };
  }
}

/* ── 시작 ── */
function shell(){
  const nav = NAV.map(([k, n]) => `<a class="nav" href="#/${k}" data-v="${k}">${n}</a>`).join('');
  $('#app').innerHTML = `<aside class="side"><a class="logo" href="#/home">마음한편</a>${nav}<a class="me" href="#/me"><img src="/maum/character.png" alt=""><div><b id="meName"></b><small id="meSub"></small></div></a></aside>
    <div><div class="mtop"><span class="t">마음한편</span><button id="menuBtn">☰</button></div><main id="view"></main></div>
    ${S.demo ? `<div class="tourbar">👀 <b>둘러보기 중</b><span>예시 기록이에요. 마음껏 눌러 보세요 (저장되지 않아요)</span><a class="btn small main" href="/maum/">로그인하고 시작하기</a></div>` : ''}
    <nav class="tabs"><a href="#/test" data-v="test">테스트</a><a href="#/breath" data-v="breath">마음근력</a><a href="#/home" data-v="home" class="plus" aria-label="홈">홈</a><a href="#/dex" data-v="dex">도감</a><a href="#/ai" data-v="ai">AI 티쳐</a></nav>`;
  $('#menuBtn').onclick = () => { sheet(`<b class="unz" style="font-size:24px">메뉴</b><div class="help">${NAV.map(([k, n]) => `<a href="#/${k}"><b>${n}</b><span>›</span></a>`).join('')}</div>`); document.querySelectorAll('#sheet a').forEach(a => a.addEventListener('click', closeSheet)); };
}
function fromHash(){ const v = (location.hash.match(/^#\/(\w+)/) || [])[1];
  if (v === 'ask') { history.replaceState(null, '', '#/' + S.view); if (window.moontrHelp) window.moontrHelp.open(); else toast('문의 창을 불러오는 중이에요'); return; }
  if (v && v !== S.view) { S.view = v; S.sub = {}; if (v === 'write') { openWrite(); S.view = 'home'; } render(); } }
function boot(){
  if (/admin/.test(location.hash) || new URLSearchParams(location.search).has('admin')) return;   // 관리자 화면은 index.html 의 관리자 코드가 해요
  app = firebase.apps.find(a => a.name === 'maum') || firebase.initializeApp(FB, 'maum');   // 이름 붙은 앱: 관리자 로그인과 섞이지 않게
  auth = app.auth(); db = app.firestore();
  auth.getRedirectResult().catch(() => {});
  document.querySelectorAll('[data-login]').forEach(b => b.onclick = () => login(b.dataset.login));
  auth.onAuthStateChanged(u => {
    S.user = u;
    document.body.classList.toggle('app-on', !!u);
    $('#intro').hidden = !!u; $('#app').hidden = !u;
    if (u) { shell(); listen(u.uid); fromHash(); render(); }
    else { unsub.forEach(f => f()); unsub = []; S.col = Object.fromEntries(COLS.map(c => [c, {}])); S.set = {}; S.loaded.clear(); }
  });
  addEventListener('hashchange', fromHash);
}
/* 👀 둘러보기 (moontr.site/maum/?demo): 로그인 · 서버 없이 예시 기록으로 모든 화면을 눌러 봐요.
   쓴 것은 이 탭 메모리에만 있고 새로고침하면 사라져요. AI 마음 티쳐는 로그인해야 써요 */
function demo(){
  S.demo = true;
  const mem = {}, subs = [];
  const snapOf = path => { const docs = Object.entries(mem).filter(([k]) => k.startsWith(path + '/') && !k.slice(path.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })); return { forEach: f => docs.forEach(f) }; };
  const fire = () => subs.forEach(s => s());
  db = { collection: path => ({ onSnapshot: cb => { const f = () => cb(snapOf(path)); subs.push(f); f(); return () => {}; } }),
         doc: path => ({ onSnapshot: cb => { const f = () => cb({ exists: !!mem[path], data: () => mem[path] }); subs.push(f); f(); return () => {}; },
                         set: async v => { mem[path] = { ...v, u: 0 }; fire(); }, delete: async () => { delete mem[path]; fire(); } }) };
  window.firebase = window.firebase || {}; firebase.firestore = firebase.firestore || { FieldValue: { serverTimestamp: () => 0 } };
  const uid = 'demo', put0 = (c, k, v) => mem[`maum_users/${uid}/${c}/${k}`] = { j: JSON.stringify(v) };
  put0('settings', 'me', { consentAt: 1, nickname: '바람 수달', grade: '초4 · 초2 엄마 · 교사', mode: 'parent' });
  const now = Date.now() / 1000;
  [4, 3, 5, 4, 2, 3, 4, 5, 4, 3, 4, 5, 3, 2, 4, 5, 4, 3, 2, 4].forEach((m, i) => { const d = new Date(); d.setDate(d.getDate() - (27 - i)); put0('checkins', 'o' + i, { day: dayStart(d) / 1000, at: d / 1000, mood: m, reasons: ['일'], good: '', lineKind: 'good' }); });
  put0('found', 'f2', { no: 7, who: '주변 사람', at: now, story: '', report: [] });
  put0('practices', 'p2', { kind: 'ai', at: now - 3600, day: now, text: JSON.stringify({ t: 'other', q: '회의 때마다 내 말을 자꾸 끊는 동료가 있어', feeling: '나도 잘하고 싶어서 마음이 급해', why: '말을 끊는 건 무시라기보다 급한 마음일 수도 있어요.', tryThis: '"끝까지 말해도 될까요?" 하고 부드럽게 부탁해 봐요.', ring: '7' }) });
  [4, 5, 3, 2, 4, 4].forEach((m, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); put0('checkins', 'c' + i, { day: dayStart(d) / 1000, at: d / 1000, mood: m, reasons: ['아이'], good: '산책을 했다', lineKind: 'good' }); });
  put0('found', 'f1', { no: 3, who: '그 사람', at: now, story: '', report: [] });
  put0('tests', 't1', { kind: 'temper', scores: [72, 38, 81, 55], code: '', at: now, who: '', set: 0 });
  put0('tests', 't2', { kind: 'type16', scores: [40, 30, 35, 62], code: 'INFJ', at: now, who: '', set: 0 });
  put0('members', 'm1', { name: '첫째', role: 'child', avatar: '', order: 1, at: now });
  put0('tests', 't3', { kind: 'temper', scores: [85, 30, 60, 40], code: '', at: now, who: 'm1', set: 0 });
  put0('practices', 'p1', { kind: 'ai', at: now, day: now, text: JSON.stringify({ t: 'translate', q: '숙제가 많아서 다 짜증 나', feeling: '해야 할 게 많아서 숨이 막혀', why: '시간이 모자라 보여서 그래요.', tryThis: '제일 작은 숙제 하나부터.' }) });
  S.user = { uid, providerData: [], getIdToken: async () => '' };
  document.body.classList.add('app-on'); $('#intro').hidden = true; $('#app').hidden = false;
  shell(); listen(uid); fromHash();
  const q = new URLSearchParams(location.search);
  if (q.get('res')) { S.view = 'test'; S.sub = { result: q.get('res') }; }
  if (q.get('run')) { S.view = 'test'; S.sub = {}; startTest(q.get('run')); }
  if (q.get('match')) { S.view = 'test'; S.sub = { who: 'm1' }; render(); vMatch(members()[0]); }
  render();
}
window.MaumWeb = { boot: () => (new URLSearchParams(location.search).has('demo') && !/admin/.test(location.hash) ? demo() : boot()) };
})();
