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
| `building3d.js` | three.js 3D 건물. 건물 시안 5개, 직원 10명, 사장실(나 5 · 친구 10). 첫 화면(home)과 층 화면 위쪽 창(band) 두 모드 |
| `rooms.js` | **층과 방 설계도 + 화면 이름(APP_NAME)**. 방을 고치면 함수도 다시 배포 |
| `style.css` | 모든 모양. 3D 건물은 `#b3d` 아래, 현황은 `.ad-*` |
| `firebase-config.js` | Firebase 프로젝트 moon-d528d 설정 |
| `policy/index.html` | 이용약관 · 개인정보 처리방침 |
| `og.png` · `favicon.svg` · `apple-touch-icon.png` | 링크 미리보기(OG 2: 설명 + 숲속 건물) · 아이콘(작은 건물) |
| `3d/index.html` | 예전 시안 주소 → `/ailab/` 로 넘겨요 |
| `../firebase/` | 사진 읽는 Cloud Functions (`README.md`에 배포 방법) |
| `../firestore.rules` · `../storage.rules` | 보안 규칙 (AI Lab 부분: `ailab_cards` · `ailab_captures` · `ailab_meta`, Storage `ailab/captures/`) |

## Firebase (moon-d528d)

- 컬렉션: `ailab_cards`(카드) · `ailab_captures`(넣은 사진 기록) · `ailab_meta/task`(과제 진행판) · `ailab_meta/building`(직원 배치 · 사장실 · 건물 시안). 모두 관리자(isTeacher)만.
- Storage: US-EAST1 버킷, `ailab/captures/{id}.jpg`
- 함수: `readCapture`(us-east1, 사진이 올라오면 자동) · `readBundle`(asia-northeast3, 공문 PDF 묶음) · `rereadCapture`(asia-northeast3, [다시 읽기]). 모델 claude-opus-5-5, API 키는 Secret Manager `ANTHROPIC_API_KEY` (이미 등록됨)
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
  - 1F 수업 층: 접수처 · 도덕실 · 타교과실 · 지도안 연구실
  - B1 보관 층: 원본 보관실 · 창고 1 · 창고 2 · 창고 3
- [x] **창고**: 남는 칸(`store1~3`, `store: true`). 새 방이 필요하면 `rooms.js` 에서 창고 key를 새 방으로 바꾸면 3D에도 기본 책상 · 직원으로 그려져요
- 층 화면 창이 좁으면(휴대폰) 고른 방을 가운데 두고 가까이 보여 줘요
- [x] **공문 PDF 묶음**: 업무관리시스템에서 '배포(PDF 형식)'으로 저장한 본문 + 첨부 PDF를 한꺼번에 넣으면 공문 하나로 읽어요
  - 사진만 넣으면 예전처럼 한 장씩(`readCapture`), PDF가 하나라도 있으면 같이 넣은 파일 전부가 한 묶음
  - 묶음은 Storage `ailab/bundles/{번호}/1.pdf, 2.pdf …` 에 올리고, 다 올린 뒤 앱이 `readBundle`(asia-northeast3)을 불러요
  - 합쳐서 20MB까지. 비용은 10쪽 묶음에 약 200~250원
  - **배포 필요**: `firebase deploy --only functions:ailab` (readBundle 새로 생김) + Storage 규칙 게시(`ailab/bundles` 허용)

## 다음에 할 일

1. **실제 사진으로 끝까지 시험**: 로그인 → 연수 공문 캡쳐 넣기 → 접수처에 '확인 전' 카드가 생기는지. 아직 한 번도 끝까지 돌려 보지 않았어요. 안 되면 화면의 오류 문구 + `firebase functions:log` 확인
2. 콘솔에 Firestore · Storage 규칙이 게시됐는지 확인 (안 됐으면 사진 올리기가 막혀요)
3. 결과를 보고 사진 읽는 방식 다듬기 (`../firebase/functions/index.js` 의 SYSTEM 안내 → 다시 배포)
4. 로그인한 상태의 현황 화면 점검

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
