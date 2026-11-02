# 관리자 허브(/admin) 이어서 할 일

> ✅ **2026-11-03 모두 끝냈어요** (1. 숫자 나오게 · 2. 홈 화면 꾸미기). 아래는 그때 남긴 계획 기록이에요.
> - 큰법당 · 캠핑장 · 소호랩 숫자는 `/public/visits` 로 읽어요 (로그인 없이). 소호랩은 `STATS` 와 관리자 주소 `admin.html` 에 넣었어요.
> - 홈: 요약 숫자(어제 · 지난 7일 대비) · 🔎 주목할 점 · 📈 60일 그래프 · 요일별 · 웹앱별 비중 · 시간대별 · 🏯 메타버스 3곳 카드 · 🏫 타이쿤 카드 · 웹앱 카드 30일 그래프
> - '전체' 숫자에서 출석체크는 빼고, `SITE_NAMES` 와 `STATS` 에 같은 이름(예: 110)은 한 번만 세요.

2026-11-03에 하다가 멈춘 작업이에요. 다른 컴퓨터에서 이어서 할 때 이 파일부터 읽어 주세요.

## 지금까지 한 것 (모두 GitHub에 반영됨)

- **큰법당 · 캠핑장 · 소호랩 중계 서버에 `/public/visits`를 더하고 배포했어요.**
  - 저장소와 커밋: `vaca-at/templestay` 1db63f0, `vaca-at/campingjang` 7ff080c, `vaca-at/soho-lab` 0aaa871
  - 로그인 없이 방문 '숫자'만 내줘요: 날짜별 방문(최근 90일) · 시간대별 방문(최근 30일) · 입장 · 머문 시간 · 동시접속 최고 · 지금 인원.
  - 누가 왔는지, 연등 글, 신고는 들어 있지 않아요.
  - 소호랩 서버는 moontr.site 요청을 막고 있었어요. 이번에 허락 목록(ORIGINS)에 moontr.site를 넣었어요.
  - 확인한 숫자 (11/3 기준 누적): 큰법당 606 · 캠핑장 310 · 소호랩 88
- **관리자 허브(`admin/index.html`)는 아직 하나도 안 바꿨어요.**

## 왜 숫자가 안 나왔는지

- **큰법당 · 캠핑장:** 허브는 지금 `/admin/google`(구글 로그인 증표 → 입장권) → `/admin/stats` 순서로 숫자를 받아요. 이 로그인 단계 어딘가에서 막혀요.
  - 서버는 `bellachord@gmail.com`만 허락해요. 허브에 다른 계정(예: 예전 센메일)으로 로그인돼 있으면 거절당했을 수 있어요.
  - 정확한 원인은 확인하지 못했어요. 새 `/public/visits` 길은 로그인이 필요 없어서 이 문제를 피해 가요.
- **소호랩:**
  - 허브 `STATS`에 소호랩이 아예 없었어요.
  - `ADMIN_GROUPS`의 관리자 주소가 사이트 첫 화면(`https://soho-lab.site/`)이었어요. 소호랩에는 이제 관리자 현황판 `admin.html`이 있어요.

## 이어서 할 일

### 1. 숫자부터 나오게 (먼저)

`admin/index.html`에서:

1. `STATS`의 큰법당 · 캠핑장 항목은 그대로 `relay`를 써요. `loadStats()`의 `if (st.relay)` 부분만 바꿔요.
   - 지금: 구글 로그인 → `/admin/google` → `/admin/stats`
   - 바꿀 것: `fetch(st.relay + '/public/visits')` 하나로. 돌아오는 값은 `{ total, today, days, hours, joins, staySec, stayN, peaks, best, wishDays, wishTotal, online, rooms }`
2. 소호랩을 `STATS`에 더해요:
   `'https://soho-lab.site/admin.html': { relay:'https://soho-lab-rooms.bellachord.workers.dev', unit:'방문' }`
3. `ADMIN_GROUPS`의 소호랩 줄을 고쳐요: `admin:'https://soho-lab.site/admin.html'`, `login:'gg'`. 위의 주석 '따로 관리자 화면이 없어서'도 지워요.

### 2. 홈 화면 꾸미기 (그다음)

계획한 모양이에요. 그림은 외부 라이브러리 없이 SVG로 그려요.

- **요약 숫자:** 오늘(어제 대비 ▲▼%) · 최근 7일(지난 7일 대비) · 최근 30일 · 누적 · 오늘 쓰인 웹앱 · 메타버스 지금 접속
  - 오늘 · 누적 · 쓰인 웹앱 칸은 지금처럼 누르면 순위가 열려요 (`data-rank`).
- **🔎 주목할 점** (자동으로 찾아 카드로 보여 줘요)
  - 오늘 가장 많이 찾은 웹앱
  - 어제보다 크게 는 웹앱
  - 최근 7일에 새로 쓰이기 시작한 웹앱
  - 2주 넘게 방문이 없는 웹앱
  - 60일 중 최고 방문일
  - 동시접속 최고 기록
  - 타이쿤 새 가입
- **📈 방문 흐름 그래프**
  - 60일 날짜별 막대 + 7일 평균선 (주말은 연하게)
  - 최근 30일 웹앱별 비중 (막대 + %, 누르면 그 관리자 화면)
  - 요일별 평균 (최근 8주)
  - 시간대별 방문 (메타버스 3곳, 최근 7일. 다른 앱은 시간대 기록이 없어요)
- **🏯 메타버스 3곳 카드:** 큰법당 · 캠핑장 · 소호랩마다
  - 오늘 · 누적 · 지금 접속
  - 동시접속 최고(날짜)
  - 평균 머문 시간 (최근 7일 `staySec ÷ stayN`)
  - 오늘 입장 (`joins`)
  - 14일 미니 그래프
  - 큰법당은 연등 수 (`wishTotal`)
- **🏫 교무실 타이쿤 카드**
  - 가입 선생님 수: `desk_users` 개수 (`getCountFromServer`)
  - 오늘 접속: `lastDay == 오늘`
  - 최근 7일 새 가입: `createdAt >= 7일 전`, `createdAt` 은 숫자
  - 웹(`site_counts` desk)과 앱(deskapp) 방문
  - 기다리는 문의
- **웹앱 카드:** 지금 카드에 30일 미니 그래프와 '지난 7일 대비 ▲▼%'를 더해요.
- **'전체' 숫자에서 뺄 것:** 출석체크(unit '출석')는 방문이 아니라서 빼요. `SITE_NAMES`와 `STATS`(site)에 같은 이름이 있으면(예: 110) 두 번 세지 않게 해요.

멈출 때 고치고 있던 CSS · HTML 틀이에요. 아직 JS는 없어요. `git apply`로 넣고 시작하면 돼요.

```diff
diff --git a/admin/index.html b/admin/index.html
index 82eb735..e44aa37 100644
--- a/admin/index.html
+++ b/admin/index.html
@@ -246,8 +246,61 @@ body.editing .del{display:inline-block}
 .hiddenbox .row span{flex:1;color:var(--muted);text-decoration:line-through}
 .hiddenbox button{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:.15rem .7rem;font-size:.78rem;cursor:pointer}
 
+/* ===== 홈: 한눈에 보는 그래프 · 주목할 점 · 메타버스 · 타이쿤 ===== */
+.sum button .chg{display:inline-block;margin-left:.4rem;font-size:.78rem;font-weight:700;vertical-align:middle;padding:.1rem .45rem;border-radius:999px}
+.chg.up{color:#1E7B4F;background:#E3F4EA}.chg.down{color:#B3261E;background:#FBE4E2}.chg.flat{color:var(--muted);background:#EEF1F6}
+.sum .plain{cursor:default}.sum .plain::after{content:none}
+.sec-h{display:flex;align-items:baseline;gap:.5rem;margin:1.6rem 0 .6rem;font-size:1.05rem}
+.sec-h small{font-weight:400;color:var(--muted);font-size:.8rem}
+.panels{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:.8rem}
+.panel{grid-column:span 6;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:1rem 1.1rem;min-width:0}
+.panel.wide{grid-column:span 8}.panel.narrow{grid-column:span 4}.panel.full{grid-column:1 / -1}.panel.third{grid-column:span 4}
+@media (max-width:1100px){ .panel,.panel.wide,.panel.narrow,.panel.third{grid-column:1 / -1} }
+.panel h3{display:flex;align-items:baseline;gap:.5rem;margin:0 0 .7rem;font-size:.95rem}
+.panel h3 small{font-weight:400;color:var(--muted);font-size:.78rem}
+.panel h3 .lg{margin-left:auto;display:flex;gap:.7rem;font-weight:400;font-size:.75rem;color:var(--muted)}
+.lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:.3rem;vertical-align:-1px}
+.chart{display:block;width:100%;height:auto;overflow:visible}
+.chart text{font-family:inherit;font-size:11px;fill:var(--muted)}
+.chart .grid{stroke:#EEF1F6;stroke-width:1}
+.chart .hit{fill:transparent}
+.chart .hit:hover{fill:rgba(31,58,107,.06)}
+.chart-tip{position:fixed;z-index:50;pointer-events:none;padding:.4rem .6rem;background:#17243B;color:#fff;border-radius:8px;font-size:.8rem;line-height:1.45;box-shadow:0 8px 20px -10px rgba(0,0,0,.5);white-space:nowrap}
+.share-row{display:grid;grid-template-columns:minmax(7rem,12rem) 1fr 4.6rem 3.4rem;align-items:center;gap:.6rem;width:100%;min-height:30px;padding:0 .3rem;border:0;border-radius:7px;background:none;text-align:left;font-size:.85rem;cursor:pointer}
+.share-row:hover{background:var(--accent-soft)}
+.share-row .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
+.share-row .bar{height:10px;border-radius:99px;background:#EBEEF3;overflow:hidden}
+.share-row .bar i{display:block;height:100%;border-radius:99px}
+.share-row .v{text-align:right;font-weight:700}.share-row .p{text-align:right;color:var(--muted);font-size:.78rem}
+.insights{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:.6rem;margin:0}
+.ins{display:flex;gap:.7rem;align-items:flex-start;padding:.8rem .9rem;background:var(--surface);border:1px solid var(--line);border-radius:12px;font-size:.88rem;line-height:1.5}
+.ins .e{flex:none;font-size:1.3rem;line-height:1.2}
+.ins b{display:block;font-size:.78rem;color:var(--muted);font-weight:600;margin-bottom:.1rem}
+.ins button{border:0;background:none;padding:0;color:var(--accent);font-weight:700;cursor:pointer;text-align:left}
+.ins button:hover{text-decoration:underline}
+.mv-card{display:flex;flex-direction:column;gap:.6rem}
+.mv-card .hd{display:flex;align-items:center;gap:.5rem;font-weight:700}
+.mv-card .hd .live{margin-left:auto;display:inline-flex;align-items:center;gap:.35rem;font-size:.78rem;font-weight:700;color:#1E7B4F;background:#E3F4EA;border-radius:999px;padding:.15rem .6rem}
+.mv-card .hd .live.off{color:var(--muted);background:#EEF1F6}
+.mv-card .hd .live::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
+.kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.4rem}
+.kv div{background:#F7F9FC;border-radius:9px;padding:.5rem .6rem}
+.kv small{display:block;font-size:.72rem;color:var(--muted)}
+.kv b{font-size:1.15rem;letter-spacing:-.01em}
+.mv-card .lnk{display:flex;gap:.4rem;flex-wrap:wrap}
+.mv-card .lnk .btn{min-height:32px;font-size:.8rem}
+.spark{display:block;width:100%;height:46px}
+.card .spark{height:40px}
+.card .wk{font-size:.75rem;color:var(--muted);display:flex;gap:.6rem;align-items:center}
+.ty-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.5rem}
+.ty-grid div{background:#F7F9FC;border-radius:10px;padding:.6rem .7rem}
+.ty-grid small{display:block;font-size:.74rem;color:var(--muted)}
+.ty-grid b{font-size:1.4rem;letter-spacing:-.02em}
+.updated{font-size:.78rem;color:var(--muted)}
 @media (max-width:640px){
   .acts .btn span.t{display:none}
+  .share-row{grid-template-columns:minmax(6rem,1fr) 4rem 3rem} .share-row .bar{display:none}
+  .kv{grid-template-columns:repeat(2,minmax(0,1fr))}
   .views{margin-left:0;width:100%;overflow-x:auto}
   .v-list td.host,.v-list th.host,.v-list td.lv,.v-list th.lv{display:none}
   .v-bar .bmenu{min-width:min(340px,calc(100vw - 32px))}
@@ -284,11 +337,18 @@ body.editing .del{display:inline-block}
 
   <section id="home" hidden>
     <div class="home-head">
-      <div><h1>오늘의 현황</h1><p>웹앱마다 오늘 방문 · 누적 방문 · 최근 20주 잔디입니다. 카드를 누르면 그 관리자 화면이 열립니다.</p></div>
+      <div><h1>오늘의 현황</h1><p>moontr.site 와 연결된 웹앱 전체의 방문 흐름입니다. 숫자 칸을 누르면 순위, 카드를 누르면 그 관리자 화면이 열려요. <span class="updated" id="homeUpdated"></span></p></div>
       <button type="button" class="btn" id="homeReload">새로고침</button>
     </div>
     <div class="sum" id="homeSum"></div>
     <div class="rank" id="homeRank" hidden></div>
+    <h2 class="sec-h">🔎 주목할 점 <small>방문 기록에서 저절로 찾아요</small></h2>
+    <div class="insights" id="homeInsights"></div>
+    <h2 class="sec-h">📈 방문 흐름 <small>그래프에 마우스를 올리면 숫자가 보여요</small></h2>
+    <div class="panels" id="homeCharts"></div>
+    <h2 class="sec-h">🏯 메타버스 3곳 · 🏫 교무실 타이쿤 <small>지금 접속 · 동시접속 최고 · 머문 시간 · 가입</small></h2>
+    <div class="panels" id="homeMeta"></div>
+    <h2 class="sec-h">🗂 웹앱별 카드 <small>오늘 방문이 많은 순 · 30일 그래프 · 최근 20주 잔디</small></h2>
     <div class="cards" id="homeCards"></div>
     <div class="nostat" id="homeLinks"></div>
     <div class="nostat" id="homeNo"></div>
```

## 알아 둘 것

- 로컬에 커밋되지 않은 변경이 남아 있었는데, 제 작업이 아니라서 손대지 않았어요 (다른 세션 것):
  - `tycoon/index.html` (휴대폰 세로 화면 작업)
  - `ailab/tooltest.html`
- 중계 서버 세 곳은 `server` 폴더에서 `npx wrangler deploy`로 배포해요.
  - 새로 받은 `campingjang` · `soho-lab` 저장소는 커밋 전에 `git config user.name` / `user.email`을 넣어야 했어요.
- 확인할 주소: https://moontr.site/admin/
  - 세 서버 숫자 직접 보기: https://templestay-rooms.bellachord.workers.dev/public/visits (`campingjang-rooms` · `soho-lab-rooms`도 같은 모양)