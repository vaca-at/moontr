// AI Lab Cloud Functions — 1층 접수처에 들어온 캡쳐를 AI(Claude)가 읽고 방마다 카드로 정리해요.
//
//   readCapture   : Storage 의 ailab/captures/ 에 사진이 올라오면 자동으로 읽기
//                   (버킷이 US-EAST1 이라 Storage 이벤트를 받는 이 함수도 같은 지역 us-east1 이어야 해요)
//   rereadCapture : 앱의 [다시 읽기] 단추 (앱이 asia-northeast3 로 불러요)
//
// 방 목록(rooms.js)은 배포할 때 ../../ailab/rooms.js 에서 자동으로 복사돼요 (copy-rooms.mjs).
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
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
선생님이 넣은 화면 캡쳐(연수 공문, 연수 홈페이지, 수업 공개 공문, 다른 선생님 지도안 등)를 읽고, 아래 방 가운데 알맞은 곳으로 보낼 카드를 만들어요.

방 목록 (room 에는 key 를 적어요):
${AI_ROOMS.map(([k, r]) => `- ${k} (${r.name}): ${r.desc}\n  세부 항목: ${r.fields.join(', ')}`).join('\n')}
- unknown: 어느 방에도 맞지 않거나 판단하기 어려울 때

규칙:
- 사진에 실제로 보이는 내용만 적어요. 짐작해서 채우지 말고, 없으면 빈 문자열("")이나 빈 목록으로 두어요.
- 글자가 흐리거나 확실하지 않은 값은 그대로 적되 확실하지 않다고 표시해요 (unsure 목록 또는 세부 항목의 unsure: true).
- 사진 한 장에 여러 건이 있으면 건마다 카드를 따로 만들어요. 예: 수업 공개 공문에 수업이 5개면 카드 5장. 도덕 수업은 moral, 다른 교과는 others.
- date / end_date 는 YYYY-MM-DD. 연도가 없으면 오늘 날짜를 기준으로 가장 가까운 앞으로의 날짜로 정해요. 하루짜리면 end_date 는 빈 문자열.
- time 은 "14:00~16:30" 이나 "5교시" 처럼 보이는 그대로 짧게.
- fields 의 label 은 그 방의 세부 항목 이름을 그대로 써요. 값이 없는 항목은 빼도 돼요.
- periods 는 교시별 일정이나 수업 흐름(도입·전개·정리 등)이 있을 때 label(예: "1교시", "도입")과 content 로.
- moral_link 는 수업·지도안이 도덕 수업과 어떻게 이어질 수 있는지 한 줄로 (해당 없으면 빈 문자열).
- summary 는 선생님이 한눈에 알 수 있는 한 줄 요약. keywords 는 3~6개.
- kind 는 자료 종류를 짧게 (예: 연수 안내, 대상자 공문, 연수 홈페이지, 수업 공개, 지도안, 과제 안내).
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

async function readWithClaude(tiles, cap) {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
  const note = [
    `오늘 날짜: ${seoulToday()}`,
    cap.link ? `선생님이 함께 적은 링크 주소: ${cap.link}` : '',
    cap.memo ? `선생님 메모: ${cap.memo}` : '',
    tiles.length > 1 ? `긴 캡쳐 한 장을 위에서부터 ${tiles.length}조각으로 나눈 거예요 (조각끼리 조금 겹쳐요).` : '',
    '이 캡쳐를 읽고 카드를 만들어 주세요.',
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
      content: [
        ...tiles.map((data) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } })),
        { type: 'text', text: note },
      ],
    }],
  });
  if (response.stop_reason === 'refusal') throw new Error('AI가 이 사진을 읽지 않겠다고 했어요');
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

async function processCapture(capId, path) {
  const capRef = db.doc(`ailab_captures/${capId}`);
  const cap = (await capRef.get()).data() || {};
  try {
    const [buffer] = await getStorage().bucket().file(path).download();
    const tiles = await toTiles(buffer);
    const cards = (await readWithClaude(tiles, { ...cap, storagePath: path })).map((c) => cleanCard(c, { ...cap, storagePath: path }, capId));
    const batch = db.batch();
    cards.forEach((c) => batch.set(db.collection('ailab_cards').doc(), c));
    batch.set(capRef, {
      status: 'done', cardCount: cards.length, readAt: FieldValue.serverTimestamp(), error: FieldValue.delete(),
      note: cards.length ? FieldValue.delete() : '읽을 자료를 찾지 못했어요',
    }, { merge: true });
    await batch.commit();
    logger.info('ailab capture read', { capId, tiles: tiles.length, cards: cards.length });
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
    await processCapture(capId, path).catch(() => {}); // 실패는 기록(status: error)에 남겼어요. 자동 재시도는 하지 않아요
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
    if (!cap?.storagePath) throw new HttpsError('not-found', '원본 사진을 찾지 못했어요.');
    // 아직 확인 전인 카드만 지우고 다시 만들어요. 선생님이 [맞아요]로 보관한 카드는 그대로 둬요.
    const old = await db.collection('ailab_cards').where('captureId', '==', capId).get();
    const batch = db.batch();
    old.docs.filter((d) => d.data().status === 'review').forEach((d) => batch.delete(d.ref));
    batch.set(capRef, { status: 'reading', error: FieldValue.delete() }, { merge: true });
    await batch.commit();
    try {
      return { cardCount: await processCapture(capId, cap.storagePath) };
    } catch {
      throw new HttpsError('internal', (await capRef.get()).data()?.error || '읽지 못했어요.');
    }
  },
);
