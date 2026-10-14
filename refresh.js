/* ============================================================
   moontr 새로고침 단추 (모든 웹앱이 같이 씁니다, 2026-10-07)
   쓰는 법: </body> 바로 위에 한 줄
     <script src="/refresh.js" defer></script>
     - 색을 웹앱에 맞추려면: <script src="/refresh.js" data-bg="#1F3A6B" data-fg="#fff" defer></script>
     - 왼쪽 위에 두려면 data-side="left"
   - 오른쪽 위에 동그란 🔄 단추. 누르면 화면을 새로 불러와요 (아이폰 '홈 화면에 추가'처럼 주소창이 없을 때 특히 필요)
   - 그냥 새로고침이 아니라 '강력 새로고침'이에요. 저장해 둔 옛 파일을 버리고 새로 받아옵니다.
     (전자칠판·태블릿처럼 Ctrl+Shift+R 을 못 누르는 기기를 위해, 2026-10-14)
   - 그 자리에 웹앱의 단추 · 링크가 있으면 가리지 않게 빈자리까지 조금씩 내려가요
   - 관리자 허브(/admin) 창 안에서 열리면 안 보여요 (허브에 새로고침이 따로 있어요)
   ============================================================ */
(function () {
  var me = document.currentScript || {}, ds = me.dataset || {};
  var inHub = false; try { inHub = window.top !== window; } catch (e) { inHub = true; }
  if (inHub || document.getElementById('moontr-refresh')) return;
  var left = ds.side === 'left';
  var b = document.createElement('button');
  b.id = 'moontr-refresh'; b.type = 'button'; b.title = '강력 새로고침 (저장해 둔 옛 파일을 버리고 새로 받아와요)'; b.setAttribute('aria-label', '강력 새로고침');
  b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg>';
  b.style.cssText = 'position:fixed;z-index:2147483000;top:calc(env(safe-area-inset-top,0px) + 8px);' + (left ? 'left' : 'right') + ':calc(env(safe-area-inset-' + (left ? 'left' : 'right') + ',0px) + 8px);'
    + 'width:40px;height:40px;padding:0;border:0;border-radius:50%;display:flex;align-items:center;justify-content:center;'
    + 'background:' + (ds.bg || 'rgba(255,255,255,.9)') + ';color:' + (ds.fg || '#333') + ';box-shadow:0 2px 10px rgba(0,0,0,.2);'
    + '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);cursor:pointer;transition:transform .5s,opacity .2s;opacity:.88';
  b.addEventListener('mouseenter', function () { b.style.opacity = '1'; });
  b.addEventListener('mouseleave', function () { b.style.opacity = '.88'; });
  // 강력 새로고침: 저장해 둔 옛 파일을 버리고 새로 받아온다.
  // Ctrl+Shift+R 을 못 누르는 기기(전자칠판·태블릿·홈 화면 앱)를 위한 것.
  // 주소는 그대로 둔다 (?page=monitor 처럼 주소에 뜻이 담긴 앱이 있어서).
  function hardReload() {
    var went = false;
    function go() { if (went) return; went = true; location.reload(); }
    var t = setTimeout(go, 2500);   // 느려도 2.5초 뒤에는 그냥 새로 연다
    function done() { clearTimeout(t); go(); }
    try {
      if (window.caches && caches.keys) {
        caches.keys().then(function (ks) {
          return Promise.all(ks.map(function (k) { return caches.delete(k); }));
        })['catch'](function () {});
      }
    } catch (e) {}
    try {
      // 이 한 줄이 핵심: 저장해 둔 것을 쓰지 말고 서버에서 새로 받아오라는 뜻
      fetch(location.href, { cache: 'reload' }).then(done)['catch'](done);
    } catch (e) { done(); }
  }
  b.addEventListener('click', function () { b.style.transform = 'rotate(360deg)'; setTimeout(hardReload, 180); });
  function add() {
    document.body.appendChild(b);
    // 그 자리에 다른 단추 · 링크가 있으면 빈자리까지 내려가요
    function place() {
      for (var y = 8; y <= 260; y += 6) {
        b.style.top = 'calc(env(safe-area-inset-top,0px) + ' + y + 'px)'; b.style.visibility = 'hidden';
        var r = b.getBoundingClientRect(), hit = false;
        [[r.left + 3, r.top + 3], [r.right - 3, r.top + 3], [r.left + 3, r.bottom - 3], [r.right - 3, r.bottom - 3], [r.left + r.width / 2, r.top + r.height / 2]].forEach(function (p) {
          var el = document.elementFromPoint(p[0], p[1]);
          if (el && el !== b && el.closest && el.closest('button,a,input,select,textarea,label,summary,[data-act],[role=button],[onclick]')) hit = true;
        });
        b.style.visibility = '';
        if (!hit) return;
      }
      b.style.top = 'calc(env(safe-area-inset-top,0px) + 8px)';
    }
    setTimeout(place, 300); setTimeout(place, 1500);
    window.addEventListener('resize', function () { clearTimeout(place.t); place.t = setTimeout(place, 200); });
  }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();
