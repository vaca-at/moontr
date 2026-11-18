// 🔍 자료 찾기 창 (2026-11-18): 연구소 방 화면 · 마을 · 공문 레이더 어디서든 오른쪽 위 같은 자리에 늘 펼쳐져 있어요.
// - 자리: 화면 오른쪽 위, 동그란 새로고침 단추(🔄 refresh.js) 바로 왼쪽. 크기 · 모양도 모든 화면에서 같아요
// - 연구소 방 화면(index.html): 머리줄의 원래 찾기 칸(#search)을 이 자리로 옮겨요. 글을 쓰면 바로 '찾기' 결과가 나와요 (app.js 그대로)
// - 마을 · 레이더: 키워드를 쓰고 Enter → 연구소 '찾기' 결과로 넘어가요 (주소 ../?q=키워드#lobby)
// - 키보드 / 를 누르면 어느 화면에서나 바로 찾기 칸에 써요 · Esc 는 지우기
// - 로그인 전(body.guest)에는 숨겨요. 연구소는 관리자만 쓰니까요
// 쓰는 법: <script type="module" src="search.js"></script> (마을 · 레이더는 src="../search.js" data-base="../" data-pad="#top" 처럼)
const me = document.currentScript || document.querySelector('script[src$="search.js"]');
const ds = (me && me.dataset) || {};
const BASE = ds.base || '';          // 연구소 첫 화면까지 가는 길 ('' 또는 '../')
const W = 'min(300px, calc(100vw - 80px))';
// PAD = 찾기 칸 자리를 비워 둘 머리줄 (연구소 방 화면은 .top). 컴퓨터는 오른쪽을, 휴대폰(640px 이하)은 맨 윗줄을 비워요
const css = (PAD) => `
.qbox { position: fixed; z-index: 61; top: calc(env(safe-area-inset-top, 0px) + 9px); right: calc(env(safe-area-inset-right, 0px) + 56px);
  width: ${W}; height: 38px; box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 0 10px 0 13px; margin: 0;
  border-radius: 999px; background: #fff; border: 1.5px solid #d3dade; box-shadow: 0 6px 18px -8px rgba(0, 0, 0, .35);
  font: 14px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1f2a24; cursor: text; max-width: none; flex: none; }
.qbox:focus-within { border-color: #2f6f5e; box-shadow: 0 0 0 3px rgba(47, 111, 94, .18), 0 6px 18px -8px rgba(0, 0, 0, .35); }
.qbox svg { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; opacity: .55; }
.qbox input { all: unset; flex: 1; min-width: 0; font: inherit; color: inherit; }
.qbox input::placeholder { color: #7b8682; }
.qbox kbd { flex: none; font: 11px ui-monospace, Consolas, monospace; color: #66706c; border: 1px solid #cfd6da; border-radius: 5px; padding: 0 6px; line-height: 18px; }
.qbox:focus-within kbd { display: none; }
.qbox .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
body.guest .qbox { display: none; }
${PAD ? `@media (min-width: 641px) { body:not(.guest) ${PAD} { padding-right: calc(${W} + 68px + env(safe-area-inset-right, 0px)) !important; } }
@media (max-width: 640px) { body:not(.guest) ${PAD} { padding-top: calc(env(safe-area-inset-top, 0px) + 56px) !important; } }` : ''}
@media (max-width: 640px) { .qbox kbd { display: none; } .qbox { width: calc(100vw - 80px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)); } }
@media print { .qbox { display: none; } }`;
const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.6-4.6"/></svg>';

function mount() {
  // 연구소 방 화면: 머리줄에 이미 있는 찾기 칸을 그대로 옮겨 써요 (app.js 가 #search 글자를 보고 결과를 그려요)
  let input = document.getElementById('search');
  let box = input && input.closest('label');
  const local = !!input;
  if (!document.getElementById('qboxCss')) { const s = document.createElement('style'); s.id = 'qboxCss'; s.textContent = css(ds.pad || (local ? '.top' : '')); document.head.append(s); }
  if (!box) {
    box = document.createElement('label');
    box.innerHTML = '<span class="sr">자료 찾기</span><input id="search" type="search" placeholder="자료 찾기 (제목, 장소, 교과…)" autocomplete="off" enterkeyhint="search">';
    document.body.append(box);
    input = box.querySelector('input');
  }
  box.classList.add('qbox');
  if (!box.querySelector('svg')) box.insertAdjacentHTML('afterbegin', ICON);
  if (!box.querySelector('kbd')) box.insertAdjacentHTML('beforeend', '<kbd title="어디서든 / 를 누르면 여기에 써요">/</kbd>');
  input.setAttribute('enterkeyhint', 'search');
  // 머리줄 단추들은 찾기 칸이 빠진 자리를 메워 오른쪽으로 (연구소 방 화면)
  if (local) { const next = box.nextElementSibling; if (next) next.style.marginLeft = next.style.marginLeft || 'auto'; }

  // 마을 · 레이더: Enter 로 연구소 '찾기' 결과로
  if (!local) {
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      const q = input.value.trim(); if (!q) return;
      location.href = `${BASE}?q=${encodeURIComponent(q)}#lobby`;
    });
  } else {
    // 다른 화면에서 넘어온 키워드(?q=)를 찾기 칸에 넣고 결과를 보여 줘요. 주소의 ?q= 는 지워서 새로고침해도 다시 찾지 않게
    const q = new URLSearchParams(location.search).get('q');
    if (q) {
      const put = () => { input.value = q; input.dispatchEvent(new Event('input', { bubbles: true })); };
      setTimeout(put, 400); setTimeout(put, 1500);   // app.js 가 준비되기 전에 넣으면 그려지지 않아서 두 번
      history.replaceState(null, '', location.pathname + location.hash);
    }
  }
  // 어디서든 / 를 누르면 찾기 칸으로, Esc 는 지우기
  document.addEventListener('keydown', (e) => {
    const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !document.body.classList.contains('guest')) { e.preventDefault(); input.focus(); input.select(); }
    else if (e.key === 'Escape' && t === input) { if (input.value) { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); } else input.blur(); }
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
