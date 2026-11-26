/* ============================================================
   🌿 마음한편 웹 (moontr.site/maum) — 2026-11-25 1차
   · 아이폰 앱과 같은 계정 · 같은 기록: Firestore maum_users/{uid}/{묶음}/{기록 번호} 에 { j: 기록(JSON 글), u: 고친 때 }
     묶음 = checkins(마음 기록) · practices(활동 · 쓴 글 · AI 기록) · found(숨은 마음) · tests(테스트) · members(가족 · 학생) · minds(예전 마음 결)
            · reports(검사 결과지) · sheets(우리반 결과지) · settings/me(별명 · 모드 · 오늘 해 볼 것 …)
     기록 모양은 앱 CloudSync.swift 와 같아요 (날짜는 1970년부터 '초'). 앱이 열리면 웹에서 남긴 것을 받아 가요.
   · 로그인: 이름 붙은 파이어베이스 앱 'maum' (관리자 로그인과 섞이지 않게) — 구글 · 카카오 · Apple
   · AI 마음 티쳐: moontr-auth 서버 POST /maum (앱과 같은 서버 · 같은 하루 횟수)
   · 내용(테스트 문항 · 도감 · 문장 · 도움 받을 곳)은 tests.js · content.js (앱 Swift 파일에서 옮긴 것)
   ============================================================ */
(() => {
const FB = { apiKey: "AIzaSyA3CxawUPIfGeBWyffsNbCSM3ymjKHLH6o", authDomain: "moon-d528d.firebaseapp.com", projectId: "moon-d528d",
  messagingSenderId: "126636401536", appId: "1:126636401536:web:25b8a8296ec42b86f99765" };
const AI_URL = 'https://moontr-auth.bellachord.workers.dev/maum';
const COLS = ['checkins', 'practices', 'found', 'tests', 'members', 'minds', 'reports', 'sheets'];   // reports = 검사 결과지 · sheets = 우리반 결과지 (2026-11-26)
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

/* ── 마음 날씨 그림 (앱 Mood: 5 쨍쨍 · 4 맑음(작은 해, 2026-11-26 구름 뺌) · 3 흐림 · 2 비 · 1 소나기) ── */
const MOOD = { 5: ['쨍쨍', '#C9765E'], 4: ['맑음', '#E0A07A'], 3: ['흐림', '#9C978E'], 2: ['비', '#6F8FB3'], 1: ['소나기', '#3B5A85'] };
const moodName = m => (C.checkin && C.checkin.moods && C.checkin.moods[m] && C.checkin.moods[m].weatherName) || (MOOD[m] || [''])[0];
function wx(m){
  const c = (MOOD[m] || MOOD[3])[1];
  const sun = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#E7A13F"/>`;
  const cloud = f => `<path d="M7 18.5h10.2a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8 1.4A3.3 3.3 0 0 0 7 18.5z" fill="${f}"/>`;
  const drops = `<g stroke="${c}" stroke-width="1.8" stroke-linecap="round"><path d="M9 20.5l-.8 2M13 20.5l-.8 2M17 20.5l-.8 2"/></g>`;
  const body = m == 5 ? `${sun(12, 12, 5)}<g stroke="#E7A13F" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/></g>`
    : m == 4 ? `${sun(12, 12, 4.2)}<g stroke="#E7A13F" stroke-width="1.8" stroke-linecap="round"><path d="M12 4.6v1.4M12 18v1.4M4.6 12h1.4M18 12h1.4M6.8 6.8l1 1M16.2 16.2l1 1M6.8 17.2l1-1M16.2 7.8l1-1"/></g>` : m == 3 ? cloud(c) : m == 2 ? `<g transform="translate(0 -3)">${cloud(c)}</g>${drops}`
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
// 2026-11-26: 앱 ☰ 메뉴(MeView.swift MenuItems)와 같은 차례 — 마음 보고서 · 검사 결과지 · 기록 보관함 · 백업 · 보관 · 출력 | 사용 설명서 · 문의하기 · 힘들 때 도움 받을 곳
const NAV = [['home', '홈'], ['write', '마음 기록'], ['ai', 'AI 마음 티쳐'], ['breath', '마음근력'], ['test', '테스트'], ['dex', '숨은 마음 도감']];
const MENU = [[['report', '마음 보고서', 'chart', 'navy'], ['reports', '검사 결과지', 'doc', 'clay'], ['vault', '기록 보관함', 'archive', 'green'], ['backup', '백업 · 보관 · 출력', 'drive', 'sky']],
              [['guide', '사용 설명서', 'book', 'gray'], ['ask', '문의하기', 'chat', 'lavender'], ['help', '힘들 때 도움 받을 곳', 'heart', 'clay']]];
/* 📖 사용 설명서 — 앱 GuideView.swift 와 같은 글 (고칠 땐 둘 다) */
const GUIDE = [{"title": "홈 · 아래 탭", "lines": ["아래 탭: 테스트 · 마음근력 · 가운데 [홈] · AI 티쳐 · 도감.", "홈 모양은 8가지예요(앱). 맨 위 번호를 누르거나 ◀ ▶ 로 넘겨 나에게 맞는 홈을 골라요. 바탕 색은 ☰ › 모양 고르기에서 바꿔요.", "홈을 위에서 아래로 당기면 AI 마음 티쳐가 오늘 문장을 새로 써 줘요."]}, {"title": "오늘 마음 남기기", "lines": ["홈의 마음 날씨(맑음 ~ 소나기)를 누르면 기록 창이 열려요. 까닭 태그를 고르고 좋았던 점이나 나를 위로하는 한 줄을 남겨요.", "까닭 태그는 [＋ 더하기]로 직접 만들 수 있어요.", "하루에 한 번 남기는 출석부예요. 다시 누르면 오늘 기록을 고쳐요."]}, {"title": "오늘 해 볼 것 · 내려놓을 것", "lines": ["날마다 세 개씩 골라 줘요. 테스트를 하면 나에게 맞는 것으로 골라요.", "체크 칸을 누르면 체크, 화살표 단추로 다른 세 개로 바꿔요."]}, {"title": "AI 마음 티쳐", "lines": ["마음 풀기: 내 마음을 적으면 '마음의 말'로 풀어 주고, '그 사람 이해하기'는 숨은 마음 도감에서도 찾아 줘요.", "답은 '지난 기록'에 쌓이고, 고치거나 지울 수 있어요. 쓰던 글은 저절로 임시 저장돼요.", "AI 마음 티쳐는 상담 선생님이 아니에요. 많이 힘들 땐 도움 받을 곳(109 · 1388)을 이용해 주세요."]}, {"title": "마음근력", "lines": ["내 3D 캐릭터가 먼저 보여 주고 따라 해요: 발바닥 느끼기 · 얼굴 풀기 · 목 · 어깨 풀기 · 1분 호흡 등.", "감사 한 줄 · 나에게 다정하게 한 줄도 여기서 써요. 하루에 여러 번 해도 돼요."]}, {"title": "테스트", "lines": ["타고난 기질 → 살면서 다듬은 성격 → 16가지 유형 → 9가지 유형 → 마음 결 → 행동 스타일, 그리고 짧은 테스트 · 밸런스 게임.", "9가지 유형은 '1w2'처럼 보여 줘요: 앞 숫자가 바탕 번호, w 뒤가 날개 번호예요.", "다시 하면 다른 문항으로 묻고, 지난번과 얼마나 비슷한지 보여 줘요.", "위쪽 사람 칩에서 가족 · 학생을 고르면 그 사람을 떠올리며 답하고, 결과는 그 사람 칸에 따로 저장돼요. 둘 다 하면 '닮은 점 · 다른 점'을 볼 수 있어요.", "표준화된 심리검사나 진단이 아니에요."]}, {"title": "숨은 마음 도감", "lines": ["'내 주변엔 마음은 여린데 겉으로는 세 보이는 사람이 있어'처럼 적으면 그 사람의 숨은 마음을 도감에서 찾아 보고서로 알려 줘요.", "못 찾은 칸을 누르면 힌트가 나와요. 찾은 마음에는 내 메모를 남길 수 있어요."]}, {"title": "홈 화면 위젯", "lines": ["아이폰 홈 화면을 꾹 눌러 [편집] › [위젯 추가]에서 '마음한편'을 골라요.", "위젯을 누르면 앱이 열려요. 아래 점을 누르면 오늘 마음 · 오늘 해 볼 것 · 오늘의 문장 · 캐릭터 한마디로 넘어가요. 날씨를 누르면 바로 기록하고, 체크 칸은 위젯에서 바로 체크해요."]}, {"title": "마음 보고서", "lines": ["홈 맨 위 마음 보고서 카드를 누르거나 ☰ › 마음 보고서에서 봐요.", "이번 주 총평(AI 마음 티쳐) · 나는 어떤 사람? · 연속 출석 · 숨은 마음 · 마음근력 · 이번 주 마음 날씨 · 지금까지 쌓인 기분(신호등)을 한 화면에 모았어요.", "[한 달 기록 미리 보기 · 출력]으로 프린트하거나 PDF 로 저장해요."]}, {"title": "검사 결과지", "lines": ["☰ › 검사 결과지: 상담센터 · 병원 · 학교에서 받은 결과지 사진이나 PDF 를 올리면 AI 가 점수를 읽어 표로 만들어요 (12장까지).", "저장하기 전에 표가 결과지와 같은지 꼭 확인해요. 결과지 사진 · PDF 는 저장하지 않아요.", "[AI 로 풀어 보기]는 이름 없이 관계(아이 · 학생 등)와 점수만 보내 쉬운 말로 풀어 줘요. 같은 검사를 다시 받으면 '104 → 108'처럼 견줘 보여요.", "진단이 아니에요. 검사한 선생님 · 기관의 설명이 먼저예요."]}, {"title": "담임 도구 (교사 모드)", "lines": ["내 계정 › 나 소개에서 교사 › '담임이에요'를 켜고 반(예: 1학년 10반)을 적으면, 교사 모드의 홈과 테스트 탭에 담임 도구가 보여요.", "우리반 명단: 일번이 ~ 삼십번이를 한 번에 만들어요. 번호 = 명단 차례예요.", "성격 유형 입력: 학생마다 네 칸(E/I · S/N · T/F · J/P)을 눌러 넣어요. 학기 초 · 2학기 · 오늘로 나눠 'ISFJ → ESFJ'처럼 보여요.", "우리반 검사 결과지: 반 전체 결과지를 올리면 번호별 표로 정리해요. 글자로 된 PDF 는 이 기기에서 학생 이름을 지운 뒤 보내요.", "성향 묶음 · 모둠 짜기 · 나와 우리반(닮은 점 · 다른 점)도 있어요. 성격 유형은 아이를 이해하는 실마리일 뿐, 나누는 기준이 아니에요."]}, {"title": "백업 · 보관 · 출력", "lines": ["☰ › 백업 · 보관 · 출력: 기록 전부를 백업 파일(.json)로 내려받고, 그 파일로 되살릴 수 있어요. 되살리기는 지금 기록은 그대로 두고 백업의 기록을 더해요.", "아이폰 앱에서 만든 백업 파일도 웹에서 되살릴 수 있어요.", "기록 출력(한 달 · 석 달 · 전체): 마음 날씨 · 테스트 · 검사 결과 · 감사 한 줄을 프린트하거나 PDF 로 저장해요."]}, {"title": "내 계정 · 여러 기기", "lines": ["같은 로그인이면 아이폰 · 아이패드 · 웹(moontr.site/maum)에서 같은 기록이 보여요.", "구글 · 카카오 · Apple 로그인을 한 계정으로 이을 수 있어요 (내 계정 › 로그인 방법).", "별명 · 나 소개 · 캐릭터는 내 계정에서 고쳐요."]}, {"title": "힘들 때", "lines": ["☰ › 힘들 때 도움 받을 곳: 109 · 1388 · Wee클래스 등. 위험한 말이 보이면 AI로 보내지 않고 도움 받을 곳을 먼저 보여 줘요.", "학교폭력이 걱정되면 117 신고와 증거 남기는 법을 알려 줘요."]}, {"title": "문의하기", "lines": ["☰ › 문의하기: 쓰는 법 · 고칠 점을 남기면 AI 가 먼저 답하고, 만든 선생님도 확인해서 답해요."]}];
function render(){
  if (!S.user) return;
  if (!S.loaded.has('settings')) { $('#view').innerHTML = '<p class="sub" style="padding:40px">기록을 불러오고 있어요…</p>'; return; }
  // 처음: 동의 · 별명
  if (!S.set.consentAt) return renderConsent();
  if (!S.set.nickname) return renderSetup();
  const v = S.view;
  if ($('#sideClass')) $('#sideClass').innerHTML = isHomeroom() ? '<a class="nav" href="#/class" data-v="class">담임 도구</a>' : '';
  document.querySelectorAll('.side a.nav').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  $('#meName').textContent = S.set.nickname || '나'; $('#meSub').textContent = S.set.grade || '';
  const f = { home: vHome, write: vWrite, ai: vAI, breath: vBreath, test: vTest, dex: vDex, vault: vVault, me: vMe, help: vHelp, guide: vGuide,
              report: vReport, reports: vReports, class: vClass, backup: vBackup }[v] || vHome;
  // 쓰는 중인 칸은 다시 그려도 그대로 (다른 기기에서 기록이 들어와 화면이 바뀌어도)
  const ae = document.activeElement, keep = ae && ae.id && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && ae.closest('#view') ? ae.id : null;
  const pos = keep && typeof ae.selectionStart === 'number' ? ae.selectionStart : null;
  $('#view').innerHTML = f();
  bind(v);
  if (keep && $('#' + keep)) { const el = $('#' + keep); el.focus(); if (pos != null) try { el.selectionStart = el.selectionEnd = pos; } catch {} }
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
    ${reportTeaser()}
    ${mode() === 'teacher' && isHomeroom() ? `<div>${listHead('교실 마음 · 담임 도구', homeroomLabel())}${classRows()}</div>` : ''}
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
        <div class="row" style="margin-top:8px"><button class="chip" data-ai="translate">내 마음 풀어 보기</button><button class="chip" data-ai="other">그 사람 이해하기</button></div></div>
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
      ${tickHTML('goodTick', ls.get('draft.checkin', ex ? ex.good : ''), '남기기 전까지 임시 저장')}
      <button class="btn main" id="saveC" style="justify-content:center">남기기</button>`);
    document.querySelectorAll('#sheet [data-m]').forEach(b => b.onclick = () => { cur = +b.dataset.m; if (!ex) comfort = cur <= 2; draw(); });
    document.querySelectorAll('#sheet [data-t]').forEach(b => b.onclick = () => { sel.has(b.dataset.t) ? sel.delete(b.dataset.t) : sel.add(b.dataset.t); b.classList.toggle('on'); });
    document.querySelectorAll('#sheet [data-k]').forEach(b => b.onclick = () => { comfort = b.dataset.k === 'comfort'; draw(); });
    bindTick($('#good'), 'goodTick', '남기기 전까지 임시 저장', v => ls.set('draft.checkin', v));
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

/* AI 마음 티쳐: 내 마음 풀어 보기 · 그 사람 이해하기 (2026-11-25 물어보기 · 이야기는 뺐어요 — 앱과 같게. 지난 기록은 기록 보관함에 그대로) */
function vAI(){
  let tab = S.sub.tab || ls.get('aiTab', 'translate'); if (tab !== 'other') tab = 'translate';
  const tabs = [['translate', '내 마음 풀어 보기'], ['other', '그 사람 이해하기']];
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
      <div class="row" style="justify-content:space-between">${tickHTML('aiTick', draft, '임시 저장')}<button class="btn main" id="goAI"${S.sub.loading ? ' disabled' : ''}>${tab === 'ask' ? '물어보기' : '풀어 보기'}</button></div></div>
      ${S.sub.loading ? '<div class="answer"><small>AI 마음 티쳐</small>생각하고 있어요…</div>' : ''}
      ${a ? (a.error ? `<div class="box">${esc(a.error)}</div>` : `<div class="answer fade-in"><small>AI 마음 티쳐</small>${a.feeling ? `<div class="feel">“${esc(a.feeling)}”</div>` : ''}${a.analysis ? `<div><small>그 사람의 마음 분석</small><br>${esc(a.analysis)}</div>` : ''}${a.why ? `<div><small>왜 그럴까요</small><br>${esc(a.why)}</div>` : ''}${a.tryThis ? `<div><small>해 볼 것</small><br>${esc(a.tryThis).replace(/\n/g, '<br>')}</div>` : ''}${a.reply ? `<div>${esc(a.reply)}</div>` : ''}</div>
        ${a.ring && C.dex ? `<button class="box" data-dex="${a.ring}" style="border:1.5px solid var(--acc);cursor:pointer;text-align:left;font:inherit;color:inherit"><div class="eyebrow">숨은 마음 도감 · ${a.ringNew ? '새로 찾았어요!' : '이미 찾은 마음'}</div><b>No.${String(a.ring).padStart(3, '0')} ${esc((C.dex.type(a.ring) || {}).name || '')}</b><div class="sub small">보고서 보기 ›</div></button>` : ''}`) : ''}`;
  }
  return `<div class="stack fade-in"><h2 class="title">AI 마음 티쳐</h2>
    <div class="seg">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('')}</div>${body}
    ${logs.length ? `<div class="eyebrow" style="margin-top:6px">지난 기록</div>${logs.map(l => `<div class="log"><div class="h"><b>${esc(l.d.q.slice(0, 40))}${l.d.q.length > 40 ? '…' : ''}</b><span>${fromSec(l.at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span></div>
      ${l.d.feeling ? `<div class="unz" style="font-size:19px">“${esc(l.d.feeling)}”</div>` : ''}${l.d.analysis ? `<div class="small"><b>마음 분석</b> ${esc(l.d.analysis)}</div>` : ''}${l.d.why ? `<div class="small">${esc(l.d.why)}</div>` : ''}${l.d.tryThis ? `<div class="small"><b>해 볼 것</b> ${esc(l.d.tryThis)}</div>` : ''}${l.d.reply ? `<div class="small">${esc(l.d.reply)}</div>` : ''}
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
  S.sub.answer = { feeling: a.feeling, analysis: a.analysis || '', why: a.why, tryThis: a.tryThis, ring, ringNew };
  await aiLog(tab, t, { feeling: a.feeling, ...(a.analysis ? { analysis: a.analysis } : {}), why: a.why, tryThis: a.tryThis, ring: ring ? String(ring) : '' });
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
  const notes = practices().filter(p => (p.kind === 'thanks' || p.kind === 'self') && p.text).slice(0, 5);
  return `<div class="stack fade-in"><h2 class="title">마음근력</h2>
    ${rows([mrow({ icon: 'heart', tint: 'clay', title: '감사 한 줄', sub: '오늘 고마웠던 일 하나', attrs: 'data-write="thanks"', right: weekCount(['thanks']) ? badge('이번 주 ' + weekCount(['thanks']) + '번', 'clay') : '' }),
            mrow({ icon: 'hands', tint: 'lavender', title: '나에게 다정하게', sub: '친한 친구에게 하듯 나에게 한마디', attrs: 'data-write="self"', right: weekCount(['self']) ? badge('이번 주 ' + weekCount(['self']) + '번', 'lavender') : '' })])}
    ${notes.length ? `<div class="box">${notes.map(p => `<p style="margin:6px 0 0">${badge(p.kind === 'thanks' ? '감사' : '나에게', p.kind === 'thanks' ? 'clay' : 'lavender')} ${esc(p.text)}</p>`).join('')}</div>` : ''}
    ${listHead('1분 숨 고르기')}<div class="box breath"><div class="ring"><i id="bCircle"></i><span class="say" id="bSay">준비해요</span></div>
    <div class="sub" id="bLeft">원이 커지면 들이쉬고 (${inS}초), 작아지면 내쉬어요 (${outS}초)</div><button class="btn main" id="bStart">시작하기</button></div>
    <p class="sub small">3D 캐릭터 따라 하기(발바닥 느끼기 · 얼굴 풀기 · 목 · 어깨)는 아이폰 앱에서 할 수 있어요.</p></div>`;
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
    ${mode() === 'teacher' ? homeroomCard() : ''}
    ${who ? `<div class="sub small">${esc(who.name)}을(를) 떠올리며 답해요. 결과는 ${esc(who.name)} 칸에 따로 저장돼요.${tests().some(t => !t.who) && tests().some(t => t.who === who.key) ? ` <button class="btn small" id="showMatch">나와 ${esc(who.name)} 닮은 점 · 다른 점</button>` : ''}</div>` : ''}
    ${groups.map(G => `${G.g ? `<div class="eyebrow">${esc(G.g)}</div>` : ''}<div class="tcards">${G.items.map(c => `<button class="tcard" data-kind="${esc(c.kind)}"><b>${esc(c.title)}</b><small>${esc(c.sub || '')}</small>${c.minutes ? `<small>${c.minutes}분쯤</small>` : ''}${doneK.has(c.kind) ? `<span class="done t-${testTint(c.kind)}">✓ 해 봤어요 · 결과 보기</span>` : ''}</button>`).join('')}</div>`).join('')}</div>`;
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
  // 담임이 직접 적은 16가지 유형 (set -1): 문항으로 답한 게 아니라서 축마다 % 는 숨겨요 (앱 TestResults.swift 와 같게)
  if (r.kind === 'type16' && r.set === -1) {
    R.sections = (R.sections || []).map(x => x.items ? { ...x, items: x.items.filter(it => it.k !== 'axis') } : x).filter(x => x.type === 'note' || (x.items && x.items.length));
    R.sections.push({ type: 'note', text: '선생님이 직접 적은 결과예요 (문항으로 답한 결과가 아니라서 축마다 % 는 없어요).' });
  }
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
    const t = D.type(S.sub.no) || {}, fs = found.filter(f => f.no === S.sub.no);
    // 여러 사람에게서 찾았으면 사람마다 골라 봐요 (앱 RingDetail: 보고서가 있는 것만, 최근 것이 앞)
    const withRep = fs.filter(f => f.report && f.report.length === 6).sort((a, b) => b.at - a.at);
    const shown = withRep.length ? withRep[Math.min(S.sub.pick || 0, withRep.length - 1)] : null;
    const rep = shown ? shown.report : [];
    const story = shown ? ringStory(shown) : '';
    const memo = ls.get('draft.memo.' + S.sub.no, fs.map(f => f.story).filter(Boolean).join('\n'));
    const titles = (D.report || []).map(r => Array.isArray(r) ? r[0] : r);
    return `<div class="stack fade-in" style="max-width:760px"><button class="btn small" id="dexBack" style="justify-self:start">‹ 도감</button>
      <div class="answer"><small>No.${String(t.no).padStart(3, '0')} · 「${esc(t.hint || '')}」</small><div class="feel">${esc(t.name || '')}</div><div>${esc(t.line || '')}</div></div>
      ${fs.length ? `<div class="sub small">찾은 곳 · ${[...new Set(fs.map(f => f.who))].map(esc).join(' · ')} · ${fs.length}번</div>
        <div class="box" style="display:grid;gap:6px"><div class="eyebrow">내 메모 (원할 때)</div><textarea id="dexMemo" rows="2" maxlength="300" placeholder="예) 회의 때 동료 · 숙제할 때 우리 아이">${esc(memo)}</textarea>${tickHTML('memoTick', memo, '도감에 저장')}</div>` : ''}
      ${withRep.length > 1 ? `${listHead('이 마음을 찾은 사람 ' + withRep.length + '명', '눌러서 바꿔 보기')}<div class="row">${withRep.map((f, i) => `<button class="chip big${f === shown ? ' on' : ''}" data-pick="${i}"><b>${i + 1}. ${esc(f.who || '그 사람')}</b><small>${fromSec(f.at).getMonth() + 1}.${fromSec(f.at).getDate()}</small></button>`).join('')}</div>` : ''}
      ${story ? `<div class="box"><div class="eyebrow">그때 적은 이야기</div><p style="margin:6px 0 0">“${esc(story)}”</p></div>` : ''}
      ${titles.map((h, i) => `<div class="box"><div class="eyebrow">${esc(h)}</div><p style="margin:6px 0 0" class="${rep[i] ? '' : 'sub'}">${esc(rep[i] || (Array.isArray(D.report[i]) ? D.report[i][1] : ''))}</p></div>`).join('')}
      <p class="sub small">${esc(rep.length ? (D.text && D.text.reportNoteAI) || '' : (D.text && D.text.reportNoteEmpty) || '')}</p></div>`;
  }
  return `<div class="stack fade-in"><h2 class="title">숨은 마음 도감 <span class="sub small">${have.size} / ${D.total || types.length}</span></h2>
    <div class="box" style="display:grid;gap:8px"><div class="eyebrow">어떤 사람이 궁금해요?</div>
      <textarea id="dexText" rows="3" placeholder="예) 내 주변엔 마음은 여린데 겉으로는 세 보이는 사람이 있어">${esc(ls.get('draft.dex', ''))}</textarea>
      <div class="row" style="justify-content:space-between">${tickHTML('dexTick', ls.get('draft.dex', ''), '임시 저장')}<button class="btn main" id="dexGo"${S.sub.loading ? ' disabled' : ''}>${S.sub.loading ? '찾는 중…' : '도감 찾기'}</button></div></div>
    <div class="dex">${[...Array(D.total || types.length)].map((_, i) => { const no = i + 1, t = D.type(no);
      const fs = have.has(no) ? found.filter(f => f.no === no) : [];
      return have.has(no) && t ? `<button data-dex="${no}"><span class="no">No.${String(no).padStart(3, '0')}${fs.length > 1 ? ` <span class="badge fill">${fs.length}명</span>` : ''}</span>${fs.some(f => f.story) ? '<span class="memo" aria-label="메모 있음">📝</span>' : ''}<b>${esc(t.name)}</b><span class="sub small">「${esc(t.hint || '')}」</span></button>`
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
    ${rows([mrow({ icon: 'doc', tint: 'clay', title: '검사 결과지', sub: `${list('reports').length}개 · 상담센터 · 병원 · 학교 결과`, attrs: 'data-go="reports"' }), mrow({ icon: 'drive', tint: 'sky', title: '백업 · 보관 · 출력', sub: '백업 파일 · 기록 출력', attrs: 'data-go="backup"' })])}
    <div class="box"><div class="eyebrow">AI 마음 티쳐와 나눈 기록</div><p class="sub small" style="margin:6px 0 0">AI 마음 티쳐 화면 아래 '지난 기록'에 있어요.</p><button class="btn small" data-go="ai" style="margin-top:8px">보러 가기</button></div></div>`;
}

/* 내 계정 (2026-11-26 앱과 같게: 캐릭터 · 별명 · 나 소개 · 로그인 잇기만. 쌓인 기분 · 총평은 마음 보고서로) */
function vMe(){
  const names = { 'google.com': 'Google', 'oidc.kakao': '카카오', 'apple.com': 'Apple' };
  const ln = (S.user.providerData || []).map(p => names[p.providerId] || p.providerId).join(' · ');
  return `<div class="stack fade-in" style="max-width:640px"><h2 class="title">내 계정</h2>
    <div class="mehead"><img src="/maum/character.png" alt=""><div><b class="unz" style="font-size:26px">${esc(S.set.nickname || '나')}</b>
      <div>${esc(S.set.grade || '나 소개 쓰기')}</div>${ln ? `<div class="sub small">${esc(ln)} 로그인</div>` : ''}</div></div>
    ${rows([mrow({ icon: 'person', tint: 'navy', title: '캐릭터 고르기', sub: '옷 · 머리 · 액세서리는 아이폰 앱에서 골라요', attrs: 'id="avatarApp"' }),
            mrow({ icon: 'pencil', tint: 'clay', title: '별명 고치기', sub: S.set.nickname || '나', attrs: 'id="nickEdit"' }),
            mrow({ icon: 'card', tint: 'green', title: '나 소개 고치기', sub: S.set.grade || '학생 · 부모 · 교사(담임) · 직장인', attrs: 'id="gradeEdit"' })])}
    ${listHead('로그인 잇기', ln)}
    <div class="box"><p class="small" style="margin:0">구글 · 카카오 · Apple 로그인을 한 계정으로 이으면 어느 방법으로 들어와도 같은 기록이 보여요. 잇기는 아이폰 앱의 내 계정 › 로그인 방법에서 해요.</p>
      <a class="btn small" href="https://apps.apple.com/kr/app/id6838529122" target="_blank" rel="noopener" style="margin-top:10px">App Store</a></div>
    <p class="sub small">마음 날씨 · 쌓인 기분 · 총평은 홈 맨 위 마음 보고서나 메뉴의 마음 보고서에서 봐요.</p></div>`;
}
function vGuide(){
  return `<div class="stack fade-in" style="max-width:760px"><h2 class="title">마음한편을 이렇게 써요</h2>${GUIDE.map((g, i) => `<details class="box"${i ? '' : ' open'}><summary style="cursor:pointer;font-weight:700;font-size:16px">${esc(g.title)}</summary><ul style="margin:10px 0 0;padding-left:20px">${g.lines.map(l => `<li style="margin:4px 0">${esc(l.replace('아이폰 홈 화면을', '(아이폰 앱) 홈 화면을'))}</li>`).join('')}</ul></details>`).join('')}
    <p class="sub small">웹에서는 3D 캐릭터 따라 하기 · 캐릭터 고르기 · 건강 앱 · 위젯을 빼고 모두 쓸 수 있어요.</p></div>`;
}
function vHelp(){ setTimeout(() => showHelp(), 0); S.view = 'home'; return vHome(); }

/* ================================================================
   2026-11-26 더함 — 아이폰 앱에 새로 생긴 것을 웹에도
   · 마음 보고서 (앱 MeView.swift MoodReportCards · ReportTeaser)
   · 나 소개: 담임이에요 · 몇 학년 몇 반 (앱 AccountKit.swift MeTagsForm, settings.meTags 의 homeroom)
   · 검사 결과지 (앱 ProReport.swift, 묶음 reports) — 사진 · PDF 는 읽기만 하고 저장하지 않아요
   · 담임 도구 (앱 ClassHome.swift · ClassTypes.swift, 묶음 sheets · members · tests)
   · 백업 · 보관 · 출력 (앱 AppSettings.swift Backup · PrintOut.swift)
   · 저장 표시 ☑ (앱 Design.swift SaveTick)
   ================================================================ */
const SET_KEYS = ['nickname', 'grade', 'mode', 'tone', 'homeShape', 'avatar', 'quickPicks', 'myReasons', 'whoChips', 'safetyPlan', 'meTags', 'dayPlan'];   // 앱 CloudSync.settingKeys
const MOVES = ['breath', 'ground', 'face', 'neck', 'stretch', 'hands', 'eyes', 'senses', 'heart', 'body'];
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const md = s => { const d = fromSec(s); return `${d.getMonth() + 1}.${d.getDate()}`; };
const ymdDots = s => { const d = fromSec(s); return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`; };
const nav = sub => { S.sub = sub || {}; render(); window.scrollTo(0, 0); };

/* ── 그림 · 상자 조각 (앱 Design.swift: 아이콘 칸 40 · 배지 · 목록 줄 · 목록 머리) ── */
const ICON = {
  person: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20c1.4-3.8 4.3-5.6 7.5-5.6s6.1 1.8 7.5 5.6"/>',
  people: '<circle cx="9" cy="8.5" r="3.2"/><circle cx="17" cy="9.5" r="2.4"/><path d="M3 19.5c1.1-3.2 3.4-4.8 6-4.8s4.9 1.6 6 4.8M15.5 14.8c2.6-.3 4.6 1.2 5.5 4"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
  doc: '<path d="M7 3.5h7l4.5 4.5v12.5H7z"/><path d="M14 3.5V8h4.5M10 13h5.5M10 16.5h5.5"/>',
  circles: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/>',
  scale: '<path d="M12 4v16M7 20h10M5 7.5h14M5 7.5l-2.6 5.4a2.6 2.6 0 0 0 5.2 0zM19 7.5l-2.6 5.4a2.6 2.6 0 0 0 5.2 0z"/>',
  chart: '<path d="M5 20V11M10.5 20V5M16 20v-7M3 20.5h18"/>',
  archive: '<rect x="3.5" y="4.5" width="17" height="4.5" rx="1"/><path d="M5 9v10.5h14V9M10 13h4"/>',
  drive: '<path d="M12 4v10.5M7.5 10l4.5 4.5 4.5-4.5M4.5 16.5v3h15v-3"/>',
  book: '<path d="M5 5.5A2 2 0 0 1 7 3.5h12v14H7a2 2 0 0 0-2 2z"/><path d="M5 19.5v-14M9 7.5h6"/>',
  chat: '<path d="M4 5h16v10.5H9.5L5 19.5V15.5H4z"/>',
  heart: '<path d="M12 19.5s-7-4.4-7-9.6A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.3c0 5.2-7 9.6-7 9.6z"/>',
  hands: '<path d="M12 20c-4 0-7-2.6-7-6.5V9.5a1.5 1.5 0 0 1 3 0V12M8 12V6.5a1.5 1.5 0 0 1 3 0V11M11 11V5.5a1.5 1.5 0 0 1 3 0V11M14 11V7a1.5 1.5 0 0 1 3 0v6.5C17 17.4 15.6 20 12 20z"/>',
  pencil: '<path d="M4.5 19.5h4l10-10-4-4-10 10z"/><path d="M13 7l4 4"/>',
  card: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16.2c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h3.5M14.5 13.5h3.5"/>',
  shield: '<path d="M12 3.5l7 2.8v5.3c0 4.3-3 7.4-7 8.9-4-1.5-7-4.6-7-8.9V6.3z"/>',
  out: '<path d="M10 4.5H5v15h5M14.5 8l4 4-4 4M18.5 12H9"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M6.5 7l1 13h9l1-13"/>',
  leaf: '<path d="M5 19c0-8.5 5.5-13.5 14.5-14.5C19.5 13.5 14 19 5 19zM5 19l7-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  print: '<path d="M7 9V4h10v5M7 17H4.5V9.5h15V17H17M7 14h10v6H7z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
};
const ico = k => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ICON.circles}</svg>`;
const tile = (k, t = 'navy') => `<span class="itile t-${t}">${ico(k)}</span>`;
const badge = (txt, t = 'navy', fill) => `<span class="badge t-${t}${fill ? ' fill' : ''}">${esc(txt)}</span>`;
const mrow = ({ icon, tint, title, sub, right = '', attrs = '', chevron = true }) =>
  `<button class="mrow" ${attrs}>${tile(icon, tint)}<span class="mt"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>${right}${chevron ? '<i class="chev">›</i>' : ''}</button>`;
const listHead = (t, r = '') => `<div class="lhead"><b>${esc(t)}</b>${r ? `<span>${esc(r)}</span>` : ''}</div>`;
const rows = arr => `<div class="mlist">${arr.join('')}</div>`;
/* 테스트마다 같은 색 (앱 Tint.test: 기질 흙빛 · 성격 보라 · 16유형 초록 · 9유형 남색 · 마음 결 하늘 · 행동 회색) */
const testTint = k => ({ temper: 'clay', character: 'lavender', type16: 'green', nine: 'navy', mind: 'sky', disc: 'gray' }[k] || (String(k).startsWith('mini') ? 'green' : 'gray'));

/* ── ☑ 저장 표시 (앱 SaveTick: 쓰면 잠깐 '저장 중…' → '저장됨') ── */
function tickInner(text, note, saving){
  const empty = !String(text || '').trim();
  return empty ? '<span class="bx"></span><span class="sub">쓰면 저절로 저장돼요</span>'
    : saving ? '<span class="bx dash"></span><span class="sub">저장 중…</span>'
    : `<span class="bx on"></span><b>저장됨</b><span class="sub"> · ${esc(note)}</span>`;
}
const tickHTML = (id, text, note) => `<span class="tick" id="${id}" aria-live="polite">${tickInner(text, note, false)}</span>`;
function bindTick(el, id, note, save){
  if (!el) return; let tm;
  el.addEventListener('input', () => {
    if (save) save(el.value);
    const t = $('#' + id); if (!t) return;
    t.innerHTML = tickInner(el.value, note, true); clearTimeout(tm);
    tm = setTimeout(() => { const t2 = $('#' + id); if (t2) t2.innerHTML = tickInner(el.value, note, false); }, 600);
  });
}

/* ── 여러 기록 한 번에 저장 (명단 · 되살리기) ── */
async function putMany(list){
  if (!list.length) return;
  for (const [c, k, r] of list) S.col[c][k] = r;
  render();
  const u = firebase.firestore.FieldValue.serverTimestamp();
  if (db.batch) {
    for (let i = 0; i < list.length; i += 400) {
      const b = db.batch();
      for (const [c, k, r] of list.slice(i, i + 400)) b.set(ref(c, k), { j: JSON.stringify(sortKeys(r)), u });
      await b.commit();
    }
  } else for (const [c, k, r] of list) await ref(c, k).set({ j: JSON.stringify(sortKeys(r)), u });
}

/* ── 출력 (앱 PrintOut: A4 글 → 여기서는 미리 보기 + 브라우저 인쇄 · PDF 로 저장) ── */
function printDoc(html){
  let a = $('#printArea'); if (!a) { a = document.createElement('div'); a.id = 'printArea'; document.body.append(a); }
  a.innerHTML = `<div class="pdoc">${html}</div>`;
  sheet(`<b style="font-size:18px">미리 보기</b><div class="pprev"><div class="pdoc">${html}</div></div>
    <button class="btn main" id="doPrint" style="justify-content:center">${ico('print')}출력 · PDF 로 저장</button>
    <p class="sub small" style="margin:0">인쇄 창에서 대상(프린터)을 'PDF로 저장'으로 고르면 파일로 남아요.</p>`);
  $('#doPrint').onclick = () => { document.body.classList.add('printing'); setTimeout(() => window.print(), 50); };
}
addEventListener('afterprint', () => document.body.classList.remove('printing'));
const pesc = t => esc(t).replace(/\n/g, '<br>');

/* ── 나 소개 (settings.meTags = {roles, grade, kids, parent, homeroom}) ── */
function meTags(){
  let t = {}; try { t = JSON.parse(S.set.meTags || '{}') || {}; } catch {}
  return { roles: t.roles || [], grade: t.grade || '', kids: t.kids || [], parent: t.parent || '엄마', homeroom: t.homeroom || '' };
}
const isHomeroom = () => { const t = meTags(); return t.roles.includes('teacher') && !!t.homeroom; };
const homeroomLabel = () => { const h = meTags().homeroom; return h === '담임' ? '담임' : h ? h + ' 담임' : ''; };
function tagsText(t){
  return t.roles.map(r => r === 'student' ? (t.grade || '학생') : r === 'parent' ? (t.kids.length ? t.kids.join(' · ') + ' ' + t.parent : t.parent)
    : r === 'teacher' ? (!t.homeroom ? '교사' : t.homeroom === '담임' ? '담임 교사' : t.homeroom + ' 담임') : r === 'worker' ? '직장인' : '').filter(Boolean).join(' · ');
}
function editMe(){
  const t = meTags(); if (!t.roles.length && mode() !== 'all') t.roles = [mode()];
  const KG = ['유아', '초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3', '대학생', '성인'];
  const MG = ['초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3', '대학생'];
  const chip = (txt, on, attr) => `<button class="chip${on ? ' on' : ''}" ${attr}>${esc(txt)}${on ? ' ✓' : ''}</button>`;
  const draw = () => {
    const tc = t.roles.includes('teacher'), hr = !!t.homeroom;
    sheet(`<b style="font-size:18px">나 소개 고치기</b>
      <div class="box in2"><div class="eyebrow">이렇게 보여요</div><b class="unz" style="font-size:24px" id="mePrev">${esc(tagsText(t) || '아래에서 골라 주세요')}</b></div>
      <div class="eyebrow">나는 (여러 개 골라도 돼요)</div><div class="row">${[['student', '학생'], ['parent', '부모'], ['teacher', '교사'], ['worker', '직장인']].map(([k, n]) => chip(n, t.roles.includes(k), `data-role="${k}"`)).join('')}</div>
      ${t.roles.includes('student') ? `<div class="eyebrow">내 학년</div><div class="row">${MG.map(g => chip(g, t.grade === g, `data-mg="${g}"`)).join('')}</div>` : ''}
      ${tc ? `<div class="eyebrow">담임 (켜면 교실 마음에 담임 도구가 보여요)</div><div class="row">${chip('담임이에요', hr, 'id="hrOn"')}</div>
        ${hr ? `<input type="text" id="hrTxt" maxlength="12" placeholder="몇 학년 몇 반? 예) 1학년 10반" value="${esc(t.homeroom === '담임' ? '' : t.homeroom)}">` : ''}` : ''}
      ${t.roles.includes('parent') ? `<div class="eyebrow">나는</div><div class="row">${['엄마', '아빠', '보호자'].map(w => chip(w, t.parent === w, `data-pw="${w}"`)).join('')}</div>
        <div class="eyebrow">아이 학년 (아이마다 하나씩 · 누른 순서대로)</div><div class="row">${KG.map(g => chip(g, t.kids.includes(g), `data-kg="${g}"`)).join('')}</div>` : ''}
      <p class="sub small" style="margin:0">고른 것은 내 계정 화면에만 보여요. 홈 위쪽 모드 단추로 지금 볼 모드를 따로 바꿀 수 있어요.</p>
      <div class="row"><button class="btn main" id="meSave">저장</button><button class="btn" id="meNo">그만</button></div>`);
    document.querySelectorAll('#sheet [data-role]').forEach(b => b.onclick = () => { const k = b.dataset.role; t.roles = t.roles.includes(k) ? t.roles.filter(x => x !== k) : [...t.roles, k]; draw(); });
    document.querySelectorAll('#sheet [data-mg]').forEach(b => b.onclick = () => { t.grade = t.grade === b.dataset.mg ? '' : b.dataset.mg; draw(); });
    document.querySelectorAll('#sheet [data-pw]').forEach(b => b.onclick = () => { t.parent = b.dataset.pw; draw(); });
    document.querySelectorAll('#sheet [data-kg]').forEach(b => b.onclick = () => { const g = b.dataset.kg; t.kids = t.kids.includes(g) ? t.kids.filter(x => x !== g) : [...t.kids, g]; draw(); });
    if ($('#hrOn')) $('#hrOn').onclick = () => { t.homeroom = t.homeroom ? '' : '담임'; draw(); if ($('#hrTxt')) $('#hrTxt').focus(); };
    if ($('#hrTxt')) $('#hrTxt').oninput = e => { const v = e.target.value.trim(); t.homeroom = v ? v.slice(0, 12) : '담임'; $('#mePrev').textContent = tagsText(t) || '아래에서 골라 주세요'; };
    $('#meNo').onclick = closeSheet;
    $('#meSave').onclick = () => {
      const patch = { meTags: JSON.stringify(sortKeys(t)), grade: tagsText(t) };
      const modes = t.roles.filter(r => ['student', 'parent', 'teacher', 'worker'].includes(r));
      if (modes.length && !modes.includes(mode()) && mode() !== 'all') patch.mode = modes[0];
      closeSheet(); saveSet(patch); toast('나 소개를 고쳤어요');
    };
  };
  draw();
}

/* ── 감사 한 줄 · 나에게 다정하게 (앱 TrainView.swift WriteView, practices kind thanks · self) ── */
function openNote(kind){
  const th = kind === 'thanks', key = th ? 'draft.thanks' : 'draft.self', text = ls.get(key, '');
  sheet(`<div class="eyebrow">${th ? '감사 한 줄 쓰기' : '나에게 다정하게 한 줄 쓰기'}</div><b class="unz" style="font-size:26px">${th ? '오늘 고마웠던 일 하나는?' : '힘들었던 나에게, 친한 친구에게 하듯 한마디'}</b>
    <textarea id="noteText" rows="3" maxlength="300" placeholder="${th ? '예) 급식에 좋아하는 반찬이 나왔다' : '예) 오늘 많이 애썼어. 실수해도 괜찮아'}">${esc(text)}</textarea>
    ${tickHTML('noteTick', text, '남기기 전까지 임시 저장')}<button class="btn main" id="noteSave" style="justify-content:center">남기기</button>`);
  bindTick($('#noteText'), 'noteTick', '남기기 전까지 임시 저장', v => ls.set(key, v));
  $('#noteText').focus();
  $('#noteSave').onclick = async () => {
    const t = $('#noteText').value.trim(); if (!t) return toast('한 줄을 적어 주세요');
    const now = new Date(); closeSheet(); ls.set(key, '');
    await put('practices', uuid(), { kind, at: sec(now), day: sec(dayStart(now)), text: t });
    toast('남겼어요'); safetyGate(t);
  };
}

/* ── 숨은 마음 도감: 내 메모 · 그때 적은 이야기 (앱 RingDetail) ── */
function ringStory(f){
  const p = practices().find(p => { if (p.kind !== 'ai') return false; try { const d = JSON.parse(p.text); return d.ring === String(f.no) && Math.abs(p.at - f.at) < 600; } catch { return false; } });
  try { return p ? JSON.parse(p.text).q || '' : ''; } catch { return ''; }
}
async function saveRingMemo(no, text){
  const fs = list('found').filter(f => f.no === no); if (!fs.length) return;
  const t = String(text || '').trim(), out = [];
  fs.forEach((f, i) => { const story = i === 0 ? t : ''; if ((f.story || '') !== story) { const { key, ...rec } = f; out.push(['found', key, { ...rec, story }]); } });
  try { localStorage.removeItem('maum.draft.memo.' + no); } catch {}
  await putMany(out);
}

/* ================= 📊 마음 보고서 ================= */
const moveWeek = () => weekCount(MOVES);
function reviewText(){ const r = String(ls.get('aiReview', '')), p = ymd() + '|'; return r.startsWith(p) ? r.slice(p.length) : null; }
let reviewAsked = false;
function askReview(){   // 이번 주 총평: 숫자만 보내 AI 마음 티쳐에게 받기 (하루 한 번, 앱과 같은 task 'review')
  if (reviewAsked || reviewText() || S.demo || !S.user || !S.loaded.has('checkins') || !S.loaded.has('tests')) return;
  if (!lastDays(7).some(Boolean)) return;
  reviewAsked = true;
  const types = [], m = list('minds').sort((a, b) => b.at - a.at)[0], t16 = myTest('type16');
  if (m && T) types.push(T.data.mind.kinds[top(m.scores)]);
  if (t16) types.push(t16.code);
  ai('review', { week: lastDays(7).map(c => c ? c.mood : 0), moves: moveWeek(), streak: streak(), types }).then(a => {
    if (a && !a.error && a.text) { ls.set('aiReview', ymd() + '|' + a.text); render(); }
  });
}
function reviewFallback(){
  const w = lastDays(7).filter(Boolean);
  if (!w.length) return '이번 주는 아직 기록이 없어요. 오늘 마음 날씨부터 한 번 골라 볼까요?';
  const sunny = w.filter(c => c.mood >= 4).length, rainy = w.filter(c => c.mood <= 2).length, mv = moveWeek();
  let s = `이번 주 ${w.length}일 출석했어요. 맑은 날 ${sunny}번` + (rainy > 0 ? `, 비 온 날 ${rainy}번이었어요.` : '이었어요.');
  if (mv > 0) s += ` 몸 풀기와 숨 고르기를 ${mv}번 했어요.`;
  if (rainy >= 2) s += ' 힘든 날에도 기록을 이어 간 게 대단해요. 오늘은 어깨 힘을 한 번 툭 빼 봐요.';
  else if (sunny >= Math.floor(w.length / 2) && sunny > 0) s += ' 좋은 날이 많았던 한 주예요. 그 이유를 한 줄 남겨 두면 다음 주에 힘이 돼요.';
  else s += ' 날씨가 바뀌어도 괜찮아요. 하루 한 번 나를 살핀 것만으로 충분해요.';
  return s;
}
/* 홈 맨 위 요약 카드 — 누르면 마음 보고서 */
function reportTeaser(){
  askReview();
  const w = lastDays(7).filter(Boolean), from = dayStart(new Date(Date.now() - 6 * 864e5));
  const acts = practices().filter(p => fromSec(p.day) >= from && !['ai', 'page', 'hurtlog'].includes(p.kind)).length;
  const txt = reviewText() || (w.length ? `이번 주 ${w.length}일 출석 · 맑은 날 ${w.filter(c => c.mood >= 4).length}번 · 비 온 날 ${w.filter(c => c.mood <= 2).length}번이에요.` : '이번 주는 아직 기록이 없어요. 오늘 마음 날씨부터 골라 볼까요?');
  return `<button class="box teaser" data-go="report"><span class="th"><b>${ico('chart')}마음 보고서</b><span class="sub small">이번 주 · 전체 보기 ›</span></span>
    <span class="tt">${esc(txt)}</span>
    <span class="minis"><span><b>${streak()}일째</b><small>연속 출석</small></span><span><b>${new Set(list('found').map(f => f.no)).size}개</b><small>숨은 마음</small></span><span><b>${acts}번</b><small>이번 주 활동</small></span></span></button>`;
}
function myTypeRows(){
  if (!T) return [];
  const out = [], line = (k, t) => { try { return T.line(k, t.scores, t.code); } catch { return ''; } };
  const m = list('minds').sort((a, b) => b.at - a.at)[0], mt = myTest('mind');
  if (m) out.push(['마음 결', T.data.mind.kinds[top(m.scores)], m.at, 'mind']); else if (mt) out.push(['마음 결', line('mind', mt), mt.at, 'mind']);
  const te = myTest('temper'), ch = myTest('character');
  if (te) {
    if (ch) { const P = (T.data.raw.temperProfile || []).find(p => p[0] === top(te.scores) && p[1] === 4 + top(ch.scores)); out.push(['나의 별명', P ? P[2] : (T.data.raw.temperProfileDefault || ['나만의 결'])[0], Math.max(te.at, ch.at), 'temper']); }
    else out.push(['타고난 기질', line('temper', te), te.at, 'temper']);
  }
  for (const [k, n] of [['type16', '16가지 유형'], ['nine', '9가지 유형'], ['disc', '행동 스타일']]) { const t = myTest(k); if (t) { const l = line(k, t); if (l) out.push([n, l.replace(' · ', ' '), t.at, k]); } }
  return out;
}
function vReport(){
  const all = checkins(), days = new Set(all.map(c => ymd(fromSec(c.day))));
  const week = lastDays(7), found = new Set(list('found').map(f => f.no));
  const moves = practices().filter(p => MOVES.includes(p.kind));
  const types = myTypeRows(), aiT = reviewText();
  askReview();
  // 지금까지 쌓인 기분 — 하루에 하나 (앱 Stats.byDay)
  const by = {}; for (const c of all) { const k = ymd(fromSec(c.day)); if (!by[k]) by[k] = c; }
  const vals = Object.values(by), n = Math.max(1, vals.length);
  const lights = [['빨강 · 힘든 날', '#D9553F', vals.filter(c => c.mood <= 2).length], ['노랑 · 그저 그런 날', '#E6A93A', vals.filter(c => c.mood === 3).length], ['초록 · 좋은 날', '#3E9E63', vals.filter(c => c.mood >= 4).length]];
  const most = lights.reduce((a, b) => b[2] > a[2] ? b : a, lights[0]);
  const hex = (h, a) => { const v = parseInt(h.slice(1), 16); return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`; };
  return `<div class="stack fade-in" style="max-width:760px"><h2 class="title">마음 보고서</h2>
    <div class="box"><div class="bh">이번 주 총평</div><p class="unz" style="font-size:21px;line-height:1.5;margin:8px 0 6px">${esc(aiT || reviewFallback())}</p><div class="sub small">${aiT ? 'AI 마음 티쳐가 이번 주 기록을 보고 썼어요' : '이번 주 기록으로 쓴 총평이에요'}</div></div>
    <div class="box"><div class="bh">나는 어떤 사람?</div>${types.length ? types.map(([k, v, at, kind]) => `<div class="trow2"><span class="sub">${esc(k)}</span><b class="unz">${esc(v)}</b>${badge(md(at), testTint(kind))}</div>`).join('') : '<p class="sub" style="margin:6px 0 0">아직 테스트를 하지 않았어요. 아래 탭 \'테스트\'에서 해 봐요.</p>'}</div>
    <div class="stats3"><div class="box"><small>연속 출석</small><b>${streak()}일째</b><small>총 ${days.size}일</small></div><div class="box"><small>숨은 마음</small><b>${found.size}개</b><small>${(C.dex && C.dex.total) || 100}개 중</small></div><div class="box"><small>마음근력</small><b>${moveWeek()}번</b><small>이번 주 · 총 ${moves.length}번</small></div></div>
    <div class="box"><div class="bh">이번 주 마음 날씨</div>
      <div class="wchart"><div class="yax"><span>맑음</span><span>흐림</span><span>비</span></div><div class="wbars">${week.map((c, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return `<div class="wb"><div class="col"><i style="height:${c ? c.mood / 5 * 100 : 0}%;background:${c ? (MOOD[c.mood] || MOOD[3])[1] : 'transparent'}"></i></div><span class="ic">${c ? wx(c.mood) : '<span class="none"></span>'}</span><small>${WD[d.getDay()]}</small></div>`; }).join('')}</div></div></div>
    <div class="box"><div class="bh row" style="justify-content:space-between"><span>지금까지 쌓인 기분</span><span class="sub small">${vals.length}일</span></div>
      <div class="signal">${lights.map(([nm, col, k]) => { const sh = k / n; return `<div><span class="lamp" style="background:${hex(col, vals.length ? .18 + .82 * sh : .15)};box-shadow:0 0 ${Math.round(20 * sh)}px ${hex(col, sh * .7)};color:${sh > .3 ? '#fff' : '#E8EAED'}" aria-label="${nm} ${k}일">${k}</span><small>${Math.round(sh * 100)}%</small></div>`; }).join('')}</div>
      <div class="legend">${lights.map(([nm, col]) => `<span><i style="background:${col}"></i>${nm}</span>`).join('')}</div>
      ${most[2] > 0 ? `<p style="margin:10px 0 0">${most[0].startsWith('초록') ? '초록불이 가장 많이 켜졌어요. 좋은 날이 쌓이고 있어요.' : most[0].startsWith('노랑') ? '노란불이 많았어요. 천천히 가도 괜찮아요.' : '빨간불이 많았어요. 잠깐 멈춰 쉬어 가요. 힘들면 도움을 청해도 돼요.'}</p>` : ''}</div>
    <button class="box bigbtn" id="printMonth">${ico('print')}한 달 기록 미리 보기 · 출력</button></div>`;
}

/* 기록 모아 보기 출력 (앱 PrintOut.records) */
function recordsHTML(fromS){
  const cs = checkins().filter(c => c.day >= fromS).sort((a, b) => a.day - b.day);
  const ts = tests().filter(t => t.at >= fromS).sort((a, b) => a.at - b.at);
  const rp = list('reports').sort((a, b) => b.day - a.day);
  const notes = practices().filter(p => p.at >= fromS && ['thanks', 'self'].includes(p.kind) && p.text).sort((a, b) => a.at - b.at);
  let h = `<div class="sub">마음한편 · ${esc(S.set.nickname || '나')}</div><h1>내 마음 기록</h1><div class="sub">${fromS > 0 ? ymdDots(fromS) : '처음'} ~ ${ymdDots(sec(new Date()))}</div>`;
  h += `<h2>마음 날씨 ${cs.length}일</h2>`;
  h += cs.length ? `<table><tr><th>날짜</th><th>마음</th><th>까닭</th><th>한 줄</th></tr>${cs.map(c => { const d = fromSec(c.day); return `<tr><td style="white-space:nowrap">${d.getMonth() + 1}. ${d.getDate()}. (${WD[d.getDay()]})</td><td>${esc(moodName(c.mood))}</td><td>${esc((c.reasons || []).join(', '))}</td><td>${pesc(c.good || '')}</td></tr>`; }).join('')}</table>` : '<p class="sub">이 기간에 남긴 기록이 없어요.</p>';
  if (ts.length && T) {
    h += `<h2>테스트 결과</h2><table><tr><th>날짜</th><th>누구</th><th>테스트</th><th>결과</th></tr>`;
    for (const t of ts) { let ti = '', li = ''; try { ti = T.title(t.kind); li = T.line(t.kind, t.scores, t.code); } catch {} if (ti) h += `<tr><td>${ymdDots(t.at)}</td><td>${esc(whoName(t.who))}</td><td>${esc(ti)}</td><td>${esc(li)}</td></tr>`; }
    h += '</table>';
  }
  if (rp.length) {
    h += '<h2>전문 검사 결과</h2>';
    for (const r of rp) { const a = reportAI(r); h += `<p><b>${esc(r.title)}</b> <span class="sub">${esc(whoName(r.who))} · ${ymdDots(r.day)} · ${esc(r.org)}</span><br>${(r.rows || []).slice(0, 30).map(x => `${esc(x.name)} ${esc(x.score)}`).join(' · ')}${a && a.summary ? `<br><span class="sub">AI 풀이: ${esc(a.summary)}</span>` : ''}</p>`; }
  }
  if (notes.length) h += `<h2>감사 · 나에게 다정하게</h2><ul>${notes.map(n => `<li><span class="sub">${md(n.at)}</span> ${esc(n.text)}</li>`).join('')}</ul>`;
  return h + `<div class="note">${ymdDots(sec(new Date()))} 마음한편에서 출력했어요. 진단 자료가 아니에요.</div>`;
}
const monthsAgo = n => { const d = new Date(); d.setMonth(d.getMonth() - n); return sec(d); };

/* ================= 📋 검사 결과지 (앱 ProReport.swift) ================= */
const whoName = k => !k ? '나' : ((members().find(m => m.key === k) || {}).name || '가족');
const whoForAI = k => { const m = k && members().find(x => x.key === k); return m ? (T && T.Role ? T.Role.title(m.role) : '가족') : '나 (어른)'; };   // AI 에는 이름 없이 관계만
const reportAI = r => { try { return r.ai ? JSON.parse(r.ai) : null; } catch { return null; } };
const scoreVal = s => { const m = String(s || '').replace(/,/g, '.').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
/* 막대로 그릴 범위 [아래, 위, 평균] — 앱 ScoreRow.scale 과 같은 규칙. 모르는 점수 종류면 null (숫자만) */
function scaleOf(r){
  const v = scoreVal(r.score); if (v == null) return null;
  const k = ((r.kind || '') + ' ' + (r.score || '')).toUpperCase();
  if (k.includes('백분위') || k.includes('%')) return [0, 100, 50];
  if (k.includes('T')) return [20, 90, 50];
  if (k.includes('환산')) return [1, 19, 10];
  if (k.includes('지표') || k.includes('IQ') || k.includes('지능') || k.includes('표준') || k.includes('합산') || (v >= 40 && v <= 160)) return [40, 160, 100];
  return null;
}
function scoreBar(r){
  const s = scaleOf(r), v = scoreVal(r.score); if (!s || v == null) return '';
  const f = x => (Math.min(Math.max(x, s[0]), s[1]) - s[0]) / (s[1] - s[0]) * 100;
  return `<div class="sbar" aria-label="평균 ${s[2]}, 점수 ${v}"><i style="width:max(6px,${f(v)}%)"></i><b style="left:${f(s[2])}%"></b></div>`;
}
const reportsOf = () => list('reports').sort((a, b) => b.day - a.day);
const beforeOf = r => list('reports').filter(x => x.key !== r.key && x.who === r.who && x.title === r.title && x.day < r.day).sort((a, b) => a.day - b.day).pop() || null;

function vReports(){
  const s = S.sub;
  if (s.edit) return vReportEdit();
  if (s.add) return vReportAdd();
  if (s.id) return vReportDetail();
  const all = reportsOf(), people = [['', '나'], ...members().map(m => [m.key, m.name])];
  const classOK = mode() === 'teacher' || members().some(m => m.role === 'student');
  return `<div class="stack fade-in" style="max-width:760px"><h2 class="title">검사 결과지</h2>
    ${rows([mrow({ icon: 'doc', tint: 'clay', title: '결과지 올리기', sub: '사진 · PDF → AI 가 점수를 읽어 표로', attrs: 'id="rAdd"' }),
            ...(classOK ? [mrow({ icon: 'people', tint: 'green', title: '우리반 전체 결과지', sub: '반 전체가 한 파일에 든 결과지', attrs: 'data-cls="sheets"' })] : [])])}
    <p class="sub small" style="margin:0">상담센터 · 병원 · 학교에서 받은 검사 결과지를 올리면 AI 가 점수를 읽어 표로 만들고, 쉬운 말로 풀어 줘요. 결과지 사진은 저장하지 않아요.</p>
    ${people.map(([k, n]) => { const l = all.filter(r => (r.who || '') === k); return l.length ? `${listHead(n, l.length + '개')}${rows(l.map(r => mrow({ icon: 'doc', tint: 'clay', title: r.title || '검사 결과', sub: `${ymdDots(r.day)} · ${r.org || '기관 모름'} · 척도 ${(r.rows || []).length}개`, attrs: `data-rid="${r.key}"`, right: reportAI(r) ? badge('AI 풀이', 'navy') : '' })))}` : ''; }).join('')}
    ${all.length ? '' : '<div class="box sub">아직 올린 결과지가 없어요.</div>'}</div>`;
}
function vReportAdd(){
  const A = S.sub.add, classOK = mode() === 'teacher' || members().some(m => m.role === 'student');
  return `<div class="stack fade-in" style="max-width:640px"><button class="btn small" data-rback style="justify-self:start">‹ 검사 결과지</button><h2 class="title">결과지 올리기</h2>
    ${listHead('누구의 결과지인가요?')}<div class="row"><button class="chip${A.who ? '' : ' on'}" data-rwho="">나</button>${members().map(m => `<button class="chip${A.who === m.key ? ' on' : ''}" data-rwho="${m.key}">${esc(m.name)}</button>`).join('')}<button class="chip" id="rMember">＋ 가족 · 학생</button>${classOK ? '<button class="chip" data-cls="sheetAdd">우리반 전체</button>' : ''}</div>
    ${listHead('결과지')}<div class="box" style="display:grid;gap:10px">
      <label class="btn" style="justify-content:center">${ico('plus')}사진 · PDF 고르기<input type="file" id="rFiles" accept="image/*,application/pdf" multiple hidden></label>
      ${A.files.length ? `<div class="row" style="justify-content:space-between"><span>고른 결과지 ${A.files.length}장</span><button class="btn small" id="rClear">비우기</button></div>` : ''}
      <p class="sub small" style="margin:0">점수가 보이게 한 장씩 반듯하게 찍어요. 12장까지. 이름 · 생년월일은 가리고 찍어도 돼요.</p></div>
    <div class="row"><button class="btn main" id="rRead"${A.files.length && !A.busy ? '' : ' disabled'}>${A.busy ? 'AI 가 결과지를 읽고 있어요…' : 'AI 로 점수 읽기'}</button><button class="btn" id="rHand">직접 적기</button></div>
    ${A.error ? `<p class="err">${esc(A.error)}</p>` : '<p class="sub small" style="margin:0">결과지는 글자를 읽기 위해 Anthropic(Claude)의 AI로 보내지고, 읽은 뒤 저장하지 않아요. AI 가 잘못 읽을 수 있으니 저장 전에 꼭 확인해요.</p>'}</div>`;
}
function vReportEdit(){
  const E = S.sub.edit, r = E.rec;
  return `<div class="stack fade-in" style="max-width:720px"><button class="btn small" data-rcancel style="justify-self:start">‹ 그만두기</button><h2 class="title">${E.isNew ? '확인하고 저장' : '고치기'}</h2>
    ${listHead('검사')}<div class="box form"><label>검사 이름<input type="text" data-rf="title" value="${esc(r.title)}" placeholder="예: K-WISC-V"></label>
      <label>검사한 곳<input type="text" data-rf="org" value="${esc(r.org)}" placeholder="예: 상담센터"></label>
      <label>검사 날짜<input type="date" data-rf="date" value="${ymd(fromSec(r.day))}"></label></div>
    ${listHead('척도 · 점수 ' + r.rows.length + '개', '결과지와 같은지 꼭 확인해요')}
    <div class="box erows">${r.rows.map((x, i) => `<div class="erow"><input type="text" data-rr="${i}|name" value="${esc(x.name)}" placeholder="척도" class="nm"><input type="text" data-rr="${i}|score" value="${esc(x.score)}" placeholder="점수" class="sc">
      <input type="text" data-rr="${i}|kind" value="${esc(x.kind)}" placeholder="점수 종류 (T점수 · 백분위)"><input type="text" data-rr="${i}|band" value="${esc(x.band)}" placeholder="수준"><button class="xbtn" data-rdel="${i}" aria-label="이 줄 지우기">✕</button></div>`).join('')}
      <button class="btn small" id="rRow" style="justify-self:start">${ico('plus')}척도 더하기</button></div>
    ${listHead('결과지 소견 · 내 메모')}<div class="box"><textarea data-rf="memo" rows="4" placeholder="소견 요약이나 메모">${esc(r.memo)}</textarea></div>
    <button class="btn main" id="rSave" style="justify-content:center">저장</button></div>`;
}
function vReportDetail(){
  const r = S.col.reports[S.sub.id]; if (!r) return '<p class="sub">결과지를 불러오는 중…</p>';
  const R = { key: S.sub.id, ...r }, b = beforeOf(R), a = reportAI(r);
  const prev = {}; (b ? b.rows || [] : []).forEach(x => { if (!(x.name in prev)) prev[x.name] = x.score; });
  const order = []; (r.rows || []).forEach(x => { if (!order.includes(x.group || '')) order.push(x.group || ''); });
  const part = (t, l) => l && l.length ? `<div class="aipart"><b>${esc(t)}</b><ul>${l.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  const busy = S.sub.busy;
  return `<div class="stack fade-in" style="max-width:760px"><div class="row" style="justify-content:space-between"><button class="btn small" data-rback>‹ 검사 결과지</button>
      <span class="row"><button class="btn small" id="rEdit">고치기</button><button class="btn small" id="rPrint">${ico('print')}출력</button><button class="btn small" id="rDel">지우기</button></span></div>
    <div><div class="sub small">${esc(whoName(r.who))} · ${ymdDots(r.day)} · ${esc(r.org || '기관 모름')}</div><h2 class="title" style="margin:2px 0 0">${esc(r.title || '검사 결과')}</h2></div>
    <div class="box"><div class="bh row" style="justify-content:space-between"><span>척도 · 점수</span>${b ? `<span class="sub small">지난번 ${fromSec(b.day).getFullYear()}. ${fromSec(b.day).getMonth() + 1}.과 견줘요</span>` : ''}</div>
      ${order.map(g => `${g ? `<div class="eyebrow" style="margin-top:12px">${esc(g)}</div>` : ''}${(r.rows || []).filter(x => (x.group || '') === g).map(x => `<div class="srow"><div class="sh"><b>${esc(x.name)}</b><span>${prev[x.name] != null && prev[x.name] !== x.score ? `<small class="sub">${esc(prev[x.name])} →</small> ` : ''}<b class="num">${esc(x.score)}</b></span></div>${scoreBar(x)}${x.kind || x.band ? `<div class="sub small">${esc([x.kind, x.band].filter(Boolean).join(' · '))}</div>` : ''}</div>`).join('')}`).join('')}</div>
    ${r.memo ? `<div class="box"><div class="bh">결과지 소견 · 메모</div><p style="margin:6px 0 0">${pesc(r.memo)}</p></div>` : ''}
    <div class="box"><div class="bh row" style="justify-content:space-between"><span>AI 로 풀어 보기</span>${a && !busy ? '<button class="btn small" id="rAI">다시</button>' : ''}</div>
      ${busy ? '<p class="sub">AI 가 결과를 쉬운 말로 풀고 있어요…</p>' : a ? `<p style="margin:8px 0 0">${esc(a.summary)}</p>${part('잘하는 점 · 힘이 되는 점', a.strengths)}${part('살펴볼 점', a.watch)}${part('집 · 교실에서 해 볼 것', a.home)}${part('검사한 선생님께 물어볼 것', a.ask)}`
        : `<p class="sub" style="margin:8px 0">점수가 무슨 뜻인지, 잘하는 점과 살펴볼 점, 집에서 해 볼 것을 쉬운 말로 알려 줘요. 이름은 보내지 않아요.</p><button class="btn main" id="rAI" style="width:100%;justify-content:center">풀어 보기</button>`}
      ${S.sub.error ? `<p class="err">${esc(S.sub.error)}</p>` : ''}</div>
    <p class="sub small">AI 풀이는 참고예요. 진단이 아니며, 검사한 선생님 · 기관의 설명이 먼저예요.</p></div>`;
}
function reportPrintHTML(r){
  const b = beforeOf(r), prev = {}; (b ? b.rows || [] : []).forEach(x => { if (!(x.name in prev)) prev[x.name] = x.score; });
  let h = `<div class="sub">마음한편 · 검사 결과 · ${esc(whoName(r.who))}</div><h1>${esc(r.title || '검사 결과')}</h1><div class="sub">${ymdDots(r.day)} · ${esc(r.org || '기관 모름')}${b ? ` · 지난번 ${ymdDots(b.day)}과 견줌` : ''}</div>`;
  h += `<h2>척도 · 점수</h2><table><tr><th>척도</th><th>점수 종류</th><th>수준</th>${b ? "<th class='r'>지난번</th>" : ''}<th class='r'>점수</th></tr>`;
  let g = null;
  for (const x of r.rows || []) {
    if ((x.group || '') !== g) { g = x.group || ''; if (g) h += `<tr><td class='g' colspan='5'>${esc(g)}</td></tr>`; }
    h += `<tr><td>${esc(x.name)}${x.note ? `<div class='sub'>${esc(x.note)}</div>` : ''}</td><td>${esc(x.kind)}</td><td>${esc(x.band)}</td>${b ? `<td class='r'>${esc(prev[x.name] || '')}</td>` : ''}<td class='r'><b>${esc(x.score)}</b></td></tr>`;
  }
  h += '</table>';
  if (r.memo) h += `<h2>결과지 소견 · 메모</h2><p>${pesc(r.memo)}</p>`;
  const a = reportAI(r);
  if (a) { h += `<h2>AI 풀이</h2><p>${esc(a.summary)}</p>`; for (const [t, l] of [['잘하는 점 · 힘이 되는 점', a.strengths], ['살펴볼 점', a.watch], ['집 · 교실에서 해 볼 것', a.home], ['검사한 선생님께 물어볼 것', a.ask]]) if (l && l.length) h += `<b>${t}</b><ul>${l.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`; }
  return h + `<div class='note'>AI 풀이는 참고예요. 진단이 아니며, 검사한 선생님 · 기관의 설명이 먼저예요. · ${ymdDots(sec(new Date()))} 출력</div>`;
}

/* 파일 읽기: 사진은 긴 쪽 1800px · JPEG 로 줄여요 (앱 ReportAddView.shrink) */
const b64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
function shrink(file){
  return new Promise(ok => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { const m = Math.max(img.width, img.height), k = Math.min(1, 1800 / Math.max(m, 1));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      ok({ type: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.75).split(',')[1] }); };
    img.onerror = () => { URL.revokeObjectURL(url); ok(null); };
    img.src = url;
  });
}
/* 글자 PDF 에서 글 뽑기 (pdf.js, 이 브라우저 안에서만 · 스캔 PDF 면 빈 글) */
let pdfjsP = null;
function loadPdfjs(){
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return pdfjsP = pdfjsP || new Promise((ok, no) => { const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; ok(window.pdfjsLib); };
    s.onerror = () => { pdfjsP = null; no(new Error('pdf.js')); }; document.head.append(s); });
}
async function pdfText(buf){
  try {
    const L = await loadPdfjs(), doc = await L.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise, out = [];
    for (let i = 1; i <= doc.numPages; i++) { const tc = await (await doc.getPage(i)).getTextContent(); out.push(tc.items.map(it => (it.str || '') + (it.hasEOL ? '\n' : ' ')).join('')); }
    return out.join('\n').trim();
  } catch { return ''; }
}
/* '학년 반 번호 이름' 줄의 이름을 지워요 (예: "1 10 1 고세아" → "1 10 1") — 앱 SheetAddView.maskNames 와 같은 규칙 */
const maskNames = t => (t + '\n').replace(/(\b\d{1,2})[ \t]+(\d{1,2})[ \t]+(\d{1,2})[ \t]+[가-힣]{2,4}(?=\s)/g, '$1 $2 $3').trim();

async function pickReportFiles(input){
  const A = S.sub.add, files = [...input.files]; input.value = '';
  for (const f of files) {
    if (A.files.length >= 12) break;
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) { if (f.size < 5e6) A.files.push({ type: 'application/pdf', data: b64(await f.arrayBuffer()) }); else A.error = 'PDF 가 너무 커요 (5MB 까지)'; }
    else if (f.type.startsWith('image/')) { const j = await shrink(f); if (j) A.files.push(j); }
  }
  render();
}
const consentFor = msg => new Promise(ok => {
  if (ls.get('aiConsent', false)) return ok(true);
  sheet(`<b style="font-size:18px">결과지를 AI 로 보낼까요?</b><p class="sub" style="margin:0">${esc(msg)}</p><div class="row"><button class="btn main" id="cOk">보내기</button><button class="btn" id="cNo">그만두기</button></div>`);
  $('#cOk').onclick = () => { ls.set('aiConsent', true); closeSheet(); ok(true); };
  $('#cNo').onclick = () => { closeSheet(); ok(false); };
});
async function readReport(){
  const A = S.sub.add;
  if (!(await consentFor('결과지는 점수를 읽기 위해 Anthropic(Claude)의 AI로 보내져요. 마음한편 서버에는 저장하지 않아요.'))) return;
  A.busy = true; A.error = ''; render();
  const a = await ai('report_read', { files: A.files });
  A.busy = false;
  if (!a) { A.error = 'AI 에 닿지 못했어요. 인터넷을 확인하고 다시 해 봐요.'; return render(); }
  if (a.error) { A.error = a.error; return render(); }
  const d = /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? new Date(a.date + 'T00:00:00') : new Date();
  const rec = { who: A.who || '', title: a.title || '', org: a.org || '', day: sec(dayStart(d)), memo: a.memo || '', ai: '', at: sec(new Date()),
    rows: (a.rows || []).map(x => ({ group: String(x.group || ''), name: String(x.name || ''), score: String(x.score ?? ''), kind: String(x.kind || ''), band: String(x.band || ''), note: String(x.note || '') })) };
  A.files = [];   // 사진 · PDF 는 버려요
  S.sub = { edit: { isNew: true, key: uuid(), rec } }; render();
}
async function explainReport(){
  const key = S.sub.id, r = S.col.reports[key]; if (!r) return;
  if (!(await askConsent())) return;
  S.sub.busy = true; S.sub.error = ''; render();
  const b = beforeOf({ key, ...r });
  const a = await ai('report_explain', { report: { title: r.title, org: r.org, date: ymd(fromSec(r.day)), memo: r.memo, who: whoForAI(r.who), rows: r.rows || [], before: (b ? b.rows || [] : []).map(x => ({ name: x.name, score: x.score })) } });
  S.sub.busy = false;
  if (!a) { S.sub.error = 'AI 에 닿지 못했어요. 잠시 뒤에 다시 해 봐요.'; return render(); }
  if (a.error) { S.sub.error = a.error; return render(); }
  const L = k => Array.isArray(a[k]) ? a[k].map(String) : [];
  await put('reports', key, { ...r, ai: JSON.stringify({ summary: a.summary || '', strengths: L('strengths'), watch: L('watch'), home: L('home'), ask: L('ask') }) });
}

/* ================= 🏫 담임 도구 (앱 ClassHome.swift · ClassTypes.swift) =================
   · 학생 = members 의 role 'student', 명단 차례(order) = 번호 (결과지 번호와 맞춰요)
   · 성격 유형 직접 입력 = tests { kind:'type16', scores:[축마다 75 · 25], code, at, who: 학생 key, set: -1 }
   · 우리반 결과지 = sheets { title, day, kind:'scores'|'notes', cols, rows:[{no, values, tags, note}], summary, at } — 실명 · 사진은 저장하지 않아요 */
const students = () => members().filter(m => m.role === 'student');
const AXES = () => (T && T.data && T.data.typeAxes) || [{ first: 'E', second: 'I', firstName: '밖에서 충전', secondName: '안에서 충전' }, { first: 'S', second: 'N', firstName: '보이는 것부터', secondName: '숨은 뜻부터' }, { first: 'T', second: 'F', firstName: '이치를 따져서', secondName: '마음을 살펴서' }, { first: 'J', second: 'P', firstName: '미리 정해 두고', secondName: '그때그때 맞춰' }];
/* 1 → 일번이, 12 → 십이번이, 30 → 삼십번이 */
function hangulName(n){ const d = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'], t = Math.floor(n / 10), o = n % 10; return (t === 0 ? '' : t === 1 ? '십' : d[t] + '십') + d[o] + '번이'; }
const rosterName = no => { const s = students()[no - 1]; return s ? s.name : hangulName(no); };
/* 학기 날짜 (이번 학년도: 1 · 2월은 지난 학년도) — 0 학기 초 3. 2. · 1 2학기 8. 25. · 2 오늘 */
function termDate(k){ const now = new Date(); let y = now.getFullYear(); if (now.getMonth() + 1 < 3) y -= 1; return k === 0 ? new Date(y, 2, 2) : k === 1 ? new Date(y, 7, 25) : dayStart(now); }
const typeScores = code => AXES().map((ax, i) => code[i] === ax.first ? 75 : 25);
const type16s = () => tests().filter(t => t.kind === 'type16').sort((a, b) => a.at - b.at);
const codeOf = who => { const l = type16s().filter(t => (t.who || '') === who && (t.code || '').length === 4); return l.length ? l[l.length - 1].code : null; };
const sameN = (a, b) => [...a].filter((c, i) => c === b[i]).length;

function classRows(){
  const st = students(), done = new Set(type16s().filter(t => (t.code || '').length === 4).map(t => t.who)), sh = list('sheets');
  return rows([
    mrow({ icon: 'person', tint: 'navy', title: '우리반 명단', sub: st.length ? `${st[0].name} ~ ${st[st.length - 1].name}` : '일번이 ~ 삼십번이 한 번에 만들기', attrs: 'data-cls="roster"', right: badge(st.length + '명', 'navy') }),
    mrow({ icon: 'grid', tint: 'green', title: '성격 유형 입력', sub: '네 칸 톡톡 · 학기 초 · 2학기', attrs: 'data-cls="types"', right: badge(`${st.filter(s => done.has(s.key)).length} / ${st.length}`, 'green') }),
    mrow({ icon: 'doc', tint: 'clay', title: '우리반 검사 결과지', sub: '사진 · PDF → 학생별로 정리', attrs: 'data-cls="sheets"', right: sh.length ? badge(sh.length + '개', 'clay') : '' }),
    mrow({ icon: 'circles', tint: 'lavender', title: '성향 묶음', sub: '비슷한 친구 · 모둠 짜기', attrs: 'data-cls="groups"' }),
    mrow({ icon: 'scale', tint: 'sky', title: '나와 우리반', sub: '닮은 점 · 다른 점', attrs: 'data-cls="match"' }),
  ]);
}
/* 테스트 탭 (교사 모드): 학생 칩 아래 '담임이에요' (앱 TestView.homeroomCard) */
function homeroomCard(){
  if (!isHomeroom()) return `<button class="box hrcard" id="hrEdit"><span class="bx"></span><span><b>담임이에요</b><small>켜면 우리반 명단 · 성격 유형 · 검사 결과지 · 성향 묶음이 보여요</small></span><i class="chev">›</i></button>`;
  const h = meTags().homeroom;
  return `<div class="box hrcard on"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span class="row" style="gap:8px"><span class="bx on"></span><b>${esc(h === '담임' ? '담임이에요' : h + ' 담임이에요')}</b></span><button class="btn small" id="hrEdit">고치기</button></div>
    <div class="row" style="margin-top:10px">${[['roster', '우리반 명단', 'person'], ['types', '성격 유형 입력', 'grid'], ['sheets', '검사 결과지', 'doc'], ['groups', '성향 묶음', 'circles'], ['match', '나와 우리반', 'scale']].map(([k, n, i]) => `<button class="chip ico" data-cls="${k}">${ico(i)}${n}</button>`).join('')}</div></div>`;
}

function vClass(){
  const tool = S.sub.tool;
  const back = `<button class="btn small" data-cls="" style="justify-self:start">‹ 담임 도구</button>`;
  if (!isHomeroom() && !tool) return `<div class="stack fade-in" style="max-width:640px"><h2 class="title">담임 도구</h2><div class="box"><p style="margin:0">내 계정 › 나 소개에서 '교사'를 고르고 '담임이에요'를 켜면 담임 도구가 보여요.</p><button class="btn main" id="hrEdit" style="margin-top:10px">나 소개 고치기</button></div></div>`;
  if (tool === 'roster') return vRoster(back);
  if (tool === 'types') return vTypes(back);
  if (tool === 'sheets') return S.sub.sheet ? vSheet() : vSheets(back);
  if (tool === 'sheetAdd') return vSheetAdd();
  if (tool === 'groups') return vGroups(back);
  if (tool === 'match') return vClassMatch(back);
  return `<div class="stack fade-in" style="max-width:720px"><h2 class="title">담임 도구</h2>${listHead('교실 마음', homeroomLabel())}${classRows()}
    <p class="sub small">실명 대신 번호 이름(일번이 · 이번이 …)으로 써요. 성격 유형은 아이를 이해하는 실마리일 뿐, 아이를 나누는 기준이 아니에요.</p></div>`;
}
function vRoster(back){
  const st = students();
  return `<div class="stack fade-in" style="max-width:640px">${back}<h2 class="title">우리반 명단</h2>
    ${rows([mrow({ icon: 'people', tint: 'navy', title: '학생 한 번에 더하기', sub: '일번이 ~ 삼십번이', attrs: 'id="bulkAdd"' })])}
    <p class="sub small" style="margin:0">번호 = 명단 차례예요. 결과지의 번호와 맞춰져요. 실명 대신 번호 이름으로 써요.</p>
    ${listHead('우리반 ' + st.length + '명')}
    ${st.length ? `<div class="mlist">${st.map((s, i) => `<div class="rrow"><span class="no">${i + 1}</span><b>${esc(s.name)}</b><span class="row" style="gap:4px"><button class="btn small" data-up="${s.key}"${i ? '' : ' disabled'} aria-label="위로">↑</button><button class="btn small" data-down="${s.key}"${i < st.length - 1 ? '' : ' disabled'} aria-label="아래로">↓</button><button class="btn small" data-medit="${s.key}">고치기</button></span></div>`).join('')}</div>` : '<div class="box sub">아직 학생이 없어요. 위 [학생 한 번에 더하기]로 1번부터 만들어요.</div>'}</div>`;
}
function bulkAdd(){
  let from = 1, to = 30, hangul = true;
  const listNow = () => { const pasted = ($('#bkNames') ? $('#bkNames').value : '').split(/[,\n、]/).map(s => s.trim()).filter(Boolean);
    if (pasted.length) return pasted; const out = []; for (let n = from; n <= Math.max(from, to); n++) out.push(hangul ? hangulName(n) : n + '번'); return out; };
  sheet(`<b style="font-size:18px">학생 한 번에 더하기</b>
    <div class="eyebrow">번호로 만들기</div><div class="row"><label class="small">처음 번호 <input type="number" id="bkFrom" min="1" max="60" value="1" class="num"></label><label class="small">끝 번호 <input type="number" id="bkTo" min="1" max="60" value="30" class="num"></label></div>
    <div class="seg"><button class="on" data-bk="1">일번이 · 이번이</button><button data-bk="0">1번 · 2번</button></div>
    <p class="sub small" style="margin:0">예) 1 ~ 30 → 일번이 · 이번이 … 삼십번이. 이름은 나중에 눌러서 바꿀 수 있어요.</p>
    <div class="eyebrow">또는 이름 붙여 넣기</div><textarea id="bkNames" rows="3" placeholder="일번이, 이번이, 삼번이 …"></textarea>
    <p class="sub small" style="margin:0">쉼표나 줄바꿈으로 나눠요. 적으면 번호 대신 이 이름들로, 적은 차례대로 만들어요.</p>
    <p class="small" id="bkPrev" style="margin:0"></p><button class="btn main" id="bkGo" style="justify-content:center"></button>`);
  const upd = () => { const L = listNow(), have = new Set(students().map(s => s.name)), skip = L.filter(n => have.has(n)).length;
    $('#bkPrev').textContent = '미리 보기: ' + L.slice(0, 5).join(' · ') + (L.length > 5 ? ' … ' + L[L.length - 1] : '') + (skip ? ` · 이미 있는 이름 ${skip}명은 건너뛰어요` : '');
    $('#bkGo').textContent = `${L.length - skip}명 더하기`; $('#bkGo').disabled = L.length - skip <= 0; };
  $('#bkFrom').oninput = e => { from = Math.max(1, Math.min(60, +e.target.value || 1)); upd(); };
  $('#bkTo').oninput = e => { to = Math.max(1, Math.min(60, +e.target.value || 1)); upd(); };
  $('#bkNames').oninput = upd;
  document.querySelectorAll('#sheet [data-bk]').forEach(b => b.onclick = () => { hangul = b.dataset.bk === '1'; document.querySelectorAll('#sheet [data-bk]').forEach(x => x.classList.toggle('on', x === b)); upd(); });
  $('#bkGo').onclick = async () => {
    const have = new Set(students().map(s => s.name)); let order = Math.max(0, ...members().map(m => m.order || 0)) + 1; const out = [];
    for (const n of listNow()) if (!have.has(n)) { have.add(n); out.push(['members', uuid(), { name: n.slice(0, 12), role: 'student', avatar: '', order: order++, at: sec(new Date()) }]); }
    closeSheet(); await putMany(out); toast(`${out.length}명을 더했어요`);
  };
  upd();
}
function editMember(key){
  const m = members().find(x => x.key === key); if (!m) return;
  sheet(`<b style="font-size:18px">이름 고치기</b><input type="text" id="meName2" maxlength="12" value="${esc(m.name)}"><p class="sub small" style="margin:0">실명 대신 번호 · 별명으로 적어요.</p>
    <div class="row"><button class="btn main" id="mOk">저장</button><button class="btn" id="mDel2">명단에서 빼기</button></div>`);
  $('#mOk').onclick = () => { const n = $('#meName2').value.trim().slice(0, 12); if (!n) return; closeSheet(); const { key: k, ...rec } = m; put('members', k, { ...rec, name: n }); };
  $('#mDel2').onclick = () => { if (!confirm(`${m.name}을(를) 명단에서 뺄까요? 그 학생 칸의 테스트 결과는 남아 있어요.`)) return; closeSheet(); del('members', m.key); };
}
function moveStudent(key, dir){
  const st = students(), i = st.findIndex(s => s.key === key), j = i + dir; if (i < 0 || j < 0 || j >= st.length) return;
  [st[i], st[j]] = [st[j], st[i]];
  const base = Math.min(...st.map(s => s.order || 0));
  putMany(st.map((s, k) => { const { key: kk, ...rec } = s; return (rec.order === base + k) ? null : ['members', kk, { ...rec, order: base + k }]; }).filter(Boolean));
}

/* 성격 유형 입력 */
function vTypes(back){
  const term = S.sub.term ?? 0, d = termDate(term), dk = ymd(d), st = students(), R = type16s(), draft = S.sub.draft || (S.sub.draft = {});
  const current = s => R.filter(t => t.who === s.key && t.set === -1 && ymd(fromSec(t.at)) === dk).pop() || null;
  const before = s => R.filter(t => t.who === s.key && fromSec(t.at) < dayStart(d)).pop() || null;
  const filled = st.filter(s => R.some(t => t.who === s.key)).length;
  const coded = st.map(s => [s.name, codeOf(s.key)]).filter(x => x[1]);
  const AX = AXES();
  return `<div class="stack fade-in" style="max-width:720px">${back}<h2 class="title">우리반 성격 유형</h2>
    <div class="seg">${['학기 초', '2학기', '오늘'].map((n, i) => `<button data-term="${i}" class="${term === i ? 'on' : ''}">${n}</button>`).join('')}</div>
    <p class="sub small" style="margin:0">네 칸을 눌러 고르면 저장돼요. ${ymdDots(sec(d))} 결과로 들어가요. 실명 대신 번호 · 별명으로 적어요.</p>
    ${rows([mrow({ icon: 'people', tint: 'navy', title: '학생 한 번에 더하기', sub: '일번이 ~ 삼십번이', attrs: 'id="bulkAdd"' })])}
    ${st.length ? `${listHead(`우리반 ${st.length}명 · 입력 ${filled}명`)}<div class="mlist">${st.map((s, i) => { const now = current(s), prev = before(s);
        const letters = draft[s.key] || (now ? [...now.code] : []);
        const shown = draft[s.key] ? draft[s.key].join('').replace(/_/g, '·') : now ? now.code : '아직';
        return `<div class="ty"><div class="th"><span class="no">${i + 1}</span><b>${esc(s.name)}</b><span class="code">${prev && now && prev.code !== now.code ? `<small class="sub">${esc(prev.code)} →</small> ` : ''}<b class="${now ? 'on' : ''}">${esc(shown)}</b></span>${now ? `<button class="xbtn" data-tdel="${now.key}" aria-label="이 결과 지우기">✕</button>` : ''}</div>
          <div class="axes">${AX.map((ax, a) => `<span class="pair">${[ax.first, ax.second].map(l => `<button data-ax="${s.key}|${a}|${l}" class="${letters[a] === l ? 'on' : ''}">${l}</button>`).join('')}</span>`).join('')}</div></div>`; }).join('')}</div>
      ${coded.length ? `${listHead('우리반 한눈에 · ' + coded.length + '명')}<div class="box">${pairBars(coded.map(c => c[1]))}
        <div class="g16">${['ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP', 'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'].map(g => { const ns = coded.filter(c => c[1] === g).map(c => c[0]); return `<div class="${ns.length ? 'on' : ''}"><b>${g}</b><small>${esc(ns.join(' · '))}</small></div>`; }).join('')}</div></div>` : ''}
      <button class="box bigbtn" id="typesPrint">${ico('print')}우리반 표 출력하기</button>
      <p class="sub small">성격 유형은 아이를 이해하는 실마리일 뿐, 아이를 나누는 기준이 아니에요. 문항으로 답한 결과가 아니라 직접 적은 결과예요.</p>`
      : '<div class="box sub">아직 학생이 없어요. 위 [학생 한 번에 더하기]로 1번부터 만들어요.</div>'}</div>`;
}
function pairBars(codes){
  return AXES().map((ax, a) => { const n1 = codes.filter(c => c[a] === ax.first).length, n2 = codes.length - n1;
    return `<div class="pbar"><div class="row small" style="justify-content:space-between"><b>${ax.first} ${esc(ax.firstName)} ${n1}</b><b>${n2} ${esc(ax.secondName)} ${ax.second}</b></div><div class="progress"><i style="width:${codes.length ? n1 / codes.length * 100 : 0}%"></i></div></div>`; }).join('');
}
/* 칸을 누르면: 네 칸이 다 차면 이 학기 결과로 저장 (이미 있으면 글자만 바꿔요). 덜 찬 것은 저장하지 않아요 */
async function setAxis(who, a, l){
  const term = S.sub.term ?? 0, d = termDate(term), dk = ymd(d), draft = S.sub.draft || (S.sub.draft = {});
  const now = type16s().filter(t => t.who === who && t.set === -1 && ymd(fromSec(t.at)) === dk).pop();
  let c = draft[who] || (now ? [...now.code] : ['_', '_', '_', '_']); if (c.length !== 4) c = ['_', '_', '_', '_'];
  c = [...c]; c[a] = l;
  if (c.includes('_')) { draft[who] = c; return render(); }
  delete draft[who];
  const code = c.join('');
  if (now) { const { key, ...rec } = now; await put('tests', key, { ...rec, code, scores: typeScores(code) }); }
  else await put('tests', uuid(), { kind: 'type16', scores: typeScores(code), code, at: sec(d), who, set: -1 });
}
function typesPrintHTML(){
  const st = students(), R = type16s();
  let h = `<div class='sub'>마음한편 · 교사 모드</div><h1>우리반 성격 유형</h1><div class='sub'>${st.length}명 · ${ymdDots(sec(new Date()))} 출력</div><h2>학생별</h2><table><tr><th>번호</th><th>이름</th><th>지난번</th><th class='r'>지금</th></tr>`;
  st.forEach((s, i) => { const all = R.filter(t => t.who === s.key && (t.code || '').length === 4); h += `<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td>${all.length > 1 ? all[all.length - 2].code : ''}</td><td class='r'><b>${all.length ? all[all.length - 1].code : ''}</b></td></tr>`; });
  h += '</table>';
  const codes = st.map(s => codeOf(s.key)).filter(Boolean);
  if (codes.length) { h += '<h2>네 쌍</h2><table>'; AXES().forEach((ax, a) => { const n1 = codes.filter(c => c[a] === ax.first).length; h += `<tr><td>${ax.first} ${esc(ax.firstName)}</td><td class='r'>${n1}명</td><td>${ax.second} ${esc(ax.secondName)}</td><td class='r'>${codes.length - n1}명</td></tr>`; }); h += '</table>'; }
  return h + "<div class='note'>성격 유형은 아이를 이해하는 실마리일 뿐, 아이를 나누는 기준이 아니에요.</div>";
}

/* 우리반 검사 결과지 */
const highV = v => (parseFloat(String(v).trim()) || 0) >= 65;   // 눈여겨볼 값 (T점수 65 이상)
const RANK = ['green', 'sky', 'lavender', 'gray', 'gray'];
function vSheets(back){
  const sh = list('sheets').sort((a, b) => b.day - a.day);
  return `<div class="stack fade-in" style="max-width:720px">${back}<h2 class="title">우리반 검사 결과지</h2>
    ${rows([mrow({ icon: 'doc', tint: 'clay', title: '결과지 올리기 (사진 · PDF)', sub: '반 전체가 한 표에 든 결과지', attrs: 'data-cls="sheetAdd"' })])}
    <p class="sub small" style="margin:0">반 전체가 한 표에 있는 결과지(성격검사 · 진로검사 · 생활기록부 소견 등)를 올리면 번호별로 정리해요. 실명과 사진은 저장하지 않아요.</p>
    ${sh.length ? `${listHead('올린 결과지')}${rows(sh.map(s => mrow({ icon: s.kind === 'notes' ? 'card' : 'grid', tint: s.kind === 'notes' ? 'green' : 'clay', title: s.title || '검사 결과', sub: `${ymdDots(s.day)} · ${(s.rows || []).length}명 · ${s.kind === 'notes' ? '소견' : '점수 ' + (s.cols || []).length + '칸'}`, attrs: `data-sheet="${s.key}"` })))}` : ''}</div>`;
}
function vSheetAdd(){
  const A = S.sub.sAdd || (S.sub.sAdd = { files: [], text: '' });
  const ready = A.files.length || A.text;
  return `<div class="stack fade-in" style="max-width:640px"><button class="btn small" data-cls="sheets" style="justify-self:start">‹ 우리반 검사 결과지</button><h2 class="title">결과지 올리기</h2>
    ${listHead('반 전체 결과지')}<div class="box" style="display:grid;gap:10px">
      <label class="btn" style="justify-content:center">${ico('plus')}사진 · PDF 고르기<input type="file" id="sFiles" accept="image/*,application/pdf" multiple hidden></label>
      ${A.reading ? '<p class="sub small" style="margin:0">파일을 여는 중…</p>' : ''}
      ${ready ? `<div class="row" style="justify-content:space-between"><span>${A.text ? `글자 PDF · 이름을 지운 글 ${A.text.length}자` : ''}${A.text && A.files.length ? ' · ' : ''}${A.files.length ? `결과지 ${A.files.length}장` : ''}</span><button class="btn small" id="sClear">비우기</button></div>` : ''}
      <p class="sub small" style="margin:0">글자로 된 PDF 는 이 브라우저 안에서 글을 뽑아 학생 이름을 지운 뒤 보내요. 사진은 이름 칸을 가리고 찍으면 더 안전해요.</p></div>
    <button class="btn main" id="sRead" style="justify-content:center"${ready && !A.busy ? '' : ' disabled'}>${A.busy ? 'AI 가 결과지를 읽고 있어요… (1~2분)' : 'AI 로 번호별 표 만들기'}</button>
    ${A.error ? `<p class="err">${esc(A.error)}</p>` : '<p class="sub small" style="margin:0">결과지는 표를 만들기 위해 Anthropic(Claude)의 AI로 보내지고 저장하지 않아요. AI 가 잘못 읽을 수 있으니 저장된 표를 결과지와 한 번 견줘 주세요.</p>'}</div>`;
}
async function pickSheetFiles(input){
  const A = S.sub.sAdd, files = [...input.files]; input.value = '';
  A.files = []; A.text = ''; A.error = ''; A.reading = true; render();
  for (const f of files.slice(0, 12)) {
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
      const buf = await f.arrayBuffer(), t = await pdfText(buf);
      if (t.length > 200) A.text += (A.text ? '\n\n' : '') + maskNames(t);
      else if (f.size < 8e6) A.files.push({ type: 'application/pdf', data: b64(buf) }); else A.error = 'PDF 가 너무 커요 (8MB 까지)';
    } else if (f.type.startsWith('image/')) { const j = await shrink(f); if (j) A.files.push(j); }
  }
  A.reading = false; render();
}
async function readSheet(){
  const A = S.sub.sAdd;
  if (!(await consentFor('번호별 표를 만들기 위해 Anthropic(Claude)의 AI로 보내져요. 마음한편 서버에는 저장하지 않아요.'))) return;
  A.busy = true; A.error = ''; render();
  const payload = { files: A.files }; if (A.text) payload.sheet = A.text.slice(0, 60000);
  const a = await ai('class_read', payload);
  A.busy = false;
  if (!a) { A.error = 'AI 에 닿지 못했어요. 인터넷을 확인하고 다시 해 봐요.'; return render(); }
  if (a.error) { A.error = a.error; return render(); }
  const rs = (a.rows || []).map(r => ({ no: Math.round(+r.no || 0), values: (r.values || []).map(String), tags: (r.tags || []).map(String), note: String(r.note || '') })).filter(r => r.no > 0).sort((x, y) => x.no - y.no);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? dayStart(new Date(a.date + 'T00:00:00')) : new Date();
  const rec = { title: a.title || '', day: sec(d), kind: a.kind === 'notes' ? 'notes' : 'scores', cols: (a.cols || []).map(String), rows: rs, summary: a.summary || '', at: sec(new Date()) };
  // 명단이 모자라면 번호 이름으로 채워요 (일번이 …)
  const need = Math.max(0, ...rs.map(r => r.no)), have = students().length, out = [];
  let order = Math.max(0, ...members().map(m => m.order || 0));
  for (let n = have + 1; n <= need; n++) out.push(['members', uuid(), { name: hangulName(n), role: 'student', avatar: '', order: ++order, at: sec(new Date()) }]);
  const key = uuid(); out.push(['sheets', key, rec]);
  await putMany(out);
  S.sub = { tool: 'sheets', sheet: key }; render();
}
function vSheet(){
  const s = S.col.sheets[S.sub.sheet]; if (!s) return '<p class="sub">결과지를 불러오는 중…</p>';
  const R = s.rows || [], cols = s.cols || [], open = S.sub.open;
  let glance = '';
  if (s.kind === 'scores') glance = cols.map((c, i) => { const n = R.filter(r => highV((r.values || [])[i] || '')).length; return n ? badge(`${c} ${n}명`, 'clay') : ''; }).join('');
  else { const cnt = {}; R.forEach(r => { const t = (r.tags || [])[0]; if (t) cnt[t] = (cnt[t] || 0) + 1; }); glance = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t, n]) => badge(`${t} ${n}명`, 'green')).join(''); }
  return `<div class="stack fade-in" style="max-width:860px"><div class="row" style="justify-content:space-between"><button class="btn small" data-cls="sheets">‹ 우리반 검사 결과지</button>
      <span class="row"><button class="btn small" id="sPrint">${ico('print')}출력</button><button class="btn small" id="sDel">지우기</button></span></div>
    <div><div class="sub small">${ymdDots(s.day)} · ${R.length}명</div><h2 class="title" style="margin:2px 0 0">${esc(s.title || '검사 결과')}</h2></div>
    ${s.summary || s.kind === 'scores' ? `<div class="box"><div class="bh">우리반 한눈에</div>${glance ? `<div class="row" style="margin-top:8px;gap:6px">${glance}</div>` : ''}${s.summary ? `<p style="margin:8px 0 0">${pesc(s.summary)}</p>` : ''}</div>` : ''}
    ${s.kind === 'scores' ? `<div class="box stable"><table><thead><tr><th class="st">학생</th>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${R.map(r => `<tr><td class="st"><small>${r.no}</small> <b>${esc(rosterName(r.no))}</b></td>${cols.map((c, i) => { const v = (r.values || [])[i] || ''; return `<td>${!v ? '<span class="sub">–</span>' : highV(v) ? badge(v, 'clay') : esc(v)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`
      : `<div class="mlist">${R.map(r => `<button class="nrow" data-open="${r.no}"><span class="th"><span class="no">${r.no}</span><b>${esc(rosterName(r.no))}</b><i class="chev">${open === r.no ? '⌃' : '⌄'}</i></span>${(r.tags || []).length ? `<span class="row" style="gap:5px">${r.tags.map((t, k) => badge(`${k + 1} ${t}`, RANK[Math.min(k, 4)])).join('')}</span>` : ''}${open === r.no && r.note ? `<span class="nnote">${pesc(r.note)}</span>` : ''}</button>`).join('')}</div>`}
    <p class="sub small">${s.kind === 'scores' ? '65 이상(T점수)인 칸에 색을 칠했어요. 검사마다 기준이 다를 수 있으니 결과지의 기준을 따라 주세요. 진단이 아니에요.' : '1순위를 모아 반 전체를 보여 줘요. 줄을 누르면 소견 글이 펼쳐져요.'}</p></div>`;
}
function sheetPrintHTML(s){
  const R = s.rows || [], cols = s.cols || [];
  let h = `<div class='sub'>마음한편 · 우리반</div><h1>${esc(s.title)}</h1><div class='sub'>${ymdDots(s.day)} · ${R.length}명</div>`;
  if (s.summary) h += `<p>${pesc(s.summary)}</p>`;
  if (s.kind === 'scores') { h += `<table><tr><th>번호</th><th>학생</th>${cols.map(c => `<th class='r'>${esc(c)}</th>`).join('')}</tr>`; for (const r of R) h += `<tr><td>${r.no}</td><td>${esc(rosterName(r.no))}</td>${cols.map((c, i) => { const v = (r.values || [])[i] || ''; return `<td class='r'>${highV(v) ? `<b>${esc(v)}</b>` : esc(v)}</td>`; }).join('')}</tr>`; h += '</table>'; }
  else for (const r of R) h += `<p><b>${r.no} ${esc(rosterName(r.no))}</b> <span class='sub'>${esc((r.tags || []).join(' · '))}</span><br>${pesc(r.note)}</p>`;
  return h + `<div class='note'>${ymdDots(sec(new Date()))} 마음한편에서 출력 · 진단 자료가 아니에요</div>`;
}

/* 성향 묶음 · 모둠 짜기 */
const KINDS = [['SJ', '차분한 챙김이', 'sky', c => c.includes('S') && c.endsWith('J')], ['SP', '신나는 행동파', 'clay', c => c.includes('S') && c.endsWith('P')],
               ['NF', '따뜻한 이상가', 'green', c => c.includes('N') && c.includes('F')], ['NT', '생각 깊은 탐구자', 'lavender', c => c.includes('N') && c.includes('T')]];
function vGroups(back){
  const c = students().map(s => [s.name, codeOf(s.key)]).filter(x => x[1]), teams = S.sub.teams || 6, made = S.sub.made || [];
  if (!c.length) return `<div class="stack fade-in" style="max-width:720px">${back}<h2 class="title">성향 묶음</h2><div class="box sub">아직 입력한 성격 유형이 없어요. 담임 도구 › 성격 유형 입력에서 네 칸을 눌러 넣어 주세요.</div></div>`;
  return `<div class="stack fade-in" style="max-width:720px">${back}<h2 class="title">성향 묶음</h2>
    ${listHead('네 쌍', c.length + '명 입력')}<div class="box">${pairBars(c.map(x => x[1]))}</div>
    ${listHead('비슷한 친구 묶음', '가운데 두 글자')}<div class="box" style="display:grid;gap:14px">${KINDS.map(([k, n, t, f]) => { const ns = c.filter(x => f(x[1])).map(x => x[0]);
      return `<div><div class="row" style="gap:8px">${badge(n, t)}<span class="sub small">${k} · ${ns.length}명</span></div>${ns.length ? `<div class="row" style="gap:5px;margin-top:7px">${ns.map(x => `<span class="badge t-${t} soft">${esc(x)}</span>`).join('')}</div>` : '<div class="sub small" style="margin-top:4px">아직 없어요</div>'}</div>`; }).join('')}</div>
    ${listHead('모둠 짜기', 'E/I · J/P 가 고르게')}<div class="box" style="display:grid;gap:12px">
      <div class="row"><button class="btn small" id="tMinus"${teams <= 2 ? ' disabled' : ''}>−</button><b>${teams}모둠</b><button class="btn small" id="tPlus"${teams >= 10 ? ' disabled' : ''}>＋</button></div>
      <button class="btn main" id="tMake" style="justify-content:center">${made.length ? '다시 섞기' : teams + '모둠 만들기'}</button>
      ${made.map((t, i) => `<div class="row" style="flex-wrap:nowrap;align-items:baseline"><b style="color:var(--acc);width:52px;flex:none">${i + 1}모둠</b><span>${esc(t.join(' · '))}</span></div>`).join('')}</div>
    <p class="sub small">성격 유형은 아이를 이해하는 실마리일 뿐, 아이를 나누는 기준이 아니에요.</p></div>`;
}
/* E/I · J/P 네 칸으로 나눈 뒤 차례로 한 명씩 나눠 줘요 (누를 때마다 조금씩 섞어요) */
function makeTeams(){
  const c = students().map(s => [s.name, codeOf(s.key)]).filter(x => x[1]), n = Math.max(2, Math.min(S.sub.teams || 6, c.length));
  const out = [...Array(n)].map(() => []), mix = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
  let k = 0; for (const g of ['EJ', 'EP', 'IJ', 'IP']) for (const nm of mix(c.filter(x => x[1][0] + x[1][3] === g).map(x => x[0]))) out[k++ % n].push(nm);
  S.sub.made = out; render();
}

/* 나와 우리반 (닮은 점 · 다른 점) */
function pairLines(me, other, name){
  const AX = AXES(), A = [...me], B = [...other], nm = i => (l, ax) => l === ax.first ? ax.firstName : ax.secondName;
  const same = [0, 1, 2, 3].filter(i => A[i] === B[i]).map(i => nm(i)(A[i], AX[i]));
  const diff = [0, 1, 2, 3].filter(i => A[i] !== B[i]).map(i => `나는 ${nm(i)(A[i], AX[i])}, ${T ? T.josa(name, '은', '는') : name + '은'} ${nm(i)(B[i], AX[i])}`);
  return [same.length ? '둘 다 ' + same.join(' · ') : '네 가지가 모두 달라요', diff[0] || '네 가지가 모두 같아요'];
}
function vClassMatch(back){
  const me = codeOf('');
  if (!me) return `<div class="stack fade-in" style="max-width:720px">${back}<h2 class="title">나와 우리반</h2><div class="box sub">나의 16가지 성격 유형을 먼저 해 주세요. 테스트 탭에서 '나'로 하면 학생들과 닮은 점 · 다른 점을 보여 줘요.</div></div>`;
  const L = students().map(s => [s, codeOf(s.key)]).filter(x => x[1]);
  if (!L.length) return `<div class="stack fade-in" style="max-width:720px">${back}<h2 class="title">나와 우리반</h2><div class="box sub">아직 입력한 학생 성격 유형이 없어요. 성격 유형 입력에서 먼저 넣어 주세요.</div></div>`;
  const ns = L.map(x => sameN(me, x[1])), mx = Math.max(...ns), mn = Math.min(...ns);
  const near = L.filter((x, i) => ns[i] === mx), far = L.filter((x, i) => ns[i] === mn);
  const card = (eb, arr, sub, t) => `<div class="mcard t-${t}"><small>${eb}</small><b>${esc(arr.slice(0, 3).map(x => x[0].name).join(' · ') || '–')}</b><small class="sub">${esc(sub)}</small></div>`;
  return `<div class="stack fade-in" style="max-width:720px">${back}<h2 class="title">나와 우리반</h2>
    <div class="grid2 keep">${card('나와 가장 닮은', near, `${near[0][1]} · 네 글자 중 ${mx}개 같음`, 'green')}${card('나와 가장 다른', far, `${far[0][1]} · ${4 - mn}개 다름`, 'clay')}</div>
    ${listHead('학생마다', `나 ${me} · ${L.length}명`)}
    ${rows(L.map(([s, c]) => { const n = sameN(me, c); return mrow({ icon: 'person', tint: 'sky', title: s.name, sub: c, attrs: `data-cmatch="${s.key}"`, right: badge(n === 4 ? '네 글자 같음' : n === 0 ? '모두 다름' : ['', '한', '두', '세'][n] + ' 글자 같음', n >= 3 ? 'green' : n <= 1 ? 'clay' : 'gray') }); }))}</div>`;
}
function showClassMatch(key){
  const s = members().find(m => m.key === key), me = codeOf(''), c = codeOf(key); if (!s || !me || !c) return;
  const [same, diff] = pairLines(me, c, s.name);
  sheet(`<b class="unz" style="font-size:26px">나와 ${esc(s.name)}</b><div class="sub">나 ${me} · ${esc(s.name)} ${c}</div>
    <div class="box"><div class="row" style="flex-wrap:nowrap;align-items:baseline;gap:10px">${badge('닮은 점', 'green')}<span>${esc(same)}</span></div><div class="row" style="flex-wrap:nowrap;align-items:baseline;gap:10px;margin-top:10px">${badge('다른 점', 'clay')}<span>${esc(diff)}</span></div></div>
    <button class="btn" id="cmMore" style="justify-content:center">자세히 보기</button>
    <p class="sub small" style="margin:0">좋고 나쁨이 아니라 '어디가 닮고 어디가 다른지'예요. 다른 점은 서로를 채워 주는 자리이기도 해요.</p>`);
  $('#cmMore').onclick = () => { closeSheet(); vMatch(s); };
}

/* ================= 💾 백업 · 보관 · 출력 (앱 AppSettings.swift Backup) ================= */
function backupData(){
  const settings = {}; for (const k of SET_KEYS) if (typeof S.set[k] === 'string') settings[k] = S.set[k];
  if (S.set.consentAt != null) settings.consentAt = S.set.consentAt;
  const data = {}; for (const c of COLS) data[c] = { ...S.col[c] };
  return sortKeys({ app: 'maum', v: 1, at: Date.now() / 1000, settings, data });
}
const BK_NAMES = { checkins: '마음 기록', practices: '활동 · 쓴 글', tests: '테스트', found: '도감', members: '가족 · 학생', reports: '검사 결과지', sheets: '우리반 결과지' };
const bkSummary = all => Object.entries(BK_NAMES).map(([k, n]) => { const c = Object.keys((all.data || {})[k] || {}).length; return c ? `${n} ${c}` : ''; }).filter(Boolean).sort().join(' · ');
function vBackup(){
  const span = S.sub.span ?? 1, all = backupData();
  return `<div class="stack fade-in" style="max-width:640px"><h2 class="title">백업 · 보관 · 출력</h2>
    ${listHead('출력')}<div class="box" style="display:grid;gap:10px"><div class="seg">${['한 달', '석 달', '전체'].map((n, i) => `<button data-span="${i}" class="${span === i ? 'on' : ''}">${n}</button>`).join('')}</div>
      <button class="btn main" id="bkPrint" style="justify-content:center">${ico('print')}기록 미리 보기 · 출력</button>
      <p class="sub small" style="margin:0">마음 날씨 · 테스트 결과 · 검사 결과 · 감사 한 줄을 먼저 미리 보고, 프린트하거나 PDF 로 저장해요.</p></div>
    ${listHead('백업', bkSummary(all))}
    ${rows([mrow({ icon: 'drive', tint: 'sky', title: '백업 파일 내려받기', sub: '기록 전부를 파일 하나(.json)로', attrs: 'id="bkDown"' }),
            `<label class="mrow">${tile('archive', 'green')}<span class="mt"><b>백업 파일로 되살리기</b><small>앱 · 웹에서 만든 백업 파일</small></span><i class="chev">›</i><input type="file" id="bkFile" accept=".json,application/json" hidden></label>`])}
    ${S.sub.note ? `<div class="box" style="color:var(--acc);font-weight:600">${esc(S.sub.note)}</div>` : ''}
    <p class="sub small">마음 기록 · 쓴 글 · 테스트 · 도감 · 가족 · 검사 결과지를 파일 하나로 내려받아요. 되살리기는 지금 기록은 그대로 두고 백업에 있던 기록을 더해요 (같은 기록이면 백업 것으로). 파일 안의 글은 잠겨 있지 않으니 믿을 수 있는 곳에만 두세요. 기록은 내 계정에도 따로 저장돼 있어요.</p></div>`;
}
function downloadBackup(){
  const blob = new Blob([JSON.stringify(backupData(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `마음한편-백업-${ymd()}.json`;
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  S.sub.note = '백업 파일을 내려받았어요.'; render();
}
async function restoreBackup(input){
  const f = input.files[0]; input.value = ''; if (!f) return;
  let all = null; try { all = JSON.parse(await f.text()); } catch {}
  if (!all || all.app !== 'maum' || !all.data) { S.sub.note = '마음한편 백업 파일이 아니거나 읽지 못했어요.'; return render(); }
  if (!confirm(`이 백업으로 되살릴까요?\n${bkSummary(all)}\n\n지금 기록은 그대로 두고 이 백업의 기록을 더해요.`)) return;
  const out = []; for (const c of COLS) for (const [k, r] of Object.entries(all.data[c] || {})) if (r && typeof r === 'object') out.push([c, k, r]);
  await putMany(out);
  const s = all.settings || {}, patch = {}; for (const k of SET_KEYS) if (typeof s[k] === 'string') patch[k] = s[k];
  if (typeof s.consentAt === 'number') patch.consentAt = s.consentAt;
  if (Object.keys(patch).length) await saveSet(patch);
  S.sub.note = `기록 ${out.length}개를 되살렸어요.`; render();
}

/* ── 새 화면 단추 잇기 ── */
function bindMore(v){
  const on = (sel, f) => document.querySelectorAll(sel).forEach(b => b.onclick = () => f(b));
  on('[data-cls]', b => { const k = b.dataset.cls; if (S.view !== 'class') { S.view = 'class'; location.hash = '#/class'; } nav(k ? { tool: k } : {}); });
  if ($('#hrEdit')) $('#hrEdit').onclick = editMe;
  if (v === 'report' && $('#printMonth')) $('#printMonth').onclick = () => printDoc(recordsHTML(monthsAgo(1)));
  if (v === 'reports') {
    if ($('#rAdd')) $('#rAdd').onclick = () => nav({ add: { who: '', files: [] } });
    on('[data-rid]', b => nav({ id: b.dataset.rid }));
    on('[data-rback]', () => nav({}));
    on('[data-rwho]', b => { S.sub.add.who = b.dataset.rwho; render(); });
    if ($('#rMember')) $('#rMember').onclick = addMember;
    if ($('#rFiles')) $('#rFiles').onchange = e => pickReportFiles(e.target);
    if ($('#rClear')) $('#rClear').onclick = () => { S.sub.add.files = []; render(); };
    if ($('#rRead')) $('#rRead').onclick = readReport;
    if ($('#rHand')) $('#rHand').onclick = () => nav({ edit: { isNew: true, key: uuid(), rec: { who: S.sub.add.who || '', title: '', org: '', day: sec(dayStart()), memo: '', ai: '', at: sec(new Date()), rows: [{ group: '', name: '', score: '', kind: '', band: '', note: '' }] } } });
    if (S.sub.edit) {
      const E = S.sub.edit, r = E.rec;
      document.querySelectorAll('[data-rf]').forEach(el => el.oninput = () => { const f = el.dataset.rf; if (f === 'date') { if (el.value) r.day = sec(new Date(el.value + 'T00:00:00')); } else r[f] = el.value; });
      document.querySelectorAll('[data-rr]').forEach(el => el.oninput = () => { const [i, f] = el.dataset.rr.split('|'); r.rows[+i][f] = el.value; });
      on('[data-rdel]', b => { r.rows.splice(+b.dataset.rdel, 1); render(); });
      if ($('#rRow')) $('#rRow').onclick = () => { r.rows.push({ group: '', name: '', score: '', kind: '', band: '', note: '' }); render(); };
      on('[data-rcancel]', () => nav(E.isNew ? {} : { id: E.key }));
      $('#rSave').onclick = async () => {
        const rec = { ...r, rows: r.rows.filter(x => x.name.trim() || x.score.trim()), at: sec(new Date()) };
        S.sub = { id: E.key }; window.scrollTo(0, 0); await put('reports', E.key, rec); toast('저장했어요');
      };
    }
    if (S.sub.id) {
      const r = S.col.reports[S.sub.id];
      if ($('#rAI')) $('#rAI').onclick = explainReport;
      if ($('#rEdit')) $('#rEdit').onclick = () => nav({ edit: { isNew: false, key: S.sub.id, rec: JSON.parse(JSON.stringify({ rows: [], ...r })) } });
      if ($('#rPrint')) $('#rPrint').onclick = () => printDoc(reportPrintHTML({ key: S.sub.id, ...r }));
      if ($('#rDel')) $('#rDel').onclick = () => { if (confirm('이 검사 결과를 지울까요? 다른 기기에서도 지워져요.')) { const k = S.sub.id; nav({}); del('reports', k); } };
    }
  }
  if (v === 'class') {
    if ($('#bulkAdd')) $('#bulkAdd').onclick = bulkAdd;
    on('[data-medit]', b => editMember(b.dataset.medit));
    on('[data-up]', b => moveStudent(b.dataset.up, -1));
    on('[data-down]', b => moveStudent(b.dataset.down, 1));
    on('[data-term]', b => { S.sub.term = +b.dataset.term; S.sub.draft = {}; render(); });
    on('[data-ax]', b => { const [w, a, l] = b.dataset.ax.split('|'); setAxis(w, +a, l); });
    on('[data-tdel]', b => { if (confirm('이 결과를 지울까요?')) del('tests', b.dataset.tdel); });
    if ($('#typesPrint')) $('#typesPrint').onclick = () => printDoc(typesPrintHTML());
    on('[data-sheet]', b => nav({ tool: 'sheets', sheet: b.dataset.sheet }));
    if ($('#sFiles')) $('#sFiles').onchange = e => pickSheetFiles(e.target);
    if ($('#sClear')) $('#sClear').onclick = () => { S.sub.sAdd = { files: [], text: '' }; render(); };
    if ($('#sRead')) $('#sRead').onclick = readSheet;
    on('[data-open]', b => { const n = +b.dataset.open; S.sub.open = S.sub.open === n ? null : n; render(); });
    if ($('#sPrint')) $('#sPrint').onclick = () => printDoc(sheetPrintHTML(S.col.sheets[S.sub.sheet]));
    if ($('#sDel')) $('#sDel').onclick = () => { if (confirm('이 결과지를 지울까요? 다른 기기에서도 지워져요.')) { const k = S.sub.sheet; nav({ tool: 'sheets' }); del('sheets', k); } };
    if ($('#tMinus')) $('#tMinus').onclick = () => { S.sub.teams = Math.max(2, (S.sub.teams || 6) - 1); S.sub.made = []; render(); };
    if ($('#tPlus')) $('#tPlus').onclick = () => { S.sub.teams = Math.min(10, (S.sub.teams || 6) + 1); S.sub.made = []; render(); };
    if ($('#tMake')) $('#tMake').onclick = makeTeams;
    on('[data-cmatch]', b => showClassMatch(b.dataset.cmatch));
  }
  if (v === 'backup') {
    on('[data-span]', b => { S.sub.span = +b.dataset.span; render(); });
    $('#bkPrint').onclick = () => { const sp = S.sub.span ?? 1; printDoc(recordsHTML(sp === 2 ? 0 : monthsAgo(sp === 0 ? 1 : 3))); };
    $('#bkDown').onclick = downloadBackup;
    $('#bkFile').onchange = e => restoreBackup(e.target);
  }
}

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
    const ta = $('#aiText') || $('#talkText'); if (ta) bindTick(ta, 'aiTick', '임시 저장', v => ls.set('draft.' + tab, v));
    if ($('#goAI')) $('#goAI').onclick = runAI;
    if ($('#send')) { $('#send').onclick = sendTalk; $('#talkText').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendTalk(); } }; }
    if ($('#newTalk')) $('#newTalk').onclick = () => { ls.set('talk.' + ymd(), []); render(); };
    document.querySelectorAll('[data-reuse]').forEach(b => b.onclick = () => { ls.set('draft.' + tab, b.dataset.reuse); S.sub.answer = null; render(); });
    document.querySelectorAll('[data-dellog]').forEach(b => b.onclick = () => { if (confirm('이 기록을 지울까요? 다른 기기에서도 지워져요.')) del('practices', b.dataset.dellog); });
  }
  if (v === 'breath') { $('#bStart').onclick = startBreath; document.querySelectorAll('[data-write]').forEach(b => b.onclick = () => openNote(b.dataset.write)); }
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
    document.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { S.sub.pick = +b.dataset.pick; render(); });
    if ($('#dexMemo')) { const no = S.sub.no, el = $('#dexMemo');
      bindTick(el, 'memoTick', '도감에 저장', v => ls.set('draft.memo.' + no, v));
      el.onchange = () => saveRingMemo(no, el.value); }
    if ($('#dexText')) bindTick($('#dexText'), 'dexTick', '임시 저장', v => ls.set('draft.dex', v));
    if ($('#dexGo')) $('#dexGo').onclick = dexFind;
    document.querySelectorAll('[data-clue]').forEach(b => b.onclick = () => { const no = +b.dataset.clue; toast(C.dex.clueText ? C.dex.clueText(no) : '도감 위 칸에 궁금한 사람 이야기를 적어 찾아봐요'); });
  }
  if (v === 'vault') document.querySelectorAll('[data-res]').forEach(b => b.onclick = () => { S.view = 'test'; S.sub = { result: b.dataset.res }; render(); });
  if (v === 'me') {
    $('#avatarApp').onclick = () => toast('캐릭터는 아이폰 앱의 내 계정에서 골라요. 고른 캐릭터는 웹에도 따라와요');
    $('#nickEdit').onclick = () => { const t = (prompt('별명 (12글자까지 · 실명 대신 별명을 써요)', S.set.nickname || '') || '').trim().slice(0, 12); if (t) saveSet({ nickname: t }); };
    $('#gradeEdit').onclick = editMe;
  }
  bindMore(v);
}

/* ── 시작 ── */
function shell(){
  const nav = NAV.map(([k, n]) => `<a class="nav" href="#/${k}" data-v="${k}">${n}</a>`).join('');
  const more = MENU.map(g => g.map(([k, n]) => `<a class="nav" href="#/${k}" data-v="${k}">${n}</a>`).join('')).join('<hr>');
  $('#app').innerHTML = `<aside class="side"><a class="logo" href="#/home">마음한편</a>${nav}<hr><span id="sideClass"></span>${more}
      <a class="me" href="#/me"><img src="/maum/character.png" alt=""><div><b id="meName"></b><small id="meSub"></small></div></a>
      <div class="sidefoot"><a href="/maum/privacy.html" target="_blank">개인정보 처리방침</a><a href="/maum/terms.html" target="_blank">이용약관</a><button id="sideOut">로그아웃</button></div></aside>
    <div><div class="mtop"><span class="t">마음한편</span><button id="menuBtn" aria-label="메뉴">☰</button></div><main id="view"></main></div>
    ${S.demo ? `<div class="tourbar"><b>둘러보기 중</b><span>예시 기록이에요. 마음껏 눌러 보세요 (저장되지 않아요)</span><a class="btn small main" href="/maum/">로그인하고 시작하기</a></div>` : ''}
    <nav class="tabs"><a href="#/test" data-v="test">테스트</a><a href="#/breath" data-v="breath">마음근력</a><a href="#/home" data-v="home" class="plus" aria-label="홈">홈</a><a href="#/ai" data-v="ai">AI 티쳐</a><a href="#/dex" data-v="dex">도감</a></nav>`;
  $('#sideOut').onclick = logout;
  $('#menuBtn').onclick = openMenu;
}
/* ☰ 메뉴 (앱 MenuItems 차례: 내 계정 | 마음 보고서 · 검사 결과지 · 기록 보관함 · 백업 · 보관 · 출력 | 사용 설명서 · 문의하기 · 힘들 때 | 약관 | 로그아웃 · 계정 지우기) */
function openMenu(){
  const r = (k, n, ic, t, extra = '') => `<a class="mrow" href="#/${k}">${tile(ic, t)}<span class="mt"><b>${esc(n)}</b>${extra ? `<small>${esc(extra)}</small>` : ''}</span><i class="chev">›</i></a>`;
  sheet(`<b class="unz" style="font-size:24px">메뉴</b>
    <div class="mlist">${r('me', '내 계정', 'person', 'navy', S.set.nickname || '')}${isHomeroom() ? r('class', '담임 도구', 'people', 'green', homeroomLabel()) : ''}</div>
    ${MENU.map(g => `<div class="mlist">${g.map(([k, n, ic, t]) => r(k, n, ic, t)).join('')}</div>`).join('')}
    <div class="mlist"><a class="mrow" href="/maum/privacy.html" target="_blank">${tile('shield', 'gray')}<span class="mt"><b>개인정보 처리방침</b></span><i class="chev">›</i></a><a class="mrow" href="/maum/terms.html" target="_blank">${tile('doc', 'gray')}<span class="mt"><b>이용약관</b></span><i class="chev">›</i></a></div>
    <div class="mlist"><button class="mrow" id="mOut">${tile('out', 'gray')}<span class="mt"><b>로그아웃</b></span></button><button class="mrow" id="mDel">${tile('trash', 'clay')}<span class="mt"><b>계정 지우기</b><small>아이폰 앱의 ☰ › 계정 지우기에서 해요</small></span></button></div>`);
  document.querySelectorAll('#sheet a').forEach(a => a.addEventListener('click', closeSheet));
  $('#mOut').onclick = () => { closeSheet(); logout(); };
  $('#mDel').onclick = () => toast('계정 지우기는 아이폰 앱의 ☰ › 계정 지우기에서 할 수 있어요. 지우면 모든 기기의 기록이 함께 지워져요');
}
function logout(){ if (S.demo) return toast('둘러보기에서는 로그아웃이 없어요'); if (confirm('로그아웃할까요? 기록은 계정에 그대로 있어요.')) auth.signOut(); }
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
  // 2026-11-26 더함: 마음 보고서 · 검사 결과지 · 담임 도구 · 도감 배지를 볼 수 있게 (?demo&teacher = 교사 모드)
  const q0 = new URLSearchParams(location.search);
  put0('settings', 'me', { consentAt: 1, nickname: '바람 수달', grade: '초4 · 초2 엄마 · 1학년 10반 담임', mode: q0.has('teacher') ? 'teacher' : 'parent',
    meTags: JSON.stringify({ grade: '', homeroom: '1학년 10반', kids: ['초4', '초2'], parent: '엄마', roles: ['parent', 'teacher'] }) });
  put0('members', 'm2', { name: '남편', role: 'partner', avatar: '', order: 2, at: now });
  const codes = ['ENFP', 'ISFJ', 'INFJ', 'ESTJ', 'ISTP', 'ENTP', 'ISFP', 'ESFJ', 'INTP', 'ENFJ'];
  for (let n = 1; n <= 12; n++) {
    put0('members', 's' + n, { name: hangulName(n), role: 'student', avatar: '', order: 10 + n, at: now });
    if (n <= 9) { const c = codes[n % codes.length]; put0('tests', 'ty' + n, { kind: 'type16', scores: typeScores(c), code: c, at: sec(termDate(0)), who: 's' + n, set: -1 }); }
  }
  put0('tests', 'ty2b', { kind: 'type16', scores: typeScores('ESFJ'), code: 'ESFJ', at: sec(termDate(1)), who: 's2', set: -1 });
  put0('sheets', 'sh1', { title: '학교생활 적응 검사', day: now - 20 * 86400, kind: 'scores', cols: ['학업 스트레스', '또래 관계', '불안', '우울', '자아 존중'],
    rows: [[48, 52, 44, 41, 58], [67, 45, 70, 61, 39], [55, 49, 52, 47, 51], [42, 66, 46, 44, 62], [59, 58, 68, 66, 40], [50, 47, 49, 52, 55], [61, 44, 57, 48, 47], [45, 53, 41, 43, 60], [52, 50, 48, 50, 52], [70, 39, 62, 58, 44], [47, 55, 50, 46, 57], [53, 61, 45, 42, 59]].map((v, i) => ({ no: i + 1, values: v.map(String), tags: [], note: '' })),
    summary: '대부분 고른 편이에요. 불안 · 우울 칸이 65 이상인 학생이 있어 한 번 더 살펴보면 좋아요.', at: now });
  put0('sheets', 'sh2', { title: '진로 흥미 검사 소견', day: now - 40 * 86400, kind: 'notes', cols: [],
    rows: [['탐구형', '예술형', '사회형'], ['사회형', '관습형'], ['예술형', '탐구형'], ['현실형', '탐구형', '관습형']].map((t, i) => ({ no: i + 1, values: [], tags: t, note: '호기심이 많고 스스로 알아보는 것을 좋아해요. 관심 있는 주제를 깊게 파고들 기회를 주면 좋아요.' })),
    summary: '탐구형이 가장 많아요.', at: now });
  const R = (g, n, sc, k, b) => ({ group: g, name: n, score: sc, kind: k, band: b, note: '' });
  put0('reports', 'r1', { who: 'm1', title: 'K-WISC-V', org: '상담센터', day: now - 400 * 86400, memo: '', ai: '', at: now,
    rows: [R('기본 지표', '전체 IQ', '104', '합산점수', '평균'), R('기본 지표', '언어이해', '110', '지표점수', '평균 상'), R('기본 지표', '작업기억', '96', '지표점수', '평균')] });
  put0('reports', 'r2', { who: 'm1', title: 'K-WISC-V', org: '상담센터', day: now - 10 * 86400, memo: '처리속도가 다른 지표보다 낮은 편이에요.', at: now,
    rows: [R('기본 지표', '전체 IQ', '108', '합산점수', '평균'), R('기본 지표', '언어이해', '115', '지표점수', '평균 상'), R('기본 지표', '작업기억', '102', '지표점수', '평균'), R('기본 지표', '처리속도', '88', '지표점수', '평균 하'), R('소검사', '공통성', '13', '환산점수', ''), R('소검사', '기호쓰기', '7', '환산점수', ''), R('정서', '불안', '62', 'T점수', '경계'), R('정서', '주의집중', '84', '백분위', '')],
    ai: JSON.stringify({ summary: '말로 이해하고 표현하는 힘이 또래보다 좋은 편이에요. 손으로 빠르게 옮겨 쓰는 일은 시간이 조금 더 걸려요.', strengths: ['낱말 뜻을 잘 알고 설명을 잘해요', '지난번보다 전체 점수가 조금 올랐어요'], watch: ['빨리 써야 하는 숙제에서 지칠 수 있어요'], home: ['숙제를 작게 나눠 쉬는 시간을 넣어 주세요'], ask: ['처리속도가 낮게 나온 까닭이 무엇인지 여쭤 보세요'] }) });
  // 도감: 한 마음을 세 사람에게서 찾음 + 메모
  const rep6 = w => ['겉으로는 ' + w + '처럼 보여도 속은 여려요', '인정받고 싶은 마음', '실수할까 걱정돼서', '먼저 마음을 알아주기', '작은 칭찬', '비난하는 말'];
  put0('found', 'f3', { no: 7, who: '회사 동료', at: now - 86400, story: '회의 때 동료', report: rep6('센 사람') });
  put0('found', 'f4', { no: 7, who: '첫째', at: now - 3 * 86400, story: '', report: rep6('고집쟁이') });
  put0('practices', 'p3', { kind: 'ai', at: now - 86400 + 30, day: now - 86400, text: JSON.stringify({ t: 'other', q: '회의 때마다 목소리가 커지는 동료가 있어', feeling: '내 말도 들어 줬으면 좋겠어', ring: '7' }) });
  put0('practices', 'p4', { kind: 'thanks', at: now - 7200, day: now, text: '아이가 먼저 안아 줬다' });
  S.user = { uid, providerData: [], getIdToken: async () => '' };
  document.body.classList.add('app-on'); $('#intro').hidden = true; $('#app').hidden = false;
  shell(); listen(uid); fromHash(); addEventListener('hashchange', fromHash);   // 둘러보기에서도 메뉴 · 탭 주소로 화면이 바뀌게
  const q = new URLSearchParams(location.search);
  if (q.get('res')) { S.view = 'test'; S.sub = { result: q.get('res') }; }
  if (q.get('run')) { S.view = 'test'; S.sub = {}; startTest(q.get('run')); }
  if (q.get('match')) { S.view = 'test'; S.sub = { who: 'm1' }; render(); vMatch(members()[0]); }
  if (q.get('tool')) { S.view = 'class'; S.sub = { tool: q.get('tool'), ...(q.get('sheet') ? { sheet: q.get('sheet') } : {}) }; }
  if (q.get('rid')) { S.view = 'reports'; S.sub = { id: q.get('rid') }; }
  if (q.get('dexno')) { S.view = 'dex'; S.sub = { no: +q.get('dexno') }; }
  render();
}
window.MaumWeb = { boot: () => (new URLSearchParams(location.search).has('demo') && !/admin/.test(location.hash) ? demo() : boot()) };
})();
