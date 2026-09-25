/* ============================================================
   moontr 방문 수 세기 + 작은 표시 (모든 웹앱이 같이 씁니다)

   쓰는 법: 페이지 </body> 바로 위에 한 줄
     <script type="module" src="/visit.js?app=이름"></script>
     - 이름: 영어·숫자로 된 앱 이름 (폴더 이름과 같게). 관리자 허브 [홈]에서 이 이름으로 모읍니다
     - &pos=br 을 붙이면 오른쪽 아래, 기본은 왼쪽 아래
     - &hide=1 을 붙이면 세기만 하고 화면에는 안 보임
     - &policy=주소 를 붙이면 숫자 옆에 [이용약관·개인정보] 링크 (푸터를 둘 수 없는 화면용)
       &policy=gas 는 "구글 시트로 만든 수업 웹앱" 안내를 이 화면 안에 작은 창으로 띄웁니다 (이 웹앱에 대한 내용만)

   - 한 번 들어올 때(탭을 닫기 전까지) 한 번만 셉니다
   - 관리자 화면(?admin · #admin · #teacher)이나 관리자 허브 안에서 열리면 세지 않습니다
   - 기록: Firestore site_counts 에 "이름__total"(누적), "이름__d2026-09-25"(그날) 숫자 하나씩
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const q = new URL(import.meta.url).searchParams;
const APP = (q.get('app') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
if (APP) start().catch(() => {});

async function start(){
  const app = initializeApp({
    apiKey: "AIzaSyA3CxawUPIfGeBWyffsNbCSM3ymjKHLH6o",
    authDomain: "moon-d528d.firebaseapp.com",
    projectId: "moon-d528d",
    storageBucket: "moon-d528d.firebasestorage.app",
    messagingSenderId: "126636401536",
    appId: "1:126636401536:web:25b8a8296ec42b86f99765"
  }, 'moontr-visit');
  const db = getFirestore(app);
  const now = new Date();
  const day = `d${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const totalRef = doc(db, 'site_counts', `${APP}__total`);
  const todayRef = doc(db, 'site_counts', `${APP}__${day}`);

  let inHub = false;
  try { inHub = window.top !== window; } catch { inHub = true; }
  const isAdmin = /[?&]admin/.test(location.search) || /^#(admin|teacher)/.test(location.hash) || inHub;
  let counted = false;
  try { counted = sessionStorage.getItem('moontr-visit-' + APP) === '1'; } catch {}

  /* 숫자 하나를 1 올리기 (없으면 1로 만들기) */
  const bump = ref => runTransaction(db, async tx => {
    const s = await tx.get(ref);
    tx.set(ref, { n: s.exists() ? (s.data().n || 0) + 1 : 1 });
  });
  if (!isAdmin && !counted){
    try { sessionStorage.setItem('moontr-visit-' + APP, '1'); } catch {}
    await Promise.all([bump(totalRef), bump(todayRef)]).catch(() => {});
  }
  if (q.get('hide') === '1') return;

  /* 작은 알약: [오늘 · 누적] (+ 이용약관 링크) */
  const el = document.createElement('div');
  el.className = 'moontr-visit';
  const right = q.get('pos') === 'br';
  el.style.cssText = `position:fixed;${right ? 'right' : 'left'}:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:9;`
    + 'display:flex;gap:6px;align-items:center;font:11px/1.4 system-ui,-apple-system,sans-serif;color:inherit;opacity:.45;'
    + 'padding:3px 9px;border-radius:999px;background:rgba(128,128,128,.14);pointer-events:none;user-select:none;white-space:nowrap;';
  const num = document.createElement('span');
  el.appendChild(num);
  const policy = q.get('policy');
  if (policy){
    const a = document.createElement('a');
    a.textContent = '이용약관·개인정보';
    a.style.cssText = 'color:inherit;pointer-events:auto;text-decoration:underline;text-underline-offset:2px;cursor:pointer';
    if (policy === 'gas'){ a.href = '#'; a.addEventListener('click', e => { e.preventDefault(); openGasPolicy(right); }); }
    else { a.href = policy; a.target = '_blank'; a.rel = 'noopener'; }
    el.appendChild(a);
  }
  document.body.appendChild(el);

  /* 숫자는 나중에 채움 (못 읽으면 이용약관 링크만 남음) */
  const [t, n] = await Promise.all([getDoc(todayRef), getDoc(totalRef)]);
  const today = t.exists() ? t.data().n || 0 : 0, total = n.exists() ? n.data().n || 0 : 0;
  el.setAttribute('aria-label', `오늘 방문 ${today}회, 누적 방문 ${total}회`);
  num.textContent = `오늘 ${today.toLocaleString()} · 누적 ${total.toLocaleString()}`;
}

/* 구글 앱스 스크립트로 만든 수업 웹앱: 이 웹앱에 대한 이용약관·개인정보 처리방침 (작은 창) */
function openGasPolicy(right){
  let box = document.getElementById('moontr-policy');
  if (box){ box.remove(); return; }
  box = document.createElement('div');
  box.id = 'moontr-policy';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', '이용약관 · 개인정보 처리방침');
  box.style.cssText = `position:fixed;${right ? 'right' : 'left'}:12px;bottom:calc(44px + env(safe-area-inset-bottom,0px));z-index:10;`
    + 'width:min(380px,calc(100vw - 24px));max-height:70vh;overflow:auto;padding:16px 18px;border-radius:14px;'
    + 'background:#fff;color:#1F2A37;border:1px solid #E3DFD4;box-shadow:0 18px 40px -16px rgba(0,0,0,.4);'
    + 'font:13px/1.7 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;word-break:keep-all;';
  box.innerHTML = `
    <button type="button" aria-label="닫기" style="float:right;border:0;background:#F1F1EE;border-radius:999px;width:28px;height:28px;cursor:pointer">✕</button>
    <b style="font-size:15px">이용약관 · 개인정보 처리방침</b>
    <p style="margin:8px 0">이 웹앱은 진선여자고등학교 교사가 수업 활동을 위해 구글 앱스 스크립트로 만들어 운영합니다.</p>
    <b>이용약관</b>
    <ul style="margin:4px 0 8px;padding-left:1.2em">
      <li>수업 활동을 위한 목적으로만 이용해 주세요.</li>
      <li>다른 사람의 학번·이름으로 입력하거나, 다른 사람의 개인정보·비방을 적지 마세요.</li>
    </ul>
    <b>개인정보 처리방침</b>
    <ul style="margin:4px 0 8px;padding-left:1.2em">
      <li><b>받는 정보</b>: 이 활동에서 직접 입력한 내용 (예: 학번·이름·답변)</li>
      <li><b>저장 위치</b>: 교사 구글 계정의 구글 시트 · 교사만 봅니다</li>
      <li><b>쓰임</b>: 수업 진행과 피드백</li>
      <li><b>보관</b>: 활동이 끝나면 교사가 지웁니다</li>
      <li>화면은 Google(script.google.com)에서 불러오며, 구글 계정에 로그인한 상태라면 Google 의 정책이 함께 적용됩니다.</li>
      <li>왼쪽 아래 방문 수는 횟수만 세고, 누가 들어왔는지는 남기지 않습니다.</li>
    </ul>
    <p style="margin:6px 0 0;color:#5F6B7A">입력한 기록을 보거나 지우고 싶으면: anstjsdud@sen.go.kr</p>`;
  box.querySelector('button').addEventListener('click', () => box.remove());
  document.body.appendChild(box);
}
