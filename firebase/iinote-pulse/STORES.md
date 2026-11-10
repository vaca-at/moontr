# 📱 아이아이노트 이용 현황: 맥에서 준비하고 올리기

moontr.site/admin '오늘의 현황'의 **📱 아이아이노트 앱 이용 현황** 칸을 채우는 방법이에요.

- **플레이스토어:** 하루 설치 · 삭제 수, 지금 설치된 기기 수, 누적 설치자 수
- **앱스토어:** 하루 다운로드 · 업데이트 수, 많이 받은 나라
- **앱 안 이용 (웹 + 앱):** 가족 수, 오늘 · 7일 동안 일기를 쓴 가족과 사람 수, 일기 수

코드는 이미 들어 있어요(`functions/index.js`의 `storeDaily` · `iinoteStats`). 맥에서는 **열쇠를 넣고 올리기만** 하면 돼요.

- 숫자만 모아요. 이름 · 메일 · 일기 내용은 모으지 않아요.
- 매일 아침 9시 반(한국)에 저절로 모아요. 관리자 허브의 [지금 다시 모으기]로 바로 모을 수도 있어요.

---

## 0. 맥 준비 (처음 한 번)

1. **Node.js 22** 설치: https://nodejs.org → LTS 버전 macOS 설치 파일(.pkg)을 받아 설치해요.
2. **터미널**을 열고 Firebase 도구를 설치해요.
   ```bash
   npm install -g firebase-tools
   ```
   권한 오류가 나면 앞에 `sudo `를 붙이고 맥 비밀번호를 넣어요.
3. 아이아이노트 Firebase 프로젝트 주인 구글 계정으로 로그인해요.
   ```bash
   firebase login
   ```
4. 저장소를 받고 함수 폴더로 가요. 이미 받아 두었다면 `git pull`만 해요.
   ```bash
   git clone https://github.com/vaca-at/moontr.git
   cd moontr/firebase/iinote-pulse/functions
   npm install
   cd ..
   ```
   이제부터 명령은 모두 `moontr/firebase/iinote-pulse` 폴더에서 해요.

---

## 1. 플레이스토어 준비 (약 5분, 반영까지 하루 이틀)

### 1-1. 아이아이노트 서버 계정 이메일 알아내기

1. Firebase 콘솔 → **iinote** 프로젝트 → ⚙️ **프로젝트 설정** → **프로젝트 번호**(숫자)를 복사해요.
2. 서버 계정 이메일은 `프로젝트번호-compute@developer.gserviceaccount.com` 이에요.
   - 예: `123456789012-compute@developer.gserviceaccount.com`

### 1-2. Play Console에 그 계정을 초대하기

1. https://play.google.com/console → 왼쪽 **사용자 및 권한** → **새 사용자 초대**를 눌러요.
2. 이메일 칸에 1-1의 서버 계정 이메일을 넣어요.
3. **계정 권한** 탭에서 **'앱 정보 보기 및 대량 보고서 다운로드(읽기 전용)'**만 켜요.
4. **사용자 초대**를 눌러요.

권한이 실제로 통하기까지 **최대 하루 이틀** 걸릴 수 있어요. 그 전에는 관리자 허브에 '403' 오류가 보여요.

### 1-3. 보고서 저장소(버킷) 이름 알아내기

1. Play Console → 왼쪽 **보고서 다운로드** → **통계**를 열어요.
2. 위쪽 **Cloud Storage URI 복사**를 눌러요.
   - 복사한 글: `gs://pubsite_prod_rev_01234567890123456789/stats/...`
3. 이 중 `pubsite_prod_rev_숫자` 부분만 2번(.env)에 적어요.

---

## 2. 앱스토어 준비 (약 5분, 윈도우에서 해도 돼요)

### 2-1. App Store Connect API 키 만들기

1. https://appstoreconnect.apple.com → **사용자 및 액세스** → 위쪽 **통합** 탭 → **App Store Connect API** → **팀 키**로 가요.
   - 처음이면 '액세스 요청'을 먼저 눌러요.
2. **(+)** 키 만들기를 눌러요.
   - 이름: `iinote stats`
   - 액세스: **판매**
3. 만든 키 줄에서 세 가지를 챙겨요.
   - **키 ID** (10글자)
   - 표 위쪽의 **발급자 ID**(Issuer ID, 긴 글자)
   - **API 키 다운로드** → `AuthKey_키ID.p8` 파일
     - **딱 한 번만 받을 수 있어요.** 잘 보관해 두세요.

### 2-2. 공급업체 번호(Vendor number) 알아내기

- App Store Connect → **판매 및 추세**(또는 **결제 및 재무 보고서**) → 화면 왼쪽 위의 숫자(예: `81234567`)예요.

---

## 3. 값 넣기

### 3-1. `functions/.env` 파일 만들기 (비밀이 아닌 값)

`moontr/firebase/iinote-pulse/functions/.env` 파일을 만들고 아래처럼 적어요.

```
PLAY_BUCKET=pubsite_prod_rev_01234567890123456789
ASC_ISSUER=69a6de7e-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ASC_KEY_ID=ABCDE12345
ASC_VENDOR=81234567
```

- 이 파일은 `.gitignore`에 들어 있어서 깃허브에 올라가지 않아요.
- 아직 준비 안 된 스토어는 그 줄을 비워 두면(예: `PLAY_BUCKET=`) 건너뛰어요.
- `PLAY_PACKAGE`(kr.co.iinote.app)와 `ASC_APP_ID`(6831842667)는 이미 정해져 있어서 적지 않아도 돼요.

### 3-2. 앱스토어 키 파일(.p8)은 비밀 저장소에

```bash
firebase functions:secrets:set ASC_P8 --data-file ~/Downloads/AuthKey_ABCDE12345.p8
```

- 파일 이름은 받은 이름으로 바꿔요.
- 앱스토어 준비를 나중에 할 거면, 지금은 아래처럼 입력하고 물으면 `none`을 넣어요. 그래도 올라가요.
  ```bash
  firebase functions:secrets:set ASC_P8
  ```

---

## 4. 올리기

```bash
firebase deploy --only functions:pulse
```

- 처음에는 'Cloud Scheduler API를 켤까요?'처럼 물을 수 있어요. 모두 `y`를 눌러요.
- 올라가는 함수: `iinotePulse`(원래 있던 것) · `storeDaily`(매일 9시 반) · `iinoteStats`(관리자 허브가 읽어 가요)
- 아이아이노트의 다른 함수와 묶음(codebase)이 달라서, 서로 지워지지 않아요.

---

## 5. 확인

1. moontr.site/admin에 로그인해요.
2. **오늘의 현황** → **📱 아이아이노트 앱 이용 현황**에서 **[지금 다시 모으기]**를 눌러요. 1분쯤 걸려요.
3. 세 칸(💚 플레이스토어 · 🍎 앱스토어 · 📒 앱 안 이용)에 숫자와 30일 그래프가 나오면 끝이에요.

### 칸 아래에 이런 글이 보이면

| 보이는 글 | 뜻 · 할 일 |
|---|---|
| `PLAY_BUCKET 없음` / `App Store Connect 키 없음` | 3번에서 그 값을 비워 둔 거예요. 채우고 4번을 다시 해요 |
| 플레이스토어 `오류: ... 403` | 1-2 권한이 아직 안 통했어요. 하루 이틀 기다려요 |
| 앱스토어 `401` | 키 ID · 발급자 ID · .p8 파일 중 하나가 틀렸어요 |
| 앱스토어 숫자가 0 | 그날 다운로드가 없었거나, 애플이 아직 보고서를 안 만들었어요(다음 날 채워져요) |
| '아직 함수를 올리지 않았어요' | 4번을 아직 안 했거나 올리기가 실패했어요 |

---

## 6. 나중에 더 할 수 있는 것

- **앱 안 기기 종류:** 아이폰 앱 · 안드로이드 앱 · 웹을 따로 세기. 아이아이노트에 접속 기록 한 줄을 넣어야 해요.
- **애플 분석 보고서:** 활성 기기 수, 사용 시간. App Store Connect의 Analytics Reports를 따로 신청해야 하고, 며칠 뒤부터 쌓여요.

## 만든 것 (2026-11-10)

| 위치 | 내용 |
|---|---|
| `functions/index.js` | `storeDaily`(매일 모으기) · `iinoteStats`(관리자 허브용, 관리자 로그인 확인) |
| Firestore(iinote) | `ops_store/{날짜}`(play · ios 숫자) · `ops_use/{날짜}`(가족 · 일기 수) · `ops_store/_last`(마지막으로 모은 결과). 서버만 써요 |
| `admin/index.html` (moontr) | '📱 아이아이노트 앱 이용 현황' 세 칸 · [지금 다시 모으기] |
