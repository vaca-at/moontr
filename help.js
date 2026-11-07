/* 💬 문의 채팅 (2026-11-07) — 스냅주 · 큰법당 · 캠핑장 · 소호랩이 함께 써요
   쓰는 법: </body> 위에 <script src="https://moontr.site/help.js" data-app="snapzoo" defer></script>
   - data-float="1" 이면 오른쪽 아래에 작은 💬 단추가 떠요 (data-right · data-bottom 으로 자리 옮기기, px)
   - 앱 메뉴에서 열 때: window.moontrHelp.open()
   - 글을 남기면 AI 가 먼저 답하고(‘AI 답변’ 표시), 관리자가 moontr.site/help/ 에서 확인해 답해요
   - 기기마다 정한 번호로 대화가 이어져요 (로그인 없음, 개인 정보는 받지 않아요) */
(() => {
  const me = document.currentScript, APP = me?.dataset.app || '', API = 'https://moontr-help.bellachord.workers.dev';
  if (!APP || window.moontrHelp) return;
  const KEY = 'moontr-help-uid';
  let uid = ''; try { uid = localStorage.getItem(KEY) || ''; } catch {}
  if (!/^[A-Za-z0-9_-]{12,40}$/.test(uid)) { uid = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join(''); try { localStorage.setItem(KEY, uid); } catch {} }
  const css = `
.mh-fab{position:fixed;right:var(--mh-r,12px);bottom:var(--mh-b,12px);z-index:2147482000;width:44px;height:44px;border-radius:50%;border:0;background:rgba(30,26,22,.62);color:#fff;font-size:20px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);display:grid;place-items:center;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.mh-fab i,.mh-dot{position:absolute;top:2px;right:2px;width:10px;height:10px;border-radius:50%;background:#e84a3a;display:none}.mh-fab.new i{display:block}
.mh-wrap{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;background:rgba(20,16,12,.4);font-family:inherit}
.mh-wrap.on{display:flex}
.mh-box{width:min(420px,94vw);height:min(600px,84vh);background:#fbf8f0;color:#3a2e24;border-radius:18px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.35)}
.mh-top{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #e8dfcc}
.mh-top b{display:block;font-size:19px;font-weight:600}.mh-top small{display:block;font-size:13px;color:#8a7a6a}
.mh-x{margin-left:auto;width:36px;height:36px;border-radius:50%;border:1.5px solid #d8cdb8;background:#fff;color:#3a2e24;font-size:18px;cursor:pointer}
.mh-list{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
.mh-m{max-width:84%;padding:8px 12px;border-radius:14px;font-size:15px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
.mh-m.user{align-self:flex-end;background:#c8553d;color:#fff;border-bottom-right-radius:4px}
.mh-m.ai,.mh-m.op,.mh-m.hi{align-self:flex-start;background:#fff;border:1px solid #e8dfcc;border-bottom-left-radius:4px}
.mh-m.op{border-color:#6b8f4a;background:#f2f8ec}
.mh-m em{display:block;font-style:normal;font-size:12px;color:#8a7a6a;margin-bottom:2px}.mh-m.op em{color:#4f7a3a}
.mh-wait{align-self:flex-start;font-size:13px;color:#8a7a6a}
.mh-form{display:flex;gap:8px;padding:10px;border-top:1px solid #e8dfcc;background:#fff}
.mh-form input{flex:1;min-width:0;font:16px inherit;font-family:inherit;padding:10px 12px;border-radius:12px;border:1.5px solid #d8cdb8;background:#fbf8f0;color:#3a2e24}
.mh-form button{font:16px inherit;font-family:inherit;padding:0 16px;border-radius:12px;border:0;background:#c8553d;color:#fff;cursor:pointer}
.mh-form button:disabled{opacity:.5}
.mh-note{font-size:12px;color:#a89a8a;padding:0 12px 8px;background:#fff}`;
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  const wrap = document.createElement('div'); wrap.className = 'mh-wrap'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', '문의하기');
  wrap.innerHTML = `<div class="mh-box"><div class="mh-top"><div><b>문의하기</b><small>AI 가 먼저 답하고, 관리자도 확인해서 답해요</small></div><button type="button" class="mh-x" aria-label="닫기">✕</button></div><div class="mh-list" aria-live="polite"></div><form class="mh-form"><input type="text" maxlength="800" placeholder="궁금한 점 · 불편한 점을 적어 주세요" aria-label="문의 내용"><button type="submit">보내기</button></form><p class="mh-note">이름 · 전화번호 같은 개인 정보는 적지 말아 주세요.</p></div>`;
  const list = wrap.querySelector('.mh-list'), form = wrap.querySelector('form'), input = form.querySelector('input'), btn = form.querySelector('button');
  // 게임 단축키(W A S D 등)가 글쓰기에 끼어들지 않게
  for (const ev of ['keydown', 'keyup', 'keypress', 'pointerdown', 'wheel', 'touchstart']) wrap.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev !== 'keydown' && ev !== 'keyup' && ev !== 'keypress' ? true : undefined });
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('.mh-x').onclick = () => close();
  let msgs = [], busy = false, timer = 0, fab = null;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function draw() {
    const hi = `<div class="mh-m hi"><em>안내</em>안녕하세요! 궁금한 점이나 불편한 점, 바라는 점을 편하게 적어 주세요. AI 가 먼저 답하고, 관리자도 읽고 이 창에 답을 남겨요.</div>`;
    list.innerHTML = hi + msgs.map((m) => `<div class="mh-m ${m.from}">${m.from === 'ai' ? '<em>AI 답변</em>' : m.from === 'op' ? '<em>관리자</em>' : ''}${esc(m.text)}</div>`).join('') + (busy ? '<div class="mh-wait">AI 가 답을 쓰고 있어요…</div>' : '');
    list.scrollTop = list.scrollHeight;
  }
  async function load(peek) {
    try { const r = await fetch(`${API}/list?app=${APP}&uid=${uid}${peek ? '&peek=1' : ''}`, { cache: 'no-store' }).then((x) => x.json()); if (peek) return r.unread || 0; msgs = r.msgs || []; draw(); fab?.classList.remove('new'); } catch {}
    return 0;
  }
  form.onsubmit = async (e) => {
    e.preventDefault(); const text = input.value.trim(); if (!text || busy) return;
    input.value = ''; msgs.push({ from: 'user', text }); busy = true; btn.disabled = true; draw();
    try {
      const name = typeof window.moontrHelpName === 'function' ? window.moontrHelpName() : window.moontrHelpName || '';
      const r = await fetch(`${API}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app: APP, uid, text, name: String(name || '').slice(0, 20) }) }).then((x) => x.json());
      if (r.msgs) msgs = r.msgs; else msgs.push({ from: 'ai', text: r.error || '지금은 보내지 못했어요. 잠시 뒤에 다시 보내 주세요.' });
    } catch { msgs.push({ from: 'ai', text: '인터넷 연결이 끊겨서 보내지 못했어요. 잠시 뒤에 다시 보내 주세요.' }); }
    busy = false; btn.disabled = false; draw();
  };
  function open() { wrap.classList.add('on'); draw(); load(); clearInterval(timer); timer = setInterval(() => { if (!document.hidden && !busy) load(); }, 20000); setTimeout(() => input.focus({ preventScroll: true }), 50); }
  function close() { wrap.classList.remove('on'); clearInterval(timer); }
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && wrap.classList.contains('on')) close(); });
  const start = () => {
    document.body.append(wrap);
    if (me.dataset.float === '1') {
      fab = document.createElement('button'); fab.type = 'button'; fab.className = 'mh-fab'; fab.setAttribute('aria-label', '문의하기'); fab.innerHTML = '💬<i></i>';
      if (me.dataset.right) fab.style.setProperty('--mh-r', me.dataset.right + 'px'); if (me.dataset.bottom) fab.style.setProperty('--mh-b', me.dataset.bottom + 'px');
      fab.onclick = open; document.body.append(fab);
    }
    // 관리자 답이 와 있으면 단추에 빨간 점 · 앱에는 'moontr-help-unread' 소식
    load(true).then((n) => { if (n) { fab?.classList.add('new'); dispatchEvent(new CustomEvent('moontr-help-unread', { detail: n })); } });
  };
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);
  window.moontrHelp = { open, close };
})();
