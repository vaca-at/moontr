// 🌿 마음한편 AI 'AI 마음 티쳐' (2026-11-23) — moontr-auth 서버에 붙은 주소 POST /maum
//  앱(아이폰 마음한편)이 로그인 표(Firebase ID 토큰)와 함께 보내요. 로그인 표가 진짜인지 worker.js 의 lookup 으로 확인해요.
//  할 일(task): today 오늘의 문장 · review 이번 주 총평 · translate 마음 번역 · ask 물어보기 · talk 이야기 · ring 숨은 마음 도감 찾기
//           report_read 전문 검사 결과지 읽기(사진 · PDF → 척도 · 점수) · report_explain 검사 결과 쉽게 풀어 보기 (2026-11-25)
//  ⚠️ 결과지 사진 · PDF 도 읽기만 하고 저장하지 않아요. 이름 · 생년월일 · 학교 · 기관 담당자 이름은 돌려주지 않아요.
//  ⚠️ 적은 글은 답을 만드는 데만 쓰고 이 서버에 저장하지 않아요. 기록(console.log)에도 글을 남기지 않아요.
//  ⚠️ 위험한 말(죽고 싶다 · 자해 · 폭력)이 보이면 AI에 보내지 않고 { crisis: true } 로 바로 돌려줘요 → 앱이 도움 화면(109 · 1388 · 112)을 열어요.
//  하루 횟수: 한 사람(uid)마다 LIMIT 만큼 (Durable Object 'Quota')
//  📊 2026-11-25 관리자 숫자: 날마다 할 일별 횟수 · 쓴 사람 수 · 처음 쓴 사람 수 · 위험한 말이 보인 횟수만 세요 (글은 세지도 남기지도 않아요)
//  비밀값: ANTHROPIC_API_KEY  (이 폴더에서 npx wrangler@4 secret put ANTHROPIC_API_KEY)
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { DurableObject } from 'cloudflare:workers';

const MODEL = 'claude-opus-5-5';
// ask · talk(물어보기 · 이야기)는 2026-11-25 앱 · 웹에서 뺐어요. 예전 앱(1.0.1 까지)이 아직 부르니 남겨 두되 횟수를 줄였어요 — 모두 새 앱으로 바뀌면 지워요
const LIMIT = { today: 12, review: 6, translate: 25, ask: 8, talk: 15, ring: 25, report_read: 12, report_explain: 12, class_read: 10 };
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);
// 위험한 말 (앱 Safety.swift 와 같게, 띄어쓰기를 빼고 찾아요)
const RISK = ['죽고싶', '죽어버리', '죽을래', '죽고말', '죽는게나', '죽으면편', '자살', '자해', '사라지고싶', '없어지고싶', '살기싫', '살고싶지않',
  '끝내고싶', '끝내버리', '그만살', '뛰어내리', '목매', '손목', '약을모아', '약먹고', '유서', '다포기하고싶', '태어나지말', '때려', '맞았', '폭력', '학대', '성폭'];
const risky = (t) => { const x = String(t).replace(/\s+/g, ''); return RISK.some((w) => x.includes(w)); };

const MODE = {
  all: '누구나 쓰는 모드예요. 상대의 나이를 짐작하지 말고 담백하게 말해요.',
  student: '중고등학생이에요. 친한 언니 · 오빠처럼 다정하고 짧게, 공부 · 친구 · 가족 이야기에 맞춰요. 훈계하지 않아요.',
  parent: '아이를 키우는 부모예요. 지친 마음을 먼저 알아주고, 아이를 이해하는 시선을 함께 건네요. 부모를 탓하지 않아요.',
  worker: '일하는 어른이에요. 일 · 동료 · 상사 이야기에 맞춰 존중하는 말투로, 바로 해 볼 수 있는 작은 것 하나를 권해요.',
  teacher: '학교 선생님이에요. 학생 · 동료 교사 · 학부모 이야기에 맞춰, 선생님의 수고를 먼저 알아줘요.',
};

// 모든 요청이 함께 쓰는 지시문 (캐시해서 비용 · 시간을 줄여요)
const BASE = `너는 아이폰 앱 '마음한편'의 'AI 마음 티쳐'야. 너는 자격을 가진 교사 · 상담사 · 의사가 아니라 마음 돌봄을 돕는 AI야. 이름을 말할 때는 'AI 마음 티쳐'라고 해. 마음한편은 하루의 마음을 한 편의 문장으로 남기고, 몸으로 하는 마음근력(발바닥 느끼기 · 얼굴 풀기 · 목 · 어깨 풀기 · 1분 숨 고르기 · 손 얹고 숨 쉬기 등)을 하는 앱이야.
지켜야 할 것
- 반드시 한국어, 쉬운 말, 다정한 존댓말(~해요). 짧게. 이모지는 쓰지 마.
- 너는 상담사 · 의사가 아니야. 진단(우울증 · 불안장애 · ADHD 같은 병명)이나 약 이야기를 하지 마. 판단하거나 훈계하지 마.
- '자기 연민'이라는 말은 쓰지 마 ('나에게 다정하게'라고 해).
- 다른 사람 이야기를 들으면, 그 사람을 나쁘게 단정하지 말고 그 행동 밑에 있을 수 있는 마음을 '~일 수도 있어요'로 조심스럽게 짐작해.
- 할 수 있는 작은 행동 하나를 권할 때는 앱의 몸 활동(발바닥 느끼기 · 얼굴 풀기 · 목 · 어깨 풀기 · 1분 숨 고르기)을 먼저 떠올려.
- 사람 이름 · 학교 · 회사 같은 개인 정보가 보이면 되풀이하지 마.
- 글에 자해 · 자살 · 폭력 · 학대의 위험이 조금이라도 보이면 crisis 를 true 로 하고, 답에는 혼자 견디지 말라는 말과 109(24시간 자살예방상담) · 1388(청소년) · 112 를 안내해.`;

const Today = z.object({ weather: z.string(), body: z.string() });
const Review = z.object({ text: z.string() });
const Translate = z.object({ crisis: z.boolean(), feeling: z.string(), why: z.string(), tryThis: z.string() });
// 그 사람 이해하기 (2026-11-25 문쌤): 마음 분석 + 왜 그럴까요(T처럼, 나에게) + 해 볼 것(F처럼, 그 사람을 대하는 법)
const TranslateOther = z.object({ crisis: z.boolean(), feeling: z.string(), analysis: z.string(), why: z.string(), tryThis: z.string() });
// 모드마다 '그 사람'을 부르는 말
const TARGET = { teacher: '학생', parent: '아이', worker: '동료', student: '친구', all: '그 사람' };
const Reply = z.object({ crisis: z.boolean(), reply: z.string() });
// 전문 검사 결과지 (2026-11-25 문쌤: 아이 · 우리반이 받은 검사 결과를 올리고 AI 로 풀어 보기)
const Row = z.object({ group: z.string(), name: z.string(), score: z.string(), kind: z.string(), band: z.string(), note: z.string() });
const ReportRead = z.object({ ok: z.boolean(), title: z.string(), org: z.string(), date: z.string(), rows: z.array(Row), memo: z.string() });
const ReportExplain = z.object({ summary: z.string(), strengths: z.array(z.string()), watch: z.array(z.string()), home: z.array(z.string()), ask: z.array(z.string()) });
const READ_RULE = `너는 지금 심리 · 학습 · 발달 검사 결과지를 읽어 표로 옮기는 일을 해.
- 결과지에 적힌 글자 · 숫자만 옮겨. 없는 점수를 지어내지 마. 흐려서 안 읽히면 그 칸은 빈 글자("").
- ok: 검사 결과지가 맞으면 true, 아니면 false (그때 rows 는 빈 배열).
- title: 검사 이름 (예: "K-WISC-V", "종합 심리 검사", "CBCL 6-18"). 결과지에 적힌 대로.
- org: 검사한 곳의 종류만 (예: "상담센터", "병원", "학교 Wee클래스"). 기관 이름 · 담당자 이름은 쓰지 마.
- date: 검사 날짜 YYYY-MM-DD (모르면 "").
- rows: 척도마다 한 줄. group = 묶음(예: "지표", "내재화", 없으면 ""), name = 척도 이름, score = 점수 그대로(예: "112", "T 65", "85%ile"), kind = 점수 종류("지표점수" · "T점수" · "백분위" · "원점수" · "환산점수" 등), band = 결과지에 적힌 수준(예: "평균 상", "경계선", "임상 범위") 없으면 "", note = 결과지의 짧은 설명(30자 안) 없으면 "".
- memo: 결과지의 종합 소견을 두세 문장으로 줄여. 없으면 "".
- ⚠️ 아이 · 보호자 · 담당자 이름, 생년월일, 학교 이름, 주소, 전화는 어디에도 쓰지 마.`;
// 우리반 검사 결과지 (2026-11-26 문쌤: 담임 — 반 전체 결과지 사진 · PDF → 번호별 표). 이름은 받지도 돌려주지도 않아요
const ClassRow = z.object({ no: z.number().int(), values: z.array(z.string()), tags: z.array(z.string()), note: z.string() });
const ClassRead = z.object({ ok: z.boolean(), title: z.string(), date: z.string(), kind: z.string(), cols: z.array(z.string()), rows: z.array(ClassRow), summary: z.string() });
const CLASS_RULE = `너는 지금 학급 전체 검사 결과지(여러 학생이 한 표에)를 번호별 표로 옮기는 일을 해.
- ok: 학급 검사 결과지가 맞으면 true.
- title: 검사 이름 (예: "성격검사", "교과계열탐색검사"). date: 검사 날짜 YYYY-MM-DD (모르면 "").
- kind: 점수 표면 "scores", 학생마다 글(소견)이면 "notes".
- scores 일 때: cols = 점수 칸 이름들(예: "신경증(N)", "우울"), rows 마다 no = 학생 번호, values = cols 순서대로 점수 글자 그대로(빈 칸은 ""), tags = [], note = "".
- notes 일 때: cols = [], rows 마다 no = 번호, tags = 글에서 뽑은 핵심 순위(예: 적성에 맞는 전공계열 1~3순위, 각 12자 안), note = 소견 글을 그대로(학생 이름이 있으면 '학생'으로 바꿔서, 400자 안).
- ⚠️ 학생 이름은 어디에도 쓰지 마. 번호만 써. 결과가 비어 있는 학생도 번호와 빈 값으로 넣어.
- summary: 반 전체를 두세 문장으로 (예: 많이 나온 계열 · 높은 점수가 많은 칸의 수). 개별 학생 이름 · 번호를 꼽아 말하지 마. 진단이나 병명은 쓰지 마.`;
const Ring = z.object({ crisis: z.boolean(), no: z.number().int(), why: z.string(), report: z.array(z.string()) });

// 앱 숨은 마음 도감 (Rings.swift 의 RingDex.known 과 같은 번호)
const RINGS = `1 가시 갑옷형: 약한 마음을 들킬까 봐 먼저 가시를 세워요 (여려 보이지 않으려고 세게 굴어요)
2 깊은 몰입 피난형: 힘들면 좋아하는 일에 푹 빠져 충전해요
3 현실 점검형: 사실부터 따지고, 고칠 점을 먼저 말해요
4 다 퍼주는 형: 남을 먼저 챙기느라 내 마음은 뒤로 미뤄요
5 혼자 버티는 형: 도와 달라고 하기보다 혼자 지키는 게 편해요
6 순간 폭발형: 화가 확 올라왔다가 금방 개요
7 속으로 삭이는 형: 말보다 속으로 오래 곱씹어요
8 내 길 가는 형: 남의 눈보다 내 방향이 더 중요해요
9 미리 걱정형: 걱정이 많아 미리미리 준비해요
10 인정 충전형: 칭찬과 관심을 받으면 힘이 나요
11 결정 망설임형: 고르기 전에 오래, 깊이 고민해요
12 거리 두기형: 가까워지면 한 발 물러서서 숨을 골라요`;

/** POST /maum 처리. who = 확인된 사람 (worker.js 의 lookup 결과) */
export async function maum(req, env, body, who, json) {
  const task = clean(body.task, 20);
  if (!LIMIT[task]) return json(req, { error: '없는 할 일이에요' }, 400);
  // ⚠️ 위험한 말은 AI 키가 있든 없든 가장 먼저 살펴요 (2026-11-24: 키 확인보다 뒤에 있어 키가 없을 때 못 잡던 것 고침)
  const text = clean(body.text, 800);
  const q = env.QUOTA.get(env.QUOTA.idFromName('maum'));
  if (text && risky(text)) { await q.fetch('https://q/mark?k=crisis').catch(() => {}); return json(req, { crisis: true }); }
  if (!env.ANTHROPIC_API_KEY) return json(req, { error: 'AI 준비 중이에요', off: true }, 503);
  // 하루 횟수
  const ok = await q.fetch(`https://q/use?who=${encodeURIComponent(who.localId)}&k=${task}&max=${LIMIT[task]}`).then((r) => r.json());
  if (!ok.ok) return json(req, { error: '오늘 AI 마음 티쳐와 이야기할 수 있는 횟수를 다 썼어요. 내일 또 만나요', limit: true }, 429);

  const mode = MODE[body.mode] || MODE.all;
  // 요즘 많이 힘든 사람(앱이 care 로 알려 줘요): 활동 권유보다 마음을 먼저 알아주고 도움을 부드럽게
  const care = body.care === true ? '\n[요즘 상태] 최근 힘든 날이 많이 이어졌어요. 평소처럼 활동을 권하기보다 먼저 마음을 충분히 알아주고, 믿는 사람이나 전문 기관(109 · 1388 · 1577-0199)과 이야기해 보기를 부드럽게 권해. 재촉하거나 훈계하지 마.' : '';
  const system = [{ type: 'text', text: BASE, cache_control: { type: 'ephemeral' } }, { type: 'text', text: `[이 사람] ${mode}${care}` }];
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const ask = async (schema, content, max = 1500, effort = 'low') => {
    const res = await client.messages.parse({ model: MODEL, max_tokens: max, output_config: { effort, format: zodOutputFormat(schema) }, system, messages: [{ role: 'user', content }] });
    if (res.stop_reason === 'refusal' || !res.parsed_output) return null;
    return res.parsed_output;
  };
  // 기록 숫자만 받아요 (글은 받지 않아요): week = 최근 7일 기분 1~5 (0 = 기록 없음), moves = 이번 주 몸 활동 횟수, types = 테스트 결과 이름
  const stats = () => {
    const week = (Array.isArray(body.week) ? body.week : []).slice(0, 7).map((n) => Math.max(0, Math.min(5, +n || 0)));
    const types = (Array.isArray(body.types) ? body.types : []).slice(0, 4).map((s) => clean(s, 30)).filter(Boolean);
    return `최근 7일 기분(1 많이 힘듦 ~ 5 아주 좋음, 0 = 기록 없음, 마지막이 오늘): ${week.join(', ') || '없음'}\n이번 주 몸 활동 · 숨 고르기: ${Math.max(0, +body.moves || 0)}번\n연속 출석: ${Math.max(0, +body.streak || 0)}일\n테스트로 알아본 모습: ${types.join(' · ') || '아직 없음'}`;
  };

  try {
    if (task === 'today') {
      const p = await ask(Today, `${stats()}\n\n홈 맨 위에 보일 '오늘의 마음 날씨' 문장을 써 줘.\nweather: 날씨에 빗댄 두 줄, 줄마다 4~9글자, 두 줄 사이는 \\n (예: "구름 사이로\\n해가 비쳐요"). 기록이 없으면 첫 장을 펼치는 느낌으로.\nbody: 이 사람에게 건네는 한두 문장(60자 안). 숫자를 기계적으로 읊지 말고, 오늘 해 볼 작은 몸 활동 하나를 자연스럽게 권해. 오늘 새로고침할 때마다 다른 말이면 좋아 (변화 번호 ${+body.seed || 0}).`, 800);
      return p ? json(req, { weather: clean(p.weather, 40), body: clean(p.body, 120) }) : json(req, { error: '문장을 만들지 못했어요' }, 502);
    }
    if (task === 'review') {
      const p = await ask(Review, `${stats()}\n\n'이번 주 총평'을 3~4문장(160자 안)으로 써 줘. 잘한 것 하나를 꼭 찾아 칭찬하고, 힘든 날이 있었으면 먼저 알아주고, 다음 주에 해 볼 작은 것 하나로 끝내.`, 900);
      return p ? json(req, { text: clean(p.text, 260) }) : json(req, { error: '총평을 만들지 못했어요' }, 502);
    }
    if (task === 'translate') {
      if (text.length < 4) return json(req, { error: '조금 더 적어 주세요' }, 400);
      if (body.other) {
        // 2026-11-25 문쌤: "나에게는 T처럼 분석, 학생을 대하는 부분은 F처럼. 선생님 잘하고 계세요 같은 말 · 선생님 1분 숨 고르기는 빼 줘"
        const t = TARGET[body.mode] || TARGET.all;
        const p = await ask(TranslateOther, `[궁금한 ${t}의 말 · 행동]\n${text}\n\n이 ${t}을(를) 이해하도록 분석해 줘.
이번 답에서 꼭 지킬 것
- 글쓴이를 칭찬 · 위로 · 격려하지 마 ("잘하고 계세요", "애쓰고 계세요", "충분히 좋은 ○○예요" 같은 말 쓰지 마).
- 글쓴이에게 숨 고르기 · 몸 활동 · 쉬기를 권하지 마. 모든 내용은 ${t}에 대한 것이야.
- 단정하지 말고 '~일 수 있어요'. 진단 · 병명은 쓰지 마.
feeling: ${t}의 속마음을 ${t} 목소리로 짧은 한 문장 (예: "사실은 나도 잘하고 싶어서 그래").
analysis: 그 ${t}의 마음 분석 — 이 말 · 행동으로 볼 때 어떤 성격 · 기질 · 마음 습관을 가졌을 수 있는지 2~3문장. 성향을 구체적으로 짚어 줘 (예: 인정받고 싶은 마음이 큰 편, 낯선 상황에서 긴장이 빨리 오르는 편).
why: 왜 그럴까요 — T처럼 써. 감정 표현 · 공감 말 없이, 원인과 흐름을 논리적으로 2~3문장 (무엇이 → 어떤 마음을 → 이 행동으로). 사실과 가능성을 나눠서.
tryThis: 해 볼 것 — F처럼 써. ${t}의 마음을 먼저 받아 주는 따뜻한 대하기 2~3가지를 한 문장씩, 그중 하나는 ${t}에게 실제로 건넬 말 한마디(따옴표). 줄마다 \n 으로 나눠.`, 1800);
        return p ? json(req, { crisis: p.crisis, feeling: clean(p.feeling, 120), analysis: clean(p.analysis, 400), why: clean(p.why, 400), tryThis: clean(p.tryThis, 500) }) : json(req, { error: '풀이를 만들지 못했어요' }, 502);
      }
      const p = await ask(Translate, `[내 마음]\n${text}\n\n이 마음을 번역해 줘.\nfeeling: 이 글 밑에 있는 진짜 마음을 '나'의 목소리로 한 문장(예: "나는 사실 인정받고 싶었어").\nwhy: 그 마음을 알아주는 2~3문장.\ntryThis: 지금 할 수 있는 작은 것 하나 (몸 활동이나 나에게 하는 한마디).`, 1200);
      return p ? json(req, { crisis: p.crisis, feeling: clean(p.feeling, 120), why: clean(p.why, 300), tryThis: clean(p.tryThis, 160) }) : json(req, { error: '풀이를 만들지 못했어요' }, 502);
    }
    if (task === 'ask' || task === 'talk') {
      if (text.length < 2) return json(req, { error: '내용을 적어 주세요' }, 400);
      const hist = (Array.isArray(body.history) ? body.history : []).slice(-6).map((h) => `${h.me ? '나' : 'AI 마음 티쳐'}: ${clean(h.t, 400)}`).join('\n');
      const p = await ask(Reply, task === 'ask'
        ? `[물음]\n${text}\n\n마음에 대한 물음에 4~6문장(300자 안)으로 답해 줘. 쉬운 말로, 왜 그런지 한두 문장 + 해 볼 것 두 가지(하나는 몸 활동).`
        : `${hist ? `[지금까지 이야기]\n${hist}\n\n` : ''}[나]\n${text}\n\n잘 들어 주는 친구처럼 2~4문장(200자 안)으로 답해. 먼저 마음을 알아주고, 필요하면 부드러운 질문 하나로 끝내. 해결책을 서두르지 마.`, 1200);
      return p ? json(req, { crisis: p.crisis, reply: clean(p.reply, 500) }) : json(req, { error: '답을 만들지 못했어요' }, 502);
    }
    if (task === 'report_read') {
      // files = [{ type: 'image/jpeg' | 'image/png' | 'application/pdf', data: base64 }] 최대 12장 (2026-11-26 문쌤: 결과지 9장)
      const files = (Array.isArray(body.files) ? body.files : []).slice(0, 12).filter((f) => f && typeof f.data === 'string' && f.data.length < 7_000_000);
      if (!files.length) return json(req, { error: '결과지 사진이나 PDF 를 골라 주세요' }, 400);
      const parts = files.map((f) => f.type === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } }
        : { type: 'image', source: { type: 'base64', media_type: f.type === 'image/png' ? 'image/png' : 'image/jpeg', data: f.data } });
      const p = await ask(ReportRead, [...parts, { type: 'text', text: `${READ_RULE}\n\n위 결과지(${files.length}장)를 읽어 표로 옮겨 줘.` }], 6000, 'medium');
      if (!p) return json(req, { error: '결과지를 읽지 못했어요' }, 502);
      if (!p.ok) return json(req, { error: '검사 결과지가 아닌 것 같아요. 점수가 보이게 다시 찍어 주세요' }, 400);
      return json(req, { title: clean(p.title, 60), org: clean(p.org, 30), date: clean(p.date, 10), memo: clean(p.memo, 400),
        rows: p.rows.slice(0, 80).map((r) => ({ group: clean(r.group, 30), name: clean(r.name, 40), score: clean(r.score, 20), kind: clean(r.kind, 20), band: clean(r.band, 30), note: clean(r.note, 60) })) });
    }
    if (task === 'class_read') {
      // files = 사진 · PDF (최대 12장) 또는 sheet = 이름을 지운 글 (글자 PDF 는 앱이 먼저 글을 뽑아 이름을 지워 보내요)
      const files = (Array.isArray(body.files) ? body.files : []).slice(0, 12).filter((f) => f && typeof f.data === 'string' && f.data.length < 9_000_000);
      const sheet = String(body.sheet || '').slice(0, 60000);
      if (!files.length && sheet.length < 20) return json(req, { error: '결과지 사진이나 PDF 를 골라 주세요' }, 400);
      const parts = files.map((f) => f.type === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } }
        : { type: 'image', source: { type: 'base64', media_type: f.type === 'image/png' ? 'image/png' : 'image/jpeg', data: f.data } });
      if (sheet) parts.push({ type: 'text', text: `[결과지 글 · 이름은 지워져 있어요]\n${sheet}` });
      parts.push({ type: 'text', text: `${CLASS_RULE}\n\n위 결과지를 번호별 표로 옮겨 줘.` });
      // 학생이 많아 답이 길어요 → 흘려 받기(stream)로 끝까지 받아요
      const stream = client.messages.stream({ model: MODEL, max_tokens: 24000, output_config: { effort: 'medium', format: zodOutputFormat(ClassRead) }, system, messages: [{ role: 'user', content: parts }] });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') return json(req, { error: '결과지를 읽지 못했어요' }, 502);
      const txt = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      let p; try { p = ClassRead.parse(JSON.parse(txt)); } catch { return json(req, { error: msg.stop_reason === 'max_tokens' ? '결과지가 너무 길어요. 나눠서 올려 주세요' : '결과지를 읽지 못했어요' }, 502); }
      if (!p.ok) return json(req, { error: '학급 검사 결과지가 아닌 것 같아요' }, 400);
      return json(req, { title: clean(p.title, 60), date: clean(p.date, 10), kind: p.kind === 'notes' ? 'notes' : 'scores', summary: clean(p.summary, 400),
        cols: p.cols.slice(0, 20).map((c) => clean(c, 20)),
        rows: p.rows.slice(0, 60).map((r) => ({ no: Math.max(0, r.no | 0), values: r.values.slice(0, 20).map((v) => clean(v, 12)), tags: r.tags.slice(0, 5).map((t) => clean(t, 20)), note: clean(r.note, 500) })) });
    }
    if (task === 'report_explain') {
      // 앱이 고친 표를 보내요 (이름 없이): who = '아들 · 초4' 처럼 관계 · 학년만
      const r = body.report || {};
      const rows = (Array.isArray(r.rows) ? r.rows : []).slice(0, 80).map((x) => `${clean(x.group, 30) ? clean(x.group, 30) + ' › ' : ''}${clean(x.name, 40)}: ${clean(x.score, 20)} ${clean(x.kind, 20)}${clean(x.band, 30) ? ' (' + clean(x.band, 30) + ')' : ''}${clean(x.note, 60) ? ' — ' + clean(x.note, 60) : ''}`);
      if (!rows.length) return json(req, { error: '점수가 없어요' }, 400);
      const before = (Array.isArray(r.before) ? r.before : []).slice(0, 80).map((x) => `${clean(x.name, 40)}: ${clean(x.score, 20)}`);
      const p = await ask(ReportExplain, `[검사] ${clean(r.title, 60)} · ${clean(r.date, 10)} · ${clean(r.org, 30)}\n[누구] ${clean(r.who, 30) || '나'}\n[점수]\n${rows.join('\n')}${clean(r.memo, 400) ? '\n[결과지 소견 요약] ' + clean(r.memo, 400) : ''}${before.length ? '\n[지난번 같은 검사 점수]\n' + before.join('\n') : ''}

이 검사 결과를 보호자 · 선생님이 이해하기 쉽게 풀어 줘. 지켜야 할 것:
- 결과지에 적힌 척도 이름 · 수준은 그대로 써도 되지만, 새로 진단하거나 병명을 붙이지 마. 약 이야기는 하지 마.
- 점수 종류를 쉬운 말로 (예: 지표점수 100 이 또래 평균, T점수 50 이 평균이고 높을수록 그 어려움이 큰 편 — 척도마다 다르면 결과지 기준을 따라).
- 숫자 하나로 아이를 단정하지 말고, 강점을 먼저.
summary: 전체를 3~4문장으로.
strengths: 잘하는 점 · 힘이 되는 점 2~4개 (한 문장씩).
watch: 살펴볼 점 2~4개 (한 문장씩, 걱정을 키우지 않게).${before.length ? ' 지난번보다 달라진 점이 있으면 여기에 하나 넣어.' : ''}
home: 집 · 교실에서 해 볼 수 있는 작은 것 3개.
ask: 검사한 선생님 · 기관에 물어보면 좋을 질문 2~3개.`, 2500, 'medium');
      if (!p) return json(req, { error: '풀이를 만들지 못했어요' }, 502);
      const L = (a, n) => (Array.isArray(a) ? a : []).slice(0, 4).map((s) => clean(s, n)).filter(Boolean);
      return json(req, { summary: clean(p.summary, 500), strengths: L(p.strengths, 160), watch: L(p.watch, 160), home: L(p.home, 160), ask: L(p.ask, 160) });
    }
    if (task === 'ring') {
      if (text.length < 6) return json(req, { error: '조금 더 적어 주세요' }, 400);
      const p = await ask(Ring, `[숨은 마음 도감]\n${RINGS}\n\n[누구 이야기] ${clean(body.who, 20) || '주변 사람'}\n[이야기]\n${text}\n\n이 이야기 속 사람에게 가장 가까운 숨은 마음 번호(no, 1~12)를 하나 골라. 딱 맞는 게 없으면 가장 가까운 것.\nwhy: 왜 그 숨은 마음인지 한 문장. 답에는 '고리'라는 말을 쓰지 마.\nreport: 6칸, 칸마다 1~2문장 — ① 그 사람은 왜 그럴까 ② 그때 나는 이렇게 반응하기 쉬워요 ③ 이렇게 대응해 보세요(쓸 말 하나 포함) ④ 기대와 다를 때 마음 편해지기 ⑤ 앞으로 이런 사람을 만나면 ⑥ 나에게 해 주는 한마디`, 1600);
      if (!p) return json(req, { error: '숨은 마음을 찾지 못했어요' }, 502);
      const no = Math.min(12, Math.max(1, p.no | 0));
      return json(req, { crisis: p.crisis, no, why: clean(p.why, 160), report: p.report.slice(0, 6).map((s) => clean(s, 200)) });
    }
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json(req, { error: 'AI 마음 티쳐가 바빠요. 잠시 뒤에 다시 해 주세요' }, 429);
    if (e instanceof Anthropic.APIError) { console.log('maum Claude 오류', e.status); return json(req, { error: 'AI 서버 오류' }, 502); }
    console.log('maum 오류', String(e && e.message).slice(0, 120));
    return json(req, { error: '잠시 뒤에 다시 해 주세요' }, 500);
  }
  return json(req, { error: '없는 할 일이에요' }, 400);
}

/** 하루 횟수 세기 (한국 날짜 기준) + 관리자 숫자
 *  열쇠 모양: 'YYYY-MM-DD:할일:uid' = 오늘 그 사람 횟수 (지난 날짜는 가끔 정리)
 *            'seen:YYYY-MM-DD:uid' = 오늘 쓴 사람 (지난 날짜는 정리) · 'u:uid' = 한 번이라도 쓴 사람
 *            's:YYYY-MM-DD:이름' = 그날 숫자 (할일별 횟수 · users · new · crisis), 'total:users' = 지금까지 쓴 사람 — 이 둘은 지우지 않아요 */
export class Quota extends DurableObject {
  async add(key, by = 1) { const n = ((await this.ctx.storage.get(key)) || 0) + by; await this.ctx.storage.put(key, n); return n; }
  async fetch(req) {
    const u = new URL(req.url), day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), st = this.ctx.storage;
    if (u.pathname === '/mark') { await this.add(`s:${day}:${u.searchParams.get('k')}`); return Response.json({ ok: true }); }
    if (u.pathname === '/stats') {
      const days = {}, all = await st.list({ prefix: 's:' });
      for (const [k, v] of all) { const [, d, name] = k.split(':'); (days[d] = days[d] || {})[name] = v; }
      return Response.json({ days, total: (await st.get('total:users')) || 0 });
    }
    const who = u.searchParams.get('who'), k = u.searchParams.get('k');
    const key = `${day}:${k}:${who}`, n = (await st.get(key)) || 0, max = +u.searchParams.get('max') || 20;
    if (n >= max) return Response.json({ ok: false, n });
    await st.put(key, n + 1);
    // 관리자 숫자 (uid 는 셀 때만 쓰고 밖으로 내보내지 않아요)
    await this.add(`s:${day}:${k}`);
    if (!(await st.get(`seen:${day}:${who}`))) { await st.put(`seen:${day}:${who}`, 1); await this.add(`s:${day}:users`); }
    if (!(await st.get(`u:${who}`))) { await st.put(`u:${who}`, day); await this.add(`s:${day}:new`); await this.add('total:users'); }
    if (Math.random() < 0.02) {   // 지난 날짜 하루 횟수 · 오늘 쓴 사람 표만 정리 (숫자 s: · u: · total: 은 그대로)
      const old = [...(await st.list()).keys()];
      for (const x of old) if ((/^\d{4}-\d\d-\d\d:/.test(x) && !x.startsWith(day)) || (x.startsWith('seen:') && !x.startsWith(`seen:${day}`))) await st.delete(x);
    }
    return Response.json({ ok: true, n: n + 1 });
  }
}
