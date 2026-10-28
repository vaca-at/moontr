# AI Lab 함수 (Firebase · moon-d528d)

1층 접수처에 넣은 캡쳐를 AI(Claude)가 읽고 방마다 카드로 정리하는 함수예요.

| 함수 | 언제 | 지역 |
| --- | --- | --- |
| `readCapture` | Storage `ailab/captures/` 에 사진이 올라오면 자동으로 | us-east1 (Storage 버킷과 같은 곳) |
| `rereadCapture` | 앱의 [다시 읽기] 단추 | asia-northeast3 (서울) |

- 긴 캡쳐는 위에서부터 몇 조각으로 나눠 함께 보내요 (글자가 뭉개지지 않게).
- 다시 읽으면 아직 확인 전인 카드만 새로 만들고, [맞아요]로 보관한 카드는 그대로 둬요.
- 방 목록은 `ailab/rooms.js` 하나만 고치면 돼요. 배포할 때 `functions/rooms.js` 로 자동 복사돼요.

## 처음 한 번

```bash
npm install -g firebase-tools
firebase login
cd firebase/functions && npm install && cd ..
firebase functions:secrets:set ANTHROPIC_API_KEY   # Claude API 키 붙여 넣기 (console.anthropic.com)
```

## 배포

```bash
cd firebase
firebase deploy --only functions:ailab
```

- 처음 배포할 때 Storage 이벤트 권한을 만드느라 실패할 수 있어요. 몇 분 뒤 같은 명령을 다시 하면 돼요.
- 규칙도 여기서 올릴 수 있어요: `firebase deploy --only firestore:rules,storage` (저장소의 `firestore.rules` · `storage.rules` 가 콘솔 규칙을 덮어써요).
