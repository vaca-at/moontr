# 문쌤의 AI 연구소 (moontr.site/ailab)

연수 공문 · 연수 홈페이지 · 수업 공개 공문 · 다른 선생님 지도안 캡쳐를 넣으면, AI(Claude)가 읽고 층마다 방에 카드로 정리해 주는 웹앱.
첫 화면은 three.js 복셀 3D 건물이고, 방을 누르면 엘리베이터를 타고 그 층으로 가요.

> 다른 컴퓨터(맥미니 등)에서 Claude Code로 이어 작업할 때 이 파일부터 읽혀 주세요.
> "ailab/README.md 읽고 문쌤의 AI 연구소 이어서 하자" 라고 하면 돼요.

## 파일

| 파일 | 하는 일 |
| --- | --- |
| `index.html` | 머리줄(로그인 · 사진 넣기 · 현황), 3D 건물 자리(`#b3d`), 링크 미리보기 · 아이콘 태그 |
| `app.js` | 앱 전체: Firebase 로그인 · 자료 구독, 화면 그리기(첫 화면 · 층 화면 · 접수처 · 현황), 엘리베이터 움직임 |
| `building3d.js` | three.js 3D 건물. 건물 시안 12개(1~7 상자 건물 · 8~12 다른 겉모양), 직원, 사장실(나 · 친구), 타교과실 도서관, 캐릭터 느낌. 첫 화면(home)과 층 화면 위쪽 창(band) 두 모드 |
| `forms3d.js` | 건물 시안 8~12번 겉모양 모형 + 모양마다 층 이름(`FORM_AREAS`) |
| `rooms.js` | **층과 방 설계도 + 화면 이름(APP_NAME)**. 방을 고치면 함수도 다시 배포 |
| `style.css` | 모든 모양. 3D 건물은 `#b3d` 아래, 현황은 `.ad-*` |
| `firebase-config.js` | Firebase 프로젝트 moon-d528d 설정 |
| `policy/index.html` | 이용약관 · 개인정보 처리방침 |
| `og.png` · `favicon.svg` · `apple-touch-icon.png` | 링크 미리보기(OG 2: 설명 + 숲속 건물) · 아이콘(작은 건물) |
| `village/index.html` · `village/village.js` | **AI 연구소 마을** (2026-10-31): 방 하나 = 단층 건물 한 채인 걸어 다니는 3D 마을. 테마 3가지(안다즈 파타야 · 몰디브 · 교토, `?theme=` 로도 고름), 직원은 블록 캐릭터 NPC(접수처에서 서류를 받아 자기 건물로), 사장님은 물가에서 연날리기 · 자전거. 건물을 누르면 연구소의 그 방(`../#방이름`)으로. 방 이름은 `rooms.js` 를 그대로 씀 |
| `3d/index.html` | 예전 시안 주소 → `/ailab/` 로 넘겨요 |
| `../firebase/` | 사진 읽는 Cloud Functions (`README.md`에 배포 방법) |
| `../firestore.rules` · `../storage.rules` | 보안 규칙 (AI Lab 부분: `ailab_cards` · `ailab_captures` · `ailab_meta`, Storage `ailab/captures/`) |

## Firebase (moon-d528d)

- 컬렉션: `ailab_cards`(카드) · `ailab_captures`(넣은 사진 기록) · `ailab_meta/task`(과제 진행판) · `ailab_meta/building`(직원 배치 · 사장실 · 건물 시안). 모두 관리자(isTeacher)만.
- Storage: US-EAST1 버킷, `ailab/captures/{id}.jpg`
- 그 밖의 `ailab_meta`: `me`(명단에서 찾을 내 이름) · `briefing`(점검원) · `usage`(AI 쓴 값) · `desk`(계기판) · `registry`(문서대장)
- 함수: `readCapture`(us-east1, 사진이 올라오면 자동) · `readBundle`(asia-northeast3, 공문 PDF 묶음) · `rereadCapture`(asia-northeast3, [다시 읽기]) · `morningBrief`(매일 6:30) · `briefNow`. 모델 claude-opus-5-5, API 키는 Secret Manager `ANTHROPIC_API_KEY` (이미 등록됨)
- 방문 수: `/visit.js?app=ailab&hide=1` → `site_counts`, `site_devices`

## 지금까지 (2026-10-28)

- [x] 규칙 파일 (콘솔 게시는 직접) · Storage 켜기 · 함수 배포
- [x] 첫 화면 3D 건물, 층 화면 = 엘리베이터 창(그 층만 그리기, 문 닫힘 → 층 표시 → 문 열림)
- [x] 직원 10명 배치(층 · 방별), 사장실 나(여자/남자) · 친구 10명, 건물 시안 5개, 마우스 올리면 설명 창
- [x] 이름 '문쌤의 AI 연구소', 원장실 → 사장실, OG · 아이콘, 관리자 현황(#admin), 약관

## 2026-10-29 (학교)

- [x] **안 움직이던 문제**: 학교 PC는 Windows '애니메이션 효과'가 꺼져 있어 브라우저가 '움직임 줄이기'를 알려 오고, 예전 코드는 그때 캐릭터 · 둘러보기 · 엘리베이터를 모두 멈췄어요. 이제 설정과 상관없이 움직여요
- [x] **낮고 넓은 건물**: 한 층에 방 4개, 3층(2F · 1F · B1). 건물 너비 = 방 4칸 × 10, 높이는 `rooms.js` 의 층 수를 따라가요
  - 2F 연수 층: 사장실 · 연수 기록실 · 링크 서재 · 과제 작업실
  - 1F 수업 층: 접수처 · 도덕교과실 · 타교과실 · 지도안 연구실
  - B1 보관 층: 원본 보관실 · 창고 1 · 창고 2 · 창고 3
- [x] **창고**: 남는 칸(`store1~3`, `store: true`). 새 방이 필요하면 `rooms.js` 에서 창고 key를 새 방으로 바꾸면 3D에도 기본 책상 · 직원으로 그려져요
- 층 화면 창이 좁으면(휴대폰) 고른 방을 가운데 두고 가까이 보여 줘요
- [x] **공문 PDF 묶음**: 업무관리시스템에서 '배포(PDF 형식)'으로 저장한 본문 + 첨부 PDF를 한꺼번에 넣으면 공문 하나로 읽어요
  - 사진만 넣으면 예전처럼 한 장씩(`readCapture`), PDF가 하나라도 있으면 같이 넣은 파일 전부가 한 묶음
  - 묶음은 Storage `ailab/bundles/{번호}/1.pdf, 2.pdf …` 에 올리고, 다 올린 뒤 앱이 `readBundle`(asia-northeast3)을 불러요
  - 합쳐서 20MB까지. 비용은 10쪽 묶음에 약 200~250원
  - **배포 필요**: `firebase deploy --only functions:ailab` (readBundle 새로 생김) + Storage 규칙 게시(`ailab/bundles` 허용)

## 2026-10-29 (집 · 저녁) — 모두 배포 · 푸시 끝

지금 층 구성 (`rooms.js`): PH 사장실 · 2F 연수 기록실 · 링크 서재 · 과제 작업실 · AI 교육 연구실 · 1F 접수처 · 도덕교과실 · 타교과실 · 지도안 연구실 · B1 원본 보관실 · 정보 보안실 · 창고 2 · 3

**자료 넣기 (app.js, PC 안에서)**
- [x] 폴더째 끌어다 놓기 (`dropFiles`, 하위 폴더까지)
- [x] 파일 이름의 **공문번호**로 나눠 묶기 (`docNo`: `…[진선여자고등학교-10941 (본문)]` · `(진선여자고등학교-10941 (첨부) …)` 두 모양). 공문마다 확인 창이 '2 / 5 · 공문 10941번'처럼 차례로 떠요
- [x] 중복: 파일 이름이 달라도 공문번호 + 본문/첨부가 같으면 '전에 넣은 파일'
- [x] **한글 .hwp** 읽기 (`analyzeHwp`): SheetJS 의 CFB 로 열고 `BodyText/Section*` 압축 풀어 문단(67) · 표(77) · 칸(72)을 다시 세워 표는 행마다 '칸 | 칸'. 배포용 · 비밀번호 한글은 안내만
- [x] 접수처 진행 막대: 올리기는 실제 바이트(`uploadBytesResumable`), AI 읽기는 보통 걸리는 시간(사진 75초 · 묶음 150초)으로 어림
- [x] AI교육 브리핑처럼 '○월호' 공문은 한 장으로 묶고 지난 호는 펼쳐 보기 (`seriesFold`)

**AI 서버 (firebase/functions/index.js, 배포함)**
- [x] 대상자 공문: `ailab_meta/me` 의 선생님 이름이 명단에 있을 때만 '나 (명단에 있음)'. 지금 있는 대상자 카드 9장은 선생님이 확인해 줘서 모두 '나'로 고쳐 둠 (AIEDAP · 해커톤 · 에듀테크 페어 · AI윤리 · 선도교사)
- [x] **점검원 아침 브리핑** `morningBrief`(매일 6:30 서울) · `briefNow`(사장실 [지금 브리핑 받기]) → `ailab_meta/briefing`
- [x] AI 쓴 값 어림: 부를 때마다 `ailab_meta/usage` 에 날짜별 달러 (Opus 5.5 토큰 값)
- [x] 캡쳐가 **문서등록대장** 화면이면 줄마다 `ailab_meta/registry.rows[문서번호]` 로, **콘솔 결제 화면**이면 남은 크레딧을 `ailab_meta/desk` 로 (카드는 안 만들어요)

**사장실 탭 (app.js `bossRoom`)**
- [사장실] 맨 위 **사장님 계기판**(`deskCard`): 남은 크레딧 · 만료 D-day · 연구소 AI 쓴 값 · 급한 일(3일 안) · 할 일 · 메모 (`ailab_meta/desk`) → 점검원 브리핑 → 일정
- [웹앱 현황]: moontr.site 모든 웹앱 `site_counts` 방문 잔디 + 규칙으로 쓴 이용 브리핑 (`WEBAPPS` 목록은 관리자 허브와 같게)
- [연수 대장]: 연수 기록실 카드를 연수별 한 줄로 (문서등록대장처럼)
- [문서대장]: 문서대장 캡쳐 표 · 키워드 버튼 · [안 받은 것만] · 넣은 공문은 ✓

**3D (building3d.js · forms3d.js)**
- [x] 타교과실 = 수업 공개 도서관 (교과별 책장 6개, 책 누르면 사서가 열람대로)
- [x] 게임 메뉴 ✦: 캐릭터 느낌 각진 복셀 ↔ 반질 비닐 (`STATE.look`, 미리 보기 `?look=1|3`)
- [x] 건물 시안 8~12번 (`forms3d.js`): 둥근 지붕 도서관 · 사장님 저택 · 섬 리조트 · 작은 마을 · 나무 위 연구소. 건물 전체 보기에서만 겉모양, 층 이름은 모양마다(`FORM_AREAS`: 동쪽 날개 · 윗마을 …), 같은 층 방은 한 구역에
- [x] 매뉴얼(?)에 '연구소는 이렇게 일해요' 설계도, 접수처 단추를 엘리베이터 판 색으로

**콘솔 크레딧 (10/29 기준)**: 프로모션 $95.63 / $100 (API 포함, **11/18 만료**) + 구매 $4.84. 남은 크레딧은 API 로 못 받아서 결제 화면 캡쳐로 맞춰요. 실제 사용액을 바로 받으려면 Admin API 키(조직 필요)가 있어야 해요.

## 다음에 할 일 (10/30~)

선생님이 할 것
1. **문서대장 캡쳐** 넣기 (키워드 · 보낸 부서로 검색한 화면) → 사장실 [문서대장] 표 확인. 처음이라 표가 이상하면 SYSTEM 안내의 '특별한 화면' 부분을 다듬기
2. **연수 목록 캡쳐** 넣기 → 연수 대장 뼈대로 잇기 (아직 안 만듦)
3. **즐겨찾기** 정리 (10/30 작업 예정 — 링크 서재)
4. 처음 써 보는 것 확인: 폴더째 넣기 · 한글 파일 · 진행 막대 · 계기판 할 일/메모 (로그인 화면이라 아직 직접 못 봄)
5. 가능하면 연구소 전용 API 키 + Workspace 한도 (지금은 타이쿤 · 아이아이노트와 같은 키)

Claude 가 할 것
- 화면만 (푸시만): 8~12번 건물의 **방 안 껍데기**(초가 천장 · 통나무 벽 …), 겉모양에서 **뒤쪽 방 이름표가 앞에 겹치는 것**, 문서등록대장 **엑셀** 넣으면 AI 없이 표로, 방마다 방문 수
- AI (배포 필요): 연수 목록 캡쳐 → 연수 대장 잇기, 날짜 없는 수업 공개 카드 19장 다시 읽기 · 겹친 카드 합치기, 수업 아이디어 묶기 (윤리 수업용)
- 나중에: 다른 선생님께 나눠 주기 (선생님마다 자료 따로 — 타이쿤 → 데스크처럼)

시험할 때 쓰던 것 (Claude 작업용, 저장소 밖 스크래치): 로그인 없이 3D 만 띄우는 `libtest.html`(index.html 에서 app.js 대신 building3d.js), 헤드리스 Edge 화면 찍기, Firebase CLI 토큰으로 Firestore REST 읽기(읽기 전용)

## 일하는 방식 (문쌤 취향)

- 화면 · 디자인을 바꿀 때는 **코드에 넣기 전에 시안(보통 3~5개)을 먼저** 보여 주고 고르게 하기
- 3D는 three.js 로
- 다 되면 `main` 에 바로 커밋 · 푸시 (GitHub Pages 로 바로 반영). 커밋 메시지는 한국어로, 무엇이 바뀌었는지 풀어서
- 화면 글은 쉬운 존댓말 ("~해요")

## 맥미니에서 처음 한 번

```bash
# 1) 도구: Homebrew 없이도 nodejs.org 에서 Node 설치, git 은 처음 실행할 때 설치 안내가 떠요
git clone https://github.com/vaca-at/moontr.git
cd moontr
# 2) 함수까지 손볼 때만
npm install -g firebase-tools
firebase login
cd firebase/functions && npm install
```

- 작업 시작할 때 `git pull`, 끝날 때 커밋 · 푸시.
- 같은 앱 폴더를 두 컴퓨터에서 동시에 고치지 않기 (예: 맥미니는 ailab, 노트북은 tycoon).
