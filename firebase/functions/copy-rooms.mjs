// 배포 직전에 앱의 방 목록(ailab/rooms.js)을 함수 폴더로 복사해요. 방을 고치면 앱과 함수가 같이 바뀌어요.
import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
copyFileSync(join(here, '..', '..', 'ailab', 'rooms.js'), join(here, 'rooms.js'));
console.log('ailab/rooms.js → firebase/functions/rooms.js 복사했어요');
