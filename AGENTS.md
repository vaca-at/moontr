# moontr.site 작업 규칙

이 저장소를 고치는 에이전트(Claude Code, Antigravity 등)는 아래 규칙을 따릅니다.

## 시작 전
- 작업 전에 반드시 `git pull` 합니다. 여러 도구로 번갈아 고치기 때문에 GitHub에 새 커밋이 있을 수 있습니다.
- 폴더 하나 = 웹앱 하나입니다 (`moontr.site/폴더이름/`). 앱마다 `index.html` 파일 하나로 되어 있습니다.

## 관리자 로그인 (가장 중요)
- 모든 앱의 관리자·교사 화면은 **Firebase 이메일 로그인**으로 들어갑니다.
  - 계정: `anstjsdud@sen.go.kr` (센메일), 비밀번호는 숫자 6자리 — 비밀번호는 코드에 적지 않습니다.
  - 코드에 `ADMIN_EMAIL` 상수를 두고 `signInWithEmailAndPassword(auth, ADMIN_EMAIL, 입력값)`로 로그인합니다.
- `1212`, `1234` 같은 앱별 암호나 해시 암호를 **새로 만들지 않습니다.**
- 같은 주소(moontr.site)의 앱끼리는 로그인이 공유됩니다. 페이지를 열 때 이미 관리자 계정으로 로그인돼 있으면 비밀번호 창 없이 바로 관리자 화면을 엽니다.
- 관리자 화면은 주소로 바로 열 수 있게 합니다: `#admin`(또는 `?admin`)으로 들어오면 관리자 화면(로그인 전이면 비밀번호 창)을 엽니다.

## 관리자 허브 (`/admin`)
- `admin/index.html`은 모든 웹앱의 관리자 화면을 모아 둔 페이지입니다.
- 허브의 [편집 → 삭제]는 코드를 지우지 않고 Firestore `moontr_config/adminHub` 의 `hidden` 목록에 숨깁니다. 코드에서 완전히 빼려면 목록에서 줄을 지웁니다.
- 허브는 위쪽 ① 관리자 화면(`ADMIN_GROUPS`)과 아래쪽 ② 즐겨찾기(`BOOKMARKS`) 두 목록입니다.
- **관리자 화면이 있는 새 앱을 만들면** `admin/index.html`의 `ADMIN_GROUPS`에 한 줄 추가합니다.
  - `login: 'fb'` = moontr.site 안의 앱 (자동 로그인)
  - `login: 'pw'` = 다른 주소의 앱 (jinseon50th.com 등, 같은 비밀번호를 한 번 더)
  - `login: 'gs'` = 구글 앱스 스크립트 교사용 화면
- 학생용 입구에도 보여야 하면 대문 `index.html`의 `APPS` 목록에도 추가합니다.

## Firebase
- 프로젝트: `moon-d528d` (moontr.site와 jinseon50th.com이 함께 씁니다).
- 보안 규칙은 이 저장소의 `firestore.rules` 하나에 모두 들어 있습니다. 새 컬렉션을 쓰면 여기에 규칙을 추가하고, 관리자만 써야 하는 곳은 `isTeacher()`를 씁니다.
- `firestore.rules`는 저장소에 올리는 것만으로는 적용되지 않습니다. Firebase 콘솔에 붙여 넣어 게시해야 한다고 사용자에게 알려 줍니다.

## 다른 저장소
- `jinseon50th.com` (진선 50주년, 해외연수 `/gt`) → 저장소 `vaca-at/jinseon50th`. 해외연수 앱은 moontr가 아니라 거기서 고칩니다.

## 마무리
- 코드 안 주석과 화면 문구는 한국어, 선생님이 메모장으로도 고칠 수 있게 쉬운 말로 씁니다.
- 고친 뒤 커밋·푸시하고, 실제 사이트에서 확인할 주소를 알려 줍니다.
