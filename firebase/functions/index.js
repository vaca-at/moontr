// AI Lab Cloud Functions — 1층 접수처에 들어온 캡쳐를 AI(Claude)가 읽고 방마다 카드로 정리해요.
//
//   readCapture   : Storage 의 ailab/captures/ 에 사진이 올라오면 자동으로 읽기
//                   (버킷이 US-EAST1 이라 Storage 이벤트를 받는 이 함수도 같은 지역 us-east1 이어야 해요)
//   readBundle    : 공문 PDF 묶음(본문 + 첨부, ailab/bundles/{id}/)을 다 올린 뒤 앱이 불러요. 묶음 전체를 공문 하나로 읽어요
//   rereadCapture : 앱의 [다시 읽기] 단추 (앱이 asia-northeast3 로 불러요). 사진 · 묶음 모두
//   morningBrief  : 매일 아침 6:30 (서울) 점검원이 카드 · 읽지 못한 자료 · 모든 웹앱 방문 수를 읽고 사장실 브리핑을 써요 (ailab_meta/briefing)
//   briefNow      : 사장실 [지금 브리핑 받기] 단추
//
// 방 목록(rooms.js)은 배포할 때 ../../ailab/rooms.js 에서 자동으로 복사돼요 (copy-rooms.mjs).
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { ROOMS } from './rooms.js';

initializeApp();
const db = getFirestore();
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const MODEL = 'claude-opus-5-5';
const CAPTURE_DIR = 'ailab/captures/';
const AI_ROOMS = Object.entries(ROOMS).filter(([, r]) => r.ai);
const FIELDS = ['title', 'date', 'end_date', 'time', 'place', 'subject', 'url'];

// 관리자 = 센메일 계정, 또는 구글 bellachord 계정 (구글이 확인한 메일만) — firestore.rules 의 isTeacher 와 같아요
function isTeacher(auth) {
  const t = auth?.token;
  return !!t && (t.email === 'anstjsdud@sen.go.kr' || (t.email === 'bellachord@gmail.com' && t.email_verified === true));
}

// ---------- 사진 준비: 긴 캡쳐는 조각내서 글자가 뭉개지지 않게 ----------
// 한 조각은 가로 최대 1400px, 세로는 가로의 1.4배까지. 조각끼리 조금 겹쳐 줄이 잘리지 않게 해요.
async function toTiles(buffer) {
  const img = sharp(buffer, { limitInputPixels: false }).rotate();
  const { width, height } = await img.metadata();
  const w = Math.min(width, 1400);
  const scale = w / width;
  const resized = await img.resize({ width: w }).png().toBuffer();
  const h = Math.round(height * scale);
  const tileH = Math.round(w * 1.4), overlap = 80;
  const tiles = [];
  for (let top = 0; top < h && tiles.length < 20; top += tileH - overlap) {
    const th = Math.min(tileH, h - top);
    const tile = await sharp(resized).extract({ left: 0, top, width: w, height: th }).jpeg({ quality: 88 }).toBuffer();
    tiles.push(tile.toString('base64'));
    if (top + th >= h) break;
  }
  return tiles;
}

// ---------- AI 에게 주는 안내 ----------
function seoulToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
const SYSTEM = `당신은 한국 중·고등학교 도덕 선생님의 자료 정리 연구실(AI Lab) 직원이에요.
선생님이 넣은 화면 캡쳐나 공문 PDF(연수 공문, 연수 홈페이지, 수업 공개 공문, 다른 선생님 지도안, 정보 보안 공문 등)를 읽고, 아래 방 가운데 알맞은 곳으로 보낼 카드를 만들어요.

방 목록 (room 에는 key 를 적어요):
${AI_ROOMS.map(([k, r]) => `- ${k} (${r.name}): ${r.desc}\n  세부 항목: ${r.fields.join(', ')}`).join('\n')}
- unknown: 어느 방에도 맞지 않거나 판단하기 어려울 때

규칙:
- 자료에 실제로 있는 내용만 적어요. 짐작해서 채우지 말고, 없으면 빈 문자열("")이나 빈 목록으로 두어요.
- 글자가 흐리거나 확실하지 않은 값은 그대로 적되 확실하지 않다고 표시해요 (unsure 목록 또는 세부 항목의 unsure: true).
- 자료 하나에 여러 건이 있으면 건마다 카드를 따로 만들어요. 예: 수업 공개 공문에 수업이 5개면 카드 5장. 도덕 수업은 moral, 다른 교과는 others.
- 공문 묶음(본문 + 첨부 PDF)은 모두 같은 공문이에요. 본문과 첨부가 같은 연수 · 같은 수업을 말하면 카드 한 장으로 합쳐요. 교시별 시간표 · 운영 계획은 보통 첨부에 있으니 첨부에서 찾아 periods 에 넣어요.
- 참여 대상자 명단 같은 다른 사람의 이름 목록은 옮겨 적지 않아요. 선생님 메모에 이름이 있으면 그 이름이 명단에 있는지만 적어요.
- 대상자 공문(선정 · 명단 안내)은 '선생님 이름'이 명단에 실제로 있을 때만 '대상자 여부'를 "나 (명단에 있음)"으로 적어요. 명단에 없으면 "나 아님 (우리 학교 다른 분)", 명단을 볼 수 없거나 이름을 모르면 "명단 확인 필요"로 적어요. 공문이 '대상자 안내'라는 것만으로 선생님이 대상자라고 하지 않아요.
- date / end_date 는 YYYY-MM-DD. 연도가 없으면 오늘 날짜를 기준으로 가장 가까운 앞으로의 날짜로 정해요. 하루짜리면 end_date 는 빈 문자열.
- time 은 "14:00~16:30" 이나 "5교시" 처럼 보이는 그대로 짧게.
- fields 의 label 은 그 방의 세부 항목 이름을 그대로 써요. 값이 없는 항목은 빼도 돼요.
- periods 는 교시별 일정이나 수업 흐름(도입·전개·정리 등)이 있을 때 label(예: "1교시", "도입")과 content 로.
- moral_link 는 수업·지도안이 도덕 수업과 어떻게 이어질 수 있는지 한 줄로 (해당 없으면 빈 문자열).
- summary 는 선생님이 한눈에 알 수 있는 한 줄 요약. keywords 는 3~6개.
- kind 는 자료 종류를 짧게 (예: 연수 안내, 대상자 공문, 연수 홈페이지, 수업 공개, 지도안, 과제 안내, 보안 권고, 보안 점검).
- 정보 보안 공문(security)은 학교 · 선생님이 해야 할 일과 기한을 date 와 fields 에 적어요. 공문에 '외부 전파 금지'처럼 밖으로 알리지 말라는 세부 내용(취약점 상세, 관제 정보 등)이 있으면 summary 와 fields 에는 해야 할 일만 짧게 쓰고 세부 내용은 옮겨 적지 않아요.
- 읽을 만한 자료가 전혀 없으면 cards 를 빈 목록으로.`;

const str = { type: 'string' };
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['room', 'kind', 'title', 'date', 'end_date', 'time', 'place', 'subject', 'url', 'summary', 'moral_link', 'keywords', 'fields', 'periods', 'unsure'],
        properties: {
          room: { type: 'string', enum: [...AI_ROOMS.map(([k]) => k), 'unknown'] },
          kind: str, title: str, date: str, end_date: str, time: str, place: str, subject: str, url: str, summary: str, moral_link: str,
          keywords: { type: 'array', items: str },
          fields: {
            type: 'array',
            items: { type: 'object', additionalProperties: false, required: ['label', 'value', 'unsure'], properties: { label: str, value: str, unsure: { type: 'boolean' } } },
          },
          periods: {
            type: 'array',
            items: { type: 'object', additionalProperties: false, required: ['label', 'content'], properties: { label: str, content: str } },
          },
          unsure: { type: 'array', items: { type: 'string', enum: FIELDS } },
        },
      },
    },
  },
};

// AI 를 부를 때마다 쓴 값을 어림해서 ailab_meta/usage 에 날짜별로 쌓아요 (사장실 계기판). Opus 5.5 값: 입력 $4 · 출력 $20 · 캐시 읽기 $0.2 · 캐시 쓰기 $5 (100만 토큰마다)
async function logUsage(kind, u) {
  if (!u) return;
  const usd = ((u.input_tokens || 0) * 4 + (u.output_tokens || 0) * 20 + (u.cache_read_input_tokens || 0) * 0.2 + (u.cache_creation_input_tokens || 0) * 5) / 1e6;
  await db.doc('ailab_meta/usage').set({
    total: FieldValue.increment(usd), calls: FieldValue.increment(1),
    days: { [seoulToday()]: FieldValue.increment(usd) }, kinds: { [kind]: FieldValue.increment(usd) }, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true }).catch((e) => logger.warn('사용량 기록 실패', e));
}

// blocks: Claude 에게 보낼 자료 (PDF 는 document, 사진 조각은 image), about: 자료가 어떤 모양인지 한 줄
async function readWithClaude(blocks, cap, about) {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
  // 대상자 명단에서 찾을 선생님 이름 (앱의 '내 이름' 칸 → ailab_meta/me). 공개되는 코드에는 넣지 않아요
  const myName = await db.doc('ailab_meta/me').get().then((s) => (s.exists ? String(s.data().name || '').trim() : '')).catch(() => '');
  const note = [
    `오늘 날짜: ${seoulToday()}`,
    myName ? `선생님 이름: ${myName} (대상자 명단에 이 이름이 있는지만 확인해요)` : '선생님 이름: 알 수 없음 (대상자 여부는 "명단 확인 필요")',
    cap.link ? `선생님이 함께 적은 링크 주소: ${cap.link}` : '',
    cap.memo ? `선생님 메모: ${cap.memo}` : '',
    about,
    '이 자료를 읽고 카드를 만들어 주세요.',
  ].filter(Boolean).join('\n');
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // 안전 분류기가 잘못 거절하면 서버가 다른 모델로 다시 읽어요
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [...blocks, { type: 'text', text: note }],
    }],
  });
  await logUsage('read', response.usage);
  if (response.stop_reason === 'refusal') throw new Error('AI가 이 자료를 읽지 않겠다고 했어요');
  if (response.stop_reason === 'max_tokens') throw new Error('내용이 너무 길어서 끝까지 읽지 못했어요');
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('AI 답이 비어 있어요');
  return JSON.parse(text).cards || [];
}

// ---------- 카드 정리 · 저장 ----------
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
function cleanCard(c, cap, capId) {
  const room = ROOMS[c.room]?.ai ? c.room : 'unknown';
  const fieldNames = new Set(ROOMS[room]?.fields || []);
  return {
    room,
    kind: c.kind || '',
    title: c.title || '',
    date: isDate(c.date) ? c.date : '',
    end_date: isDate(c.end_date) && c.end_date !== c.date ? c.end_date : '',
    time: c.time || '',
    place: c.place || '',
    subject: c.subject || '',
    url: c.url || (room === 'links' ? cap.link || '' : ''),
    summary: c.summary || '',
    moral_link: c.moral_link || '',
    keywords: (c.keywords || []).filter(Boolean).slice(0, 8),
    // 방의 세부 항목 이름과 맞는 것만, 방에 정해진 순서대로
    fields: [...(c.fields || [])]
      .filter((f) => f.value && (fieldNames.size === 0 || fieldNames.has(f.label)))
      .sort((a, b) => [...fieldNames].indexOf(a.label) - [...fieldNames].indexOf(b.label)),
    periods: (c.periods || []).filter((p) => p.content),
    unsure: [...new Set((c.unsure || []).filter((k) => FIELDS.includes(k)))],
    status: 'review',
    taskRef: false,
    captureId: capId,
    storagePath: cap.storagePath,
    createdAt: FieldValue.serverTimestamp(),
  };
}

// 넣은 파일들을 Claude 가 읽는 모양으로: PDF 는 그대로(document), 사진은 조각낸 image
// 한 번에 보낼 수 있는 크기(요청 32MB, base64 로 1/3 커져요)를 넘지 않게 PDF 는 합쳐서 20MB 까지
const PDF_MAX = 20 * 1024 * 1024;
const isPdfFile = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.path);
async function toBlocks(files) {
  const blocks = [];
  let pdfBytes = 0, pdfs = 0, tiles = 0;
  for (const f of files) {
    const [buffer] = await getStorage().bucket().file(f.path).download();
    if (isPdfFile(f)) {
      pdfBytes += buffer.length;
      if (pdfBytes > PDF_MAX) throw new Error('PDF가 합쳐서 20MB를 넘어요. 나눠서 넣어 주세요');
      blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } });
      pdfs++;
    } else {
      const t = await toTiles(buffer);
      t.forEach((data) => blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }));
      tiles += t.length;
    }
  }
  return { blocks, pdfs, tiles };
}

async function processCapture(capId) {
  const capRef = db.doc(`ailab_captures/${capId}`);
  const cap = (await capRef.get()).data() || {};
  try {
    // 묶음은 files 목록, 사진 한 장은 storagePath 하나
    const files = cap.files?.length ? cap.files : [{ path: cap.storagePath, type: 'image' }];
    if (!files[0]?.path) throw new Error('원본 파일을 찾지 못했어요');
    const { blocks, pdfs, tiles } = await toBlocks(files);
    const about = cap.bundle
      ? `공문 파일 ${files.length}개(본문 · 첨부)를 한 묶음으로 넣었어요. 모두 같은 공문이에요. 파일 이름: ${files.map((f) => f.name || f.path.split('/').pop()).join(', ')}`
      : tiles > 1 ? `긴 캡쳐 한 장을 위에서부터 ${tiles}조각으로 나눈 거예요 (조각끼리 조금 겹쳐요).` : '';
    const capInfo = { ...cap, storagePath: cap.storagePath || files[0].path };
    const cards = (await readWithClaude(blocks, capInfo, about)).map((c) => cleanCard(c, capInfo, capId));
    const batch = db.batch();
    cards.forEach((c) => batch.set(db.collection('ailab_cards').doc(), c));
    batch.set(capRef, {
      status: 'done', cardCount: cards.length, readAt: FieldValue.serverTimestamp(), error: FieldValue.delete(),
      note: cards.length ? FieldValue.delete() : '읽을 자료를 찾지 못했어요',
    }, { merge: true });
    await batch.commit();
    logger.info('ailab capture read', { capId, pdfs, tiles, cards: cards.length });
    return cards.length;
  } catch (e) {
    logger.error('ailab capture failed', { capId, error: e.message, status: e.status });
    const msg = e instanceof Anthropic.RateLimitError ? 'AI가 지금 바빠요. 잠시 뒤 다시 읽기를 눌러 주세요.'
      : e instanceof Anthropic.AuthenticationError ? 'AI 열쇠(ANTHROPIC_API_KEY)가 맞지 않아요.'
        : e instanceof Anthropic.APIError ? `AI 오류 (${e.status ?? '연결'}) — 잠시 뒤 다시 읽어 주세요.`
          : `읽지 못했어요: ${e.message}`;
    await capRef.set({ status: 'error', error: msg }, { merge: true });
    throw e;
  }
}

// ---------- 1) 사진이 올라오면 자동으로 ----------
export const readCapture = onObjectFinalized(
  { region: 'us-east1', memory: '1GiB', timeoutSeconds: 300, maxInstances: 5, secrets: [ANTHROPIC_API_KEY] },
  async (event) => {
    const path = event.data.name || '';
    if (!path.startsWith(CAPTURE_DIR)) return;
    const capId = path.slice(CAPTURE_DIR.length).replace(/\.[^.]+$/, '');
    const snap = await db.doc(`ailab_captures/${capId}`).get();
    // 앱이 기록(status: reading)을 먼저 만들고 사진을 올려요. 기록이 없거나 이미 읽은 사진은 건너뛰어요.
    if (!snap.exists || snap.data().status !== 'reading') return;
    await processCapture(capId).catch(() => {}); // 실패는 기록(status: error)에 남겼어요. 자동 재시도는 하지 않아요
  },
);

// ---------- 1-2) 공문 PDF 묶음: 앱이 파일을 모두 올린 뒤 불러요 ----------
// 파일이 여러 개라 Storage 이벤트로는 '다 올라왔는지' 알 수 없어서, 앱이 마지막에 직접 불러요
export const readBundle = onCall(
  { region: 'asia-northeast3', memory: '1GiB', timeoutSeconds: 540, maxInstances: 5, secrets: [ANTHROPIC_API_KEY] },
  async (req) => {
    if (!isTeacher(req.auth)) throw new HttpsError('permission-denied', '관리자 계정으로 로그인해 주세요.');
    const capId = String(req.data?.captureId || '');
    if (!/^[A-Za-z0-9]{10,40}$/.test(capId)) throw new HttpsError('invalid-argument', '묶음 번호가 이상해요.');
    const capRef = db.doc(`ailab_captures/${capId}`);
    // 두 번 눌려도 한 번만 읽어요: status 가 reading 이고 아직 아무도 맡지 않은 묶음만
    const claimed = await db.runTransaction(async (tx) => {
      const cap = (await tx.get(capRef)).data();
      if (!cap?.bundle || !cap.files?.length) throw new HttpsError('not-found', '묶음을 찾지 못했어요.');
      if (cap.status !== 'reading' || cap.claimed) return false;
      tx.update(capRef, { claimed: true });
      return true;
    });
    if (!claimed) return { skipped: true };
    try {
      return { cardCount: await processCapture(capId) };
    } catch {
      throw new HttpsError('internal', (await capRef.get()).data()?.error || '읽지 못했어요.');
    }
  },
);

// ---------- 3) 점검원 · 아침 브리핑 ----------
// 웹앱 이름 (site_counts 이름 → 보여 줄 이름). 앱 쪽 WEBAPPS 와 같아요
const WEBAPP_NAMES = {
  ailab: '문쌤의 AI 연구소', desk: '교무실 타이쿤(웹)', deskapp: '교무실 타이쿤 안드로이드 앱', app: '생윤 만점 다이어리', idea: '윤사 만점 다이어리', home: '대문',
  sonagi: '소나기 연수 실습', c22: '통사 학습지(통합사회2 윤리)', 110: '1학년 10반 관리', vibe: '바이브코딩 매뉴얼', note10: '우리반 생기부노트', 'jinseon-gt': '50주년 해외연수',
  'drs-booth': '또래상담부 부스 상황판', check04: '출석체크', '0911': '9월 컨설팅장학 수업 사례', drs: '또래상담부 DRS', simin: '자성동이 AI 공부방', study: '새싹 AI 공부방',
  stuvibe: '바이브코딩 진로탐구(이론편)', vibelab: '바이브코딩 진로탐구(실습편)',
};
const BRIEF_SYSTEM = `당신은 한국 중·고등학교 도덕 선생님의 자료 연구실(AI Lab) 점검원이에요. 매일 아침 사장실(선생님)에게 짧은 브리핑을 써요.
받는 자료: 오늘 날짜, 연구소 카드 목록(방 · 종류 · 제목 · 날짜 · 상태 · 대상자 여부 · 요약), 읽지 못한 자료 수, 선생님이 만든 웹앱들의 최근 14일 방문 수.
규칙:
- 자료에 있는 것만 써요. 짐작하지 않아요. 문장은 짧고 쉬운 말로, 존댓말(~해요)로.
- today: 오늘 꼭 할 일 · 오늘 있는 일 (없으면 빈 목록). 최대 4개.
- soon: 앞으로 14일 안의 일정을 날짜순으로 최대 6개. note 에는 겹치는 일정 · 준비할 것 · 마감 같은 한 줄.
- checks: 점검원이 찾은 문제 최대 5개. 예: 같은 일정이 겹침, 날짜 없는 카드, 같은 연수 카드가 여러 장, 대상자 공문인데 '명단 확인 필요', 끝난 연수인데 이수증 없음, 확인 전 카드, 읽지 못한 자료. room 은 방 key.
- webapps: 웹앱 이용 현황 3~5줄. 많이 쓰인 곳, 지난주보다 늘거나 준 곳, 오래 쉬는 곳.
- headline: 오늘 아침 한 줄 요약.
- 학생 개인정보 · 다른 사람 이름은 쓰지 않아요.`;
const BRIEF_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['headline', 'today', 'soon', 'checks', 'webapps'],
  properties: {
    headline: str,
    today: { type: 'array', items: str },
    soon: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['date', 'title', 'note'], properties: { date: str, title: str, note: str } } },
    checks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'why', 'room'], properties: { title: str, why: str, room: str } } },
    webapps: { type: 'array', items: str },
  },
};
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
async function writeBriefing(by) {
  const today = seoulToday();
  const [cards, caps, counts] = await Promise.all([db.collection('ailab_cards').get(), db.collection('ailab_captures').where('status', '==', 'error').get(), db.collection('site_counts').get()]);
  const cardList = cards.docs.map((d) => d.data()).map((c) => ({
    room: c.room, kind: c.kind || '', title: c.title || '', date: c.date || '', end: c.end_date || '', time: c.time || '', status: c.status,
    mine: (c.fields || []).find((f) => f.label === '대상자 여부')?.value || '', summary: String(c.summary || '').slice(0, 80),
  }));
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const sites = {};
  counts.docs.forEach((d) => {
    const m = d.id.match(/^(.+)__(total|d(\d{4}-\d{2}-\d{2}))$/);
    if (!m || !WEBAPP_NAMES[m[1]]) return;
    const o = (sites[m[1]] ||= { name: WEBAPP_NAMES[m[1]], total: 0, days: {} });
    if (m[2] === 'total') o.total = d.data().n || 0; else if (days.includes(m[3])) o.days[m[3]] = d.data().n || 0;
  });
  const web = Object.values(sites).map((o) => ({ name: o.name, total: o.total, last14: days.map((d) => o.days[d] || 0) }));
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
  const response = await client.beta.messages.create({
    model: MODEL, max_tokens: 6000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: BRIEF_SCHEMA } },
    system: BRIEF_SYSTEM,
    messages: [{ role: 'user', content: `오늘 날짜: ${today}\n방 이름: ${JSON.stringify(Object.fromEntries(Object.entries(ROOMS).map(([k, r]) => [k, r.name])))}\n읽지 못한 자료: ${caps.size}개\n\n카드 ${cardList.length}장:\n${JSON.stringify(cardList)}\n\n웹앱 최근 14일 방문 (${days[0]} ~ ${today}, 마지막 칸이 오늘):\n${JSON.stringify(web)}` }],
  });
  await logUsage('brief', response.usage);
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('AI 답이 비어 있어요');
  const brief = JSON.parse(text);
  await db.doc('ailab_meta/briefing').set({ ...brief, date: today, by, model: response.model || MODEL, at: FieldValue.serverTimestamp() });
  return brief;
}
export const morningBrief = onSchedule(
  { schedule: '30 6 * * *', timeZone: 'Asia/Seoul', region: 'asia-northeast3', memory: '512MiB', timeoutSeconds: 300, secrets: [ANTHROPIC_API_KEY] },
  async () => { await writeBriefing('아침 6:30'); },
);
export const briefNow = onCall(
  { region: 'asia-northeast3', memory: '512MiB', timeoutSeconds: 300, maxInstances: 2, secrets: [ANTHROPIC_API_KEY] },
  async (req) => {
    if (!isTeacher(req.auth)) throw new HttpsError('permission-denied', '관리자 계정으로 로그인해 주세요.');
    try { await writeBriefing('지금 받기'); return { ok: true }; } catch (e) { logger.error(e); throw new HttpsError('internal', `브리핑을 쓰지 못했어요 (${e.message})`); }
  },
);

// ---------- 2) [다시 읽기] 단추 ----------
export const rereadCapture = onCall(
  { region: 'asia-northeast3', memory: '1GiB', timeoutSeconds: 300, maxInstances: 5, secrets: [ANTHROPIC_API_KEY] },
  async (req) => {
    if (!isTeacher(req.auth)) throw new HttpsError('permission-denied', '관리자 계정으로 로그인해 주세요.');
    const capId = String(req.data?.captureId || '');
    if (!/^[A-Za-z0-9]{10,40}$/.test(capId)) throw new HttpsError('invalid-argument', '사진 번호가 이상해요.');
    const capRef = db.doc(`ailab_captures/${capId}`);
    const cap = (await capRef.get()).data();
    if (!cap?.storagePath && !cap?.files?.length) throw new HttpsError('not-found', '원본 파일을 찾지 못했어요.');
    // 아직 확인 전인 카드만 지우고 다시 만들어요. 선생님이 [맞아요]로 보관한 카드는 그대로 둬요.
    const old = await db.collection('ailab_cards').where('captureId', '==', capId).get();
    const batch = db.batch();
    old.docs.filter((d) => d.data().status === 'review').forEach((d) => batch.delete(d.ref));
    batch.set(capRef, { status: 'reading', claimed: true, error: FieldValue.delete() }, { merge: true });
    await batch.commit();
    try {
      return { cardCount: await processCapture(capId) };
    } catch {
      throw new HttpsError('internal', (await capRef.get()).data()?.error || '읽지 못했어요.');
    }
  },
);
