// 🤖 통합사회 데이터 실험실 AI 서버 (moontr.site/datalab) — Cloudflare Worker + Anthropic Claude
//  학생: POST /review  반박 글을 세 기준(수치 인용 · 다른 원인 · 윤리적 근거)으로 검토
//        POST /partner 탐구 파트너: 답 대신 생각할 질문 하나
//  선생님(관리자 구글 로그인 표 확인): POST /seteuk 세특 초안 · POST /reflect 수업 실천 성찰문 초안
//        POST /report 일괄 출력용 학생 한 명: 잘한 점 · 격려(학생에게) · 예상 세특 (2026-11-17)
//  학생은 학번을 보내지 않아요. 하루 사용 횟수만 알아보기 어려운 번호(who)로 세요 (Durable Object 'Quota')
//  비밀값: ANTHROPIC_API_KEY  (npx wrangler@4 secret put ANTHROPIC_API_KEY)
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4';   // SDK 의 zodOutputFormat 은 zod v4 문법이 필요해요
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { DurableObject } from 'cloudflare:workers';

const MODEL = 'claude-opus-5-5';
// 안전 분류기가 드물게 거절하면 같은 요청을 알맞은 다른 모델로 다시 돌려요 (서버 쪽 대체, 베타)
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
const ORIGINS = ['https://moontr.site', 'https://vaca-at.github.io', 'http://localhost:8765', 'http://127.0.0.1:8765'];
const LIMIT = { review: 30, partner: 40 };   // 학생 한 명 하루 횟수 (화면에서는 탐구마다 5 · 8번으로 더 줄여요)
const cors = (req) => { const o = req.headers.get('Origin') || ''; return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) || /^http:\/\/localhost:\d+$/.test(o) ? o : ORIGINS[0], Vary: 'Origin' }; };
const json = (req, d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(req) } });
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);

// 모든 요청이 함께 쓰는 긴 지시문 (캐시해서 비용 · 시간을 줄여요)
const BASE = `너는 한국 고등학교 통합사회 'AI활용탐구' 수업의 AI 조력자야. 학생은 '교정적 정의' 또는 '자본주의의 윤리적 쟁점' 주제를 골라 50분 동안 데이터 분석 8단계(문제 이해 → 데이터 수집 방법 → 정제 → 분석 · 시각화 → AI 모델 적용 · 평가 → 해석 · 해결안 → 실행 → 공유 · 성찰)를 혼자 진행해.
수업의 핵심: 'AI 모델의 분석 결과'(그럴듯하지만 데이터를 잘못 읽은 결론)를 학생이 직접 계산한 수치로 검증하고, 정의 · 시장 윤리의 개념으로 해석하는 경험.
지켜야 할 것
- 반드시 한국어, 고등학교 1학년이 바로 이해하는 쉬운 말, 존댓말(~해요).
- 정답이나 완성된 문장을 대신 써 주지 마. 학생이 스스로 고칠 수 있게 구체적인 질문이나 단서를 줘.
- 주어진 표와 계산 값에 있는 숫자만 사실로 다뤄. 표에 없는 통계를 지어내지 마. 표의 숫자는 수업 연습용 예시라는 걸 기억해.
- 학생이 개인 정보(이름 · 연락처 · 개인 경험)를 쓰면 쓰지 않도록 부드럽게 알려 줘.
- 정치적으로 한쪽 입장을 강요하지 말고, 여러 관점(예: 처벌과 회복, 시장과 정부, 효율과 공정)을 비교하도록 도와.
- 칭찬은 구체적으로 짧게, 꾸밈말은 쓰지 마.
검토 기준(각 0 · 1 · 2점)
- data(수치 인용): 0 숫자 없음 · 1 숫자 하나 또는 표와 맞지 않음 · 2 표 · 계산 값의 숫자를 두 개 이상 정확히 비교에 씀
- other(다른 원인 · 한계): 0 없음 · 1 언급만 · 2 숫자가 말하지 않는 원인이나 데이터의 한계를 구체적으로 설명
- concept(윤리적 근거): 0 없음 · 1 사상가 이름이나 개념 낱말만 · 2 교과서 사상가(교정적 정의: 칸트 · 벤담 · 베카리아 · 루소 / 자본주의: 스미스 · 케인즈 · 하이에크)의 주장이나 윤리 원리를 써서 결론이 옳은지 그른지 판단
이 수업은 윤리 교과 수업이야. 데이터로 사실을 확인한 뒤 '무엇이 옳은가'를 사상가의 원리로 판단하게 도와. 도덕 원리 + 사실 판단 → 도덕 판단(실천적 삼단논법)의 순서를 떠올리게 해.`;

const topicText = (t, mine) => `[주제] ${clean(t.group, 30)} · ${clean(t.title, 120)}
[핵심 질문] ${clean(t.q, 200)}
[사상가] ${clean(t.thinkers, 700)}
[AI 모델의 분석 결과(검증 대상)] ${clean(t.claim, 400)}
[계산] ${clean(t.calc, 200)}
[표]
${clean(t.table, 2500)}
${mine ? `[학생이 고른 대상] ${clean(mine, 200)}` : ''}`;

const Review = z.object({
  data: z.number().int().min(0).max(2),
  other: z.number().int().min(0).max(2),
  concept: z.number().int().min(0).max(2),
  good: z.string(),
  next: z.string(),
});

// 일괄 출력: 학생에게 주는 칭찬 · 격려 + 선생님이 볼 예상 세특
const Report = z.object({
  praise: z.string(),
  cheer: z.string(),
  seteuk: z.string(),
});

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors(req), 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400' } });
    if (req.method !== 'POST') return json(req, { ok: true, service: 'moontr-datalab-ai' });
    const body = await req.json().catch(() => ({}));
    // ── 학생 로그인 · 저장 우회로 (2026-11-17): 학교망이 firestore.googleapis.com 을 막을 때 이 서버가 대신 전해 줘요
    //    로그인 없는 요청 그대로 전하므로 보안 규칙이 똑같이 적용돼요. 학번 문서 · 계정 문서만, 읽기 · 칸 고치기 · 새로 만들기만
    if (url.pathname === '/fs') return fsProxy(req, body);
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    try {
      // ── 학생 ──
      if (url.pathname === '/review' || url.pathname === '/partner') {
        const kind = url.pathname.slice(1), who = clean(body.who, 40);
        if (!/^[a-z0-9]{8,40}$/.test(who) || !body.topic) return json(req, { error: 'bad' }, 400);
        const q = env.QUOTA.get(env.QUOTA.idFromName('q'));
        const ok = await q.fetch(`https://q/use?who=${who}&k=${kind}&max=${LIMIT[kind]}`).then((r) => r.json());
        if (!ok.ok) return json(req, { error: '오늘 쓸 수 있는 횟수를 다 썼어요. 내일 다시 써 주세요' }, 429);
        const system = [{ type: 'text', text: BASE, cache_control: { type: 'ephemeral' } }];
        if (kind === 'review') {
          const text = clean(body.text, 1500);
          const res = await client.messages.parse({
            model: MODEL, max_tokens: 4000, output_config: { effort: 'low', format: zodOutputFormat(Review) }, system,
            messages: [{ role: 'user', content: `${topicText(body.topic, body.mine)}\n\n[학생의 반박]\n${text}\n\n검토 기준으로 점수를 매기고, good 에는 잘한 점 한 문장(없으면 빈 글), next 에는 가장 낮은 기준을 높이도록 돕는 질문 한두 문장을 써. 완성된 답을 대신 써 주지 마.` }],
          });
          if (res.stop_reason === 'refusal' || !res.parsed_output) return json(req, { error: 'AI가 이 글을 검토하지 못했어요' }, 502);
          const p = res.parsed_output;
          return json(req, { scores: { data: p.data, other: p.other, concept: p.concept }, good: p.good.slice(0, 300), next: p.next.slice(0, 400) });
        }
        const hist = (Array.isArray(body.history) ? body.history : []).slice(-4).flatMap((h) => [{ role: 'user', content: clean(h.q, 300) || '…' }, { role: 'assistant', content: clean(h.a, 600) || '…' }]);
        const notes = body.notes || {};
        const res = await client.beta.messages.create({
          model: MODEL, max_tokens: 3000, output_config: { effort: 'low' }, system, ...FALLBACK,
          messages: [{ role: 'user', content: `${topicText(body.topic, body.mine)}\n[학생이 지금까지 쓴 것] 예상: ${clean(notes.guess, 300)} / 찾은 것: ${clean(notes.find, 400)} / 반박: ${clean(notes.rebut, 600)}\n지금부터 너는 '탐구 파트너'야. 학생 질문에 정답을 말하지 말고, 2~3문장으로 생각의 단서를 주고 마지막에 질문 하나를 돌려줘.` }, { role: 'assistant', content: '네, 답 대신 생각할 단서와 질문으로 도울게요.' }, ...hist, { role: 'user', content: clean(body.q, 300) }],
        });
        if (res.stop_reason === 'refusal') return json(req, { error: 'AI가 이 질문에 답하지 못했어요' }, 502);
        const reply = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
        return json(req, { reply: reply.slice(0, 800) });
      }
      // ── 선생님: 일괄 출력용 학생 한 명 (잘한 점 · 격려 · 예상 세특) ──
      if (url.pathname === '/report') {
        const who = await verifyFirebase(String(req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
        if (!who || !ADMIN_EMAILS.includes(who.email)) return json(req, { error: 'unauthorized' }, 401);
        const res = await client.messages.parse({
          model: MODEL, max_tokens: 8000, output_config: { effort: 'medium', format: zodOutputFormat(Report) },
          system: [{ type: 'text', text: BASE, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: `아래는 한 학생이 '데이터 실험실'(AI활용탐구) · '알고리즘 실험실'에서 실제로 남긴 탐구 기록이야. 선생님이 반 전체 보고서를 출력해 학생에게 나눠 주려고 해. 이 기록만 근거로 세 가지를 써 줘.
- praise: 학생에게 하는 칭찬 2~3문장. 존댓말(~했어요). 기록에 있는 구체적인 장면(직접 계산한 숫자, AI 결론을 반박한 근거, 사상가 연결, 해결안, 고른 규칙 등)을 짚어서. 꾸밈말(대단해요, 훌륭해요 같은 말만 있는 칭찬) 대신 무엇을 잘했는지를 말해.
- cheer: 다음 탐구를 위한 격려 1~2문장. 아직 못 한 단계나 더 키울 점 하나를 부드럽게, 할 수 있다는 응원과 함께. 꾸짖는 말투 금지.
- seteuk: 학교생활기록부 '세부능력 및 특기사항' 예상 문장. 400~500자(공백 포함), 한 문단, '~함.' '~임.' 명사형 끝맺음, 주어 생략, 이름 · 학번 없이. 기록에 있는 활동만(없는 활동 · 수상 · 대회 · 사교육 · 부모 직업 금지), 뛰어난 · 탁월한 같은 꾸밈말 금지. 기록이 적으면 있는 만큼만 짧게 써.
[탐구 기록]
${JSON.stringify(body.evidence || []).slice(0, 12000)}` }],
        });
        if (res.stop_reason === 'refusal' || !res.parsed_output) return json(req, { error: 'AI가 이 학생 글을 쓰지 못했어요' }, 502);
        const p = res.parsed_output;
        return json(req, { praise: p.praise.slice(0, 600), cheer: p.cheer.slice(0, 400), seteuk: p.seteuk.slice(0, 900) });
      }
      // ── 선생님 ──
      if (url.pathname === '/seteuk' || url.pathname === '/reflect') {
        const who = await verifyFirebase(String(req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
        if (!who || !ADMIN_EMAILS.includes(who.email)) return json(req, { error: 'unauthorized' }, 401);
        const ask = url.pathname === '/seteuk'
          ? `아래는 고등학교 통합사회 'AI활용탐구'(데이터 분석 · 8단계 문제해결학습)에서 한 학생이 남긴 탐구 기록이야. 이 기록만 근거로 학교생활기록부 '세부능력 및 특기사항' 문장을 써 줘.
- 450~500자(공백 포함), 한 문단, '~함.' '~임.'처럼 명사형으로 끝맺기, 주어 생략
- 탐구 주제, 정제 · 계산 · 시각화, AI의 결론을 데이터로 검증한 장면, 개념 연결, 해결안 · 실행물, 성찰 가운데 기록에 있는 것만 구체적으로
- 기록에 없는 활동 · 수상 · 대회 · 사교육 · 부모 직업은 쓰지 말고, 뛰어난 · 탁월한 같은 꾸밈말을 쓰지 마. 문장만 답해.
[탐구 기록]
${JSON.stringify(body.evidence || []).slice(0, 12000)}`
          : `아래는 한 교사가 고등학교 통합사회 'AI활용탐구' 수업(아이에답 '데이터 분석' 유형, 데이터 리터러시 향상을 위한 인공지능 융합 문제해결학습 수업 모형 8단계, 50분 개인 탐구)을 실천한 결과 통계와 학생 보고서 예시야. 아이에답 '수업 실천 성찰하기'에 낼 성찰문 초안을 써 줘.
- 900~1,200자, 교사 1인칭, 차분한 보고 문체
- 수업 의도(교정적 정의 · 자본주의 윤리 탐구, AI 활용 역량, 개별화와 생기부 연계) → 실제 운영 → 통계로 본 학생 반응(숫자 인용) → 잘된 점 → 어려웠던 점과 개선 방향 순서
- 통계와 예시에 없는 사실은 지어내지 말고, 교사가 채울 부분은 [ ] 괄호로 남겨 둬. 글만 답해.
[통계 · 예시]
${JSON.stringify(body).slice(0, 12000)}`;
        const res = await client.beta.messages.create({ model: MODEL, max_tokens: 8000, output_config: { effort: 'medium' }, ...FALLBACK, messages: [{ role: 'user', content: ask }] });
        if (res.stop_reason === 'refusal') return json(req, { error: 'AI가 초안을 쓰지 못했어요' }, 502);
        return json(req, { text: res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim() });
      }
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return json(req, { error: 'AI가 바빠요. 잠시 뒤에 다시 눌러 주세요' }, 429);
      if (e instanceof Anthropic.APIError) { console.log('Claude 오류', e.status, String(e.message).slice(0, 300)); return json(req, { error: 'AI 서버 오류' }, 502); }
      console.log('오류', String(e).slice(0, 300)); return json(req, { error: '서버 오류' }, 500);
    }
    return json(req, { error: 'not found' }, 404);
  },
};

// ───────── Firestore 우회로 (/fs) ─────────
// 웹 화면의 공개 API 키(datalab/topics.js 와 같음)로 Firestore REST 에 그대로 전해요
const FS_KEY = 'AIzaSyDEZIz_7wQcWQWO6v_1C5vhoYzAryqo59k';
const FS_DOCS = 'projects/sonagi-1cc00/databases/(default)/documents';
async function fsProxy(req, b) {
  const docOk = (p) => /^(datalab_members\/[0-9a-f]{64}|datalab_ids\/[0-9]{5})$/.test(String(p || ''));
  let target, init;
  if (b.op === 'get' && docOk(b.path)) { target = `${FS_DOCS}/${b.path}`; init = { method: 'GET' }; }
  else if (b.op === 'update' && docOk(b.path) && /^datalab_members\//.test(b.path) && Array.isArray(b.mask) && b.mask.length <= 40 && b.mask.every((k) => /^[A-Za-z0-9_.`]{1,80}$/.test(k))) {
    target = `${FS_DOCS}/${b.path}?${b.mask.map((k) => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&')}&currentDocument.exists=true`;
    init = { method: 'PATCH', body: JSON.stringify({ fields: b.fields || {} }) };
  } else if (b.op === 'create' && Array.isArray(b.writes) && b.writes.length <= 2 && b.writes.every((w) => docOk(w.path))) {
    target = `${FS_DOCS}:commit`;
    init = { method: 'POST', body: JSON.stringify({ writes: b.writes.map((w) => ({ update: { name: `${FS_DOCS}/${w.path}`, fields: w.fields || {} }, currentDocument: { exists: false } })) }) };
  } else return json(req, { error: { status: 'INVALID_ARGUMENT', message: 'bad request' } }, 400);
  const r = await fetch(`https://firestore.googleapis.com/v1/${target}${target.includes('?') ? '&' : '?'}key=${FS_KEY}`, { ...init, headers: { 'Content-Type': 'application/json' } });
  const text = await r.text();
  return new Response(text, { status: r.status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(req) } });
}

// ───────── 하루 사용 횟수 (Durable Object 하나) ─────────
export class Quota extends DurableObject {
  async fetch(req) {
    const u = new URL(req.url), day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const key = `${day}:${u.searchParams.get('k')}:${u.searchParams.get('who')}`, n = (await this.ctx.storage.get(key)) || 0, max = +u.searchParams.get('max') || 30;
    if (n >= max) return Response.json({ ok: false, n });
    await this.ctx.storage.put(key, n + 1);
    if (Math.random() < 0.02) { const all = await this.ctx.storage.list(); for (const k of all.keys()) if (!k.startsWith(day)) await this.ctx.storage.delete(k); }   // 지난 날짜 정리
    return Response.json({ ok: true, n: n + 1 });
  }
}

// ───────── 관리자 구글(Firebase, 소나기 프로젝트) 로그인 검사 ─────────
const FIREBASE_PROJECT = 'sonagi-1cc00';
const ADMIN_EMAILS = ['bellachord@gmail.com', 'anstjsdud@sen.go.kr'];
let googleKeys = { at: 0, keys: [] };
async function firebaseKeys() {
  if (Date.now() - googleKeys.at < 3600e3 && googleKeys.keys.length) return googleKeys.keys;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  googleKeys = { at: Date.now(), keys: (await r.json()).keys || [] };
  return googleKeys.keys;
}
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
async function verifyFirebase(token) {
  try {
    const [h, p, sgn] = token.split('.'); if (!sgn) return null;
    const head = JSON.parse(new TextDecoder().decode(b64u(h))), pay = JSON.parse(new TextDecoder().decode(b64u(p)));
    if (head.alg !== 'RS256') return null;
    const jwk = (await firebaseKeys()).find((k) => k.kid === head.kid); if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(sgn), new TextEncoder().encode(`${h}.${p}`));
    const now = Date.now() / 1000;
    if (!ok || pay.aud !== FIREBASE_PROJECT || pay.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT}`) return null;
    if (!(pay.exp > now) || !(pay.iat <= now + 60) || !pay.sub || !pay.email || pay.email_verified !== true) return null;
    return { email: String(pay.email).toLowerCase() };
  } catch { return null; }
}
