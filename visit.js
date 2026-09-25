/* ============================================================
   moontr 방문 수 세기 + 작은 표시 (모든 웹앱이 같이 씁니다)

   쓰는 법: 페이지 </body> 바로 위에 한 줄
     <script type="module" src="/visit.js?app=이름"></script>
     - 이름: 영어·숫자로 된 앱 이름 (폴더 이름과 같게). 관리자 허브 [홈]에서 이 이름으로 모읍니다
     - &pos=br 을 붙이면 오른쪽 아래, 기본은 왼쪽 아래
     - &hide=1 을 붙이면 세기만 하고 화면에는 안 보임
     - &policy=주소 를 붙이면 숫자 옆에 [이용약관·개인정보] 링크 (푸터를 둘 수 없는 화면용)

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
    a.href = policy; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = '이용약관·개인정보';
    a.style.cssText = 'color:inherit;pointer-events:auto;text-decoration:underline;text-underline-offset:2px';
    el.appendChild(a);
  }
  document.body.appendChild(el);

  /* 숫자는 나중에 채움 (못 읽으면 이용약관 링크만 남음) */
  const [t, n] = await Promise.all([getDoc(todayRef), getDoc(totalRef)]);
  const today = t.exists() ? t.data().n || 0 : 0, total = n.exists() ? n.data().n || 0 : 0;
  el.setAttribute('aria-label', `오늘 방문 ${today}회, 누적 방문 ${total}회`);
  num.textContent = `오늘 ${today.toLocaleString()} · 누적 ${total.toLocaleString()}`;
}
