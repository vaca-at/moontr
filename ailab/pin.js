// 📌 급하게 할 일 띄우기 (2026-11-06): 로그인한 관리자에게 모든 화면(방 · 마을 · 레이더) 위쪽 가운데에 떠요.
// 목록은 연구소 방 화면(app.js)이 계산해 ailab_meta/desk.pinned 에 남겨 두고, 마을 · 레이더는 그걸 읽어 그대로 보여 줘요.
// list = [{ k, t, d, room }]  (k = 빼기 열쇠, t = 글, d = 날짜 YYYY-MM-DD, room = 방 이름 key)
// opts = { base: '' | '../', onHide(k) }  — onHide 가 있으면 줄마다 '내 일 아님' 단추
const css = `
#pinBox { position: fixed; z-index: 60; left: 50%; top: calc(var(--hdr, 60px) + 12px); translate: -50% 0; max-width: min(520px, calc(100vw - 24px));
  font: 14px/1.45 system-ui, "Apple SD Gothic Neo", sans-serif; color: #f3f5f6; border-radius: 16px;
  background: rgba(34, 36, 40, .6); border: 1px solid rgba(255, 255, 255, .2); backdrop-filter: blur(14px) saturate(1.1); -webkit-backdrop-filter: blur(14px) saturate(1.1); box-shadow: 0 10px 28px -12px rgba(0, 0, 0, .6); }
#pinBox > button.pin-h { all: unset; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 7px 14px; font-weight: 700; white-space: nowrap; }
#pinBox > button.pin-h:focus-visible { outline: 2px solid #fff; outline-offset: 2px; border-radius: 14px; }
#pinBox .pin-h i { font-style: normal; display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 99px; background: #e0704a; color: #fff; font-size: 12.5px; }
#pinBox .pin-h small { font-weight: 400; opacity: .75; }
#pinBox ul { list-style: none; margin: 0; padding: 0 8px 8px; display: grid; gap: 4px; }
#pinBox li { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; background: rgba(255, 255, 255, .07); }
#pinBox li a { color: inherit; text-decoration: none; flex: 1; min-width: 0; }
#pinBox li a:hover { text-decoration: underline; }
#pinBox li b { font-weight: 700; color: #ffd28a; margin-right: 6px; }
#pinBox li button { all: unset; cursor: pointer; flex: none; font-size: 12px; padding: 3px 8px; border-radius: 8px; background: rgba(255, 255, 255, .1); border: 1px solid rgba(255, 255, 255, .18); }
#pinBox li button:hover { background: rgba(255, 255, 255, .22); }
#pinBox.closed ul { display: none; }
@media (max-width: 640px) { #pinBox { top: calc(var(--hdr, 60px) + 112px); left: 12px; right: 12px; translate: none; max-width: none; font-size: 13px; } }
@media print { #pinBox { display: none; } }`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY = 'ailab-pin-closed';
function dd(d) {
  if (!d) return '';
  const t = new Date(); t.setHours(0, 0, 0, 0); const n = Math.round((new Date(`${d}T00:00:00`) - t) / 864e5);
  return n <= 0 ? '오늘' : n === 1 ? '내일' : `D-${n}`;
}
export function renderPin(list, opts = {}) {
  let box = document.getElementById('pinBox');
  if (!list || !list.length) { box?.remove(); return; }
  if (!document.getElementById('pinCss')) { const s = document.createElement('style'); s.id = 'pinCss'; s.textContent = css; document.head.append(s); }
  if (!box) { box = document.createElement('section'); box.id = 'pinBox'; box.setAttribute('aria-label', '급하게 할 일'); document.body.append(box); }
  let closed = false; try { closed = localStorage.getItem(KEY) === '1'; } catch {}
  box.classList.toggle('closed', closed);
  box.innerHTML = `<button type="button" class="pin-h" aria-expanded="${!closed}">📌 급하게 할 일 <i>${list.length}</i><small>${closed ? '펼치기' : '접기'}</small></button>
    <ul>${list.map((x) => `<li>${x.room ? `<a href="${esc(opts.base || '')}#${esc(x.room)}">` : '<span style="flex:1">'}${x.d ? `<b>${dd(x.d)}</b>` : ''}${esc(x.t)}${x.room ? '</a>' : '</span>'}${opts.onHide ? `<button type="button" data-k="${esc(x.k)}" title="내가 할 일이 아니면 빼요">내 일 아님</button>` : ''}</li>`).join('')}</ul>`;
  box.querySelector('.pin-h').onclick = () => { try { localStorage.setItem(KEY, closed ? '0' : '1'); } catch {} renderPin(list, opts); };
  if (opts.onHide) box.querySelectorAll('li button').forEach((b) => (b.onclick = () => opts.onHide(b.dataset.k)));
}
