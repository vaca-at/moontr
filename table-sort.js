/* 관리자 표 정렬
   <table data-sortable> 표의 제목 칸을 누르면 그 칸 기준으로 줄을 정렬합니다.
   - 한 번 누르면: 숫자·날짜·시간은 큰 순(최근 순), 글자는 가나다순
   - 두 번 누르면: 반대 순서
   - 세 번 누르면: 원래 순서
   표가 새로 그려져도(새로고침, 실시간 갱신) 마지막으로 고른 정렬을 다시 적용합니다.
   쓰는 법: 웹앱 </body> 위에 <script src="/table-sort.js" defer></script> 한 줄, 정렬할 표에 data-sortable 을 붙입니다. */
(() => {
  if (window.__tableSort) return;
  window.__tableSort = true;

  const style = document.createElement('style');
  style.textContent = `
    table[data-sortable] th.ts{cursor:pointer;user-select:none}
    table[data-sortable] th.ts::after{content:'↕';margin-left:4px;font-size:.8em;opacity:.3}
    table[data-sortable] th.ts:hover::after{opacity:.7}
    table[data-sortable] th.ts[data-ts-dir="asc"]::after{content:'▲';opacity:.9}
    table[data-sortable] th.ts[data-ts-dir="desc"]::after{content:'▼';opacity:.9}`;
  document.head.appendChild(style);

  const STATE = {}; // 제목 줄 글자 → { col, dir }  (dir: 1 = 작은 것부터, -1 = 큰 것부터)
  const heads = t => (t.tHead && t.tHead.rows.length) ? [...t.tHead.rows[t.tHead.rows.length - 1].cells] : [];
  const sig = t => heads(t).map(c => c.textContent.trim()).join('|');

  /* 칸 글자 → 비교할 값. 빈칸은 null (항상 맨 뒤) */
  function key(cell){
    if (!cell) return null;
    const raw = (cell.dataset.sortValue ?? cell.textContent).replace(/\s+/g, ' ').trim();
    if (/^[-—–]?$/.test(raw)) return null;
    // 1시간 5분 · 3분 20초 · 45초 · 3분 전
    const d = raw.match(/^(?:(\d+)\s*시간)?\s*(?:(\d+)\s*분)?\s*(?:(\d+)\s*초)?(\s*전)?$/);
    if (d && (d[1] || d[2] || d[3])){
      const s = (+d[1] || 0) * 3600 + (+d[2] || 0) * 60 + (+d[3] || 0);
      return { n: d[4] ? -s : s };               // "3분 전"은 최근일수록 큰 값
    }
    // 12 · 1,234 · 45.5% · 3회 · 28명
    const m = raw.match(/^([-+]?[\d,]*\.?\d+)\s*(%|회|명|개|대|점|번|건|초|분|일)?$/);
    if (m) return { n: parseFloat(m[1].replace(/,/g, '')) };
    return { s: raw, date: /\d{1,4}[-/.]\d{1,2}|\d{1,2}:\d{2}/.test(raw) };
  }
  function cmp(a, b){
    if ('n' in a && 'n' in b) return a.n - b.n;
    if ('n' in a) return -1;
    if ('n' in b) return 1;
    return a.s.localeCompare(b.s, 'ko', { numeric: true });
  }

  /* 처음 누를 때 방향: 숫자·날짜 칸은 큰 순, 글자 칸은 가나다순 */
  function firstDir(t, col){
    const ks = [...t.tBodies].flatMap(b => [...b.rows]).map(r => key(r.cells[col])).filter(Boolean);
    const big = ks.filter(k => 'n' in k || k.date).length;
    return ks.length && big >= ks.length / 2 ? -1 : 1;
  }

  function apply(t){
    const st = STATE[sig(t)];
    heads(t).forEach((h, i) => {
      if (!h.classList.contains('ts')) return;
      const on = st && st.col === i;
      if (on) h.dataset.tsDir = st.dir > 0 ? 'asc' : 'desc'; else delete h.dataset.tsDir;
      h.setAttribute('aria-sort', on ? (st.dir > 0 ? 'ascending' : 'descending') : 'none');
    });
    for (const tb of t.tBodies){
      const rows = [...tb.rows];
      rows.forEach((r, i) => { if (r.dataset.tsI === undefined) r.dataset.tsI = i; });
      const idx = r => +r.dataset.tsI;
      const want = rows.slice().sort((x, y) => {
        if (!st) return idx(x) - idx(y);
        const a = key(x.cells[st.col]), b = key(y.cells[st.col]);
        if (!a || !b) return (!a) - (!b) || idx(x) - idx(y);
        return cmp(a, b) * st.dir || idx(x) - idx(y);
      });
      if (want.some((r, i) => r !== rows[i])) want.forEach(r => tb.appendChild(r));
    }
  }

  function setup(t){
    if (t.__ts) return;
    t.__ts = true;
    heads(t).forEach(h => {
      if (!h.textContent.trim()) return;           // 빈 제목 칸(체크 칸, 버튼 칸)은 정렬하지 않음
      h.classList.add('ts');
      h.tabIndex = 0;
      h.title = '눌러서 정렬';
    });
    const go = e => {
      const h = e.target.closest('th.ts');
      if (!h || !t.tHead || !t.tHead.contains(h)) return;
      const col = heads(t).indexOf(h), s = sig(t), st = STATE[s];
      const first = firstDir(t, col);
      if (!st || st.col !== col) STATE[s] = { col, dir: first };
      else if (st.dir === first) STATE[s] = { col, dir: -first };
      else delete STATE[s];                        // 세 번째: 원래 순서
      apply(t);
    };
    t.addEventListener('click', go);
    t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ if (e.target.closest('th.ts')){ e.preventDefault(); go(e); } } });
  }

  let queued = false;
  function scan(){
    queued = false;
    document.querySelectorAll('table[data-sortable]').forEach(t => {
      setup(t);
      if (STATE[sig(t)]) apply(t);
    });
  }
  const later = () => { if (!queued){ queued = true; requestAnimationFrame(scan); } };
  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  later();
})();
