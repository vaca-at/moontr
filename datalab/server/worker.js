// 🤖 통합사회 데이터 실험실 AI 서버 (moontr.site/datalab) — Cloudflare Worker + Anthropic Claude
//  학생: POST /review  반박 글을 세 기준(수치 인용 · 다른 원인 · 윤리적 근거)으로 검토
//        POST /partner 탐구 파트너: 답 대신 생각할 질문 하나
//  선생님(관리자 구글 로그인 표 확인): POST /seteuk 세특 초안 · POST /reflect 수업 실천 성찰문 초안
//        POST /report 일괄 출력용 학생 한 명: 잘한 점 · 격려(학생에게) · 예상 세특 (2026-11-17)
//        POST /blog   ✍️ 블로그 글쓰기 (moontr.site/blog, 관리자만): 연수 후기 · 개발 일기 글 쓰기 · 고치기 (2026-11-22)
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
  reflect: z.string(),
  cheer: z.string(),
  seteuk: z.string(),
});

// ✍️ 블로그 글쓰기 (moontr.site/blog, 2026-11-22): 관리자 한 사람용. 연수 후기 · 개발 일기(앱 홍보)
// 본문 = 네이버 블로그 단락(블록) 순서 그대로: quote 인용구(부제목) · text 본문(가운데 정렬, 줄바꿈 그대로) · photo 사진 자리(v = 사진 번호) ·
//        sticker 스티커 자리 · link 링크 카드(v = 주소) · table 표(v = 줄바꿈으로 칸) · line 구분선 · summary ━━━ 요약 상자
const BlogPost = z.object({
  titles: z.array(z.string()),   // 제목 후보 3개
  blocks: z.array(z.object({ t: z.enum(['quote', 'text', 'photo', 'sticker', 'link', 'table', 'line', 'summary']), v: z.string() })),
  tags: z.array(z.string()),     // 해시태그 (# 없이)
  insta: z.string(),             // 인스타 캡션
  threads: z.string(),           // 스레드 짧은 글
  checks: z.array(z.string()),   // 올리기 전 확인할 것 (개인정보 · 사실 확인)
});
// 문선생 블로그(blog.naver.com/moontools) 글 7편을 읽고 뽑은 형식 (2026-11-22). 바꾸려면 blog/README.md 의 '형식' 도 함께
const BLOG_BASE = `너는 '문선생'(고등학교 윤리 · 통합사회 교사, 바이브코딩으로 교육용 웹앱 · 앱을 만드는 선생님)의 네이버 블로그 글을 대신 써 주는 도우미야.
선생님이 준 재료(메모 · 사진 · 커밋 기록)만 근거로, 선생님이 직접 쓴 것처럼 아래 형식 그대로 써.

[선생님 블로그 형식]
1. 제목: 검색이 잘 되는 긴 제목. 예) "교사 시간표 관리 앱 추천! 내 하루가 게임처럼 움직이는 데스크탑 '교무실 타이쿤(TEACHER TYCOON)' AI 시간표 자동 입력 무료 기능", "아이아이노트 첫 앱 출시 기록 : 우리 가족 일기장이 플레이스토어에 올라갔어요", "교사 바이브코딩 입문 매뉴얼 1편 : 웹앱 만들기 시작편". 앱 이름은 '한글(영문)'으로.
2. 첫머리: sticker 블록 → text 블록 "안녕하세요, 문선생입니다 :)" 또는 "안녕하세요! 문선생입니다!" 다음 줄부터 2~4줄로 무엇을 소개하는지. 앱 소개 글은 summary 블록(요약 상자: 한 줄 소개 2~3줄, '웹: 주소', '앱: 출시 상태')을 첫머리 바로 아래에 넣어.
3. 부제목: quote 블록(블로그 인용구)으로, 짧게, 질문하거나 말 거는 투. 예) "○○은 어떤 앱인가요?", "이 앱을 만든 이유", "이런 마음으로 만들었어요", "시작하는 방법", "주요 기능", "이 앱의 특징", "시간 순으로 정리한 개발 일정", "숫자로 본 개발 일지", "만들면서 기억에 남는 일들", "앞으로 이렇게 하고 싶어요", "스크린샷 후기 공유".
4. 본문 text 블록: 블로그에서 가운데 정렬로 보이니까 한 줄에 한 구절(15~28자)씩 짧게 줄을 바꿔(\\n). 생각이 바뀌면 빈 줄 하나. 목록은 ① ② ③ 또는 ■ 소항목, 그 아래 '- ' 또는 '· ' 줄. 날짜별 일정 · 항목 목록은 table 블록(줄마다 한 칸).
5. 말투: 다정한 존댓말 '~해요', '~했어요!', '~인데요!', '~더라고요!' 느낌표를 자연스럽게. 이모지는 글 전체에 1~3개(💡 🎂 📓 😃 정도). 자신은 '저' 또는 '문선생', 읽는 사람은 '선생님들'.
6. 사진: photo 블록(v = 사진 번호 '1' '2'…)을 그 사진과 맞는 부제목 바로 아래나 설명 문단 옆에. 받은 사진은 모두 한 번씩 써.
7. 끝: 써 보라는 권유("지금 바로 써 보세요 → 주소" 같은) → 앱 주소가 있으면 link 블록 → 댓글로 의견 부탁 → 짧은 인사("긴 글 읽어주셔서 감사합니당", "오늘도 힘내세요!" 같은) → sticker 블록. 해시태그는 tags 로만 (본문에 쓰지 마).

[지켜야 할 것]
- 재료에 없는 사실(숫자, 날짜, 사람 이름, 기관, 수상, 성과)을 지어내지 마. 모르면 [ ] 괄호로 비워 둬.
- 학생 이름 · 학교 안 개인정보는 쓰지 마. 연수 강사 이름은 재료에 있어도 '강사님'으로.
- 광고처럼 들뜨지 말고, 선생님이 직접 겪은 이야기처럼 솔직하게. 검색 낱말은 제목과 첫머리에 자연스럽게.`;

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
- praise: 학생에게 하는 칭찬 5~7문장. 존댓말(~했어요). 기록에 있는 구체적인 장면(직접 계산한 숫자, AI 결론을 반박한 근거, 사상가 연결, 해결안, 실행물, 고른 규칙 등)을 두세 가지 이상 짚어서, 그것이 왜 좋은 탐구인지까지 말해. 학생이 쓴 표현을 짧게 따옴표로 인용해도 좋아. 꾸밈말(대단해요, 훌륭해요 같은 말만 있는 칭찬) 대신 무엇을 잘했는지를 말해.
- reflect: 학생이 '탐구를 마치며'(처음 판단과 지금 판단 비교) · 'AI 활용 성찰'을 썼거나 갤러리에 공유했으면, 그 성찰에 대한 선생님의 코멘트 4~6문장. 처음 판단에서 무엇이 바뀌었거나 지켜졌는지, 그 까닭이 데이터 · 사상가와 어떻게 이어지는지, AI를 확인하며 얻은 태도를 구체적으로 짚고 의미를 말해 줘. 공유했다면 친구들과 나눈 것도 짚어 줘. 두 칸 모두 비어 있고 공유도 안 했으면 빈 문자열("").
- cheer: 다음 탐구를 위한 격려 3~4문장. 아직 못 한 단계나 더 키울 점 한두 가지를 어떻게 하면 되는지까지 부드럽게, 할 수 있다는 응원과 함께. 꾸짖는 말투 금지.
- praise · reflect · cheer 는 '잘한 점:' '다음에는' 같은 머리말 없이 바로 내용으로 시작해 (화면에 머리말이 따로 붙어요). 학생 이름 · 학번은 쓰지 마.
- seteuk: 학교생활기록부 '세부능력 및 특기사항' 초안 (학생에게도 'AI 세특 초안'으로 보여 줘요). 나이스 한도 1,500바이트보다 여유 있게 1,200~1,350바이트(한글은 한 글자 3바이트 · 띄어쓰기 1바이트, 대략 공백 포함 410~450자), 1,400바이트는 절대 넘기지 마. 한 문단, '~함.' '~임.' 명사형 끝맺음, 주어 생략, 이름 · 학번 없이. 기록에 있는 활동만(없는 활동 · 수상 · 대회 · 사교육 · 부모 직업 금지), 뛰어난 · 탁월한 같은 꾸밈말 금지. 기록이 적으면 있는 만큼만 짧게 써.
[탐구 기록]
${JSON.stringify(body.evidence || []).slice(0, 12000)}` }],
        });
        if (res.stop_reason === 'refusal' || !res.parsed_output) return json(req, { error: 'AI가 이 학생 글을 쓰지 못했어요' }, 502);
        const p = res.parsed_output;
        return json(req, { praise: p.praise.slice(0, 1400), reflect: p.reflect.slice(0, 1000), cheer: p.cheer.slice(0, 800), seteuk: p.seteuk.slice(0, 900) });
      }
      // ── ✍️ 블로그 글쓰기 (관리자만): op 'write' = 재료로 새 글 · 'revise' = 지금 글을 부탁대로 고치기 ──
      if (url.pathname === '/blog') {
        const who = await verifyFirebase(String(req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
        if (!who || !ADMIN_EMAILS.includes(who.email)) return json(req, { error: 'unauthorized' }, 401);
        const f = body.fields || {}, F = (k, n = 1500) => clean(f[k], n);
        const tone = body.tone === 'plain' ? "담백한 반말 일기체('~했다', '~이다')" : "다정한 존댓말('~했어요', '~이에요')";
        const len = { short: '본문 공백 포함 700~1,000자', mid: '본문 공백 포함 1,300~1,800자', long: '본문 공백 포함 2,300~3,000자' }[body.length] || '본문 공백 포함 1,300~1,800자';
        const photos = (Array.isArray(body.photos) ? body.photos : []).slice(0, 8).filter((p) => /^image\/(jpeg|png|webp)$/.test(p.type) && typeof p.data === 'string' && p.data.length < 2_000_000);
        const content = [];
        photos.forEach((p, i) => { content.push({ type: 'text', text: `[사진 ${i + 1}]${clean(p.note, 200) ? ' 선생님 설명: ' + clean(p.note, 200) : ''}` }); content.push({ type: 'image', source: { type: 'base64', media_type: p.type, data: p.data } }); });
        const out = `답 형식: titles 에 제목 후보 3개(선생님 제목처럼 길게), blocks 에 본문 블록을 위에서 아래 순서대로, tags 에 해시태그 8~12개(# 없이 낱말만, 붙여 쓰기 예: 교사앱), insta 에 인스타 캡션(5~8줄, 해시태그 없이), threads 에 스레드 글(300자 안, 첫 줄이 눈에 띄게), checks 에 올리기 전에 선생님이 확인할 것(사진 속 학생 얼굴 · 이름표, [ ]로 비운 곳, 확인이 필요한 사실) 1~5개.`;
        let ask;
        if (body.op === 'revise') {
          const d = body.draft || {};
          ask = `아래는 지금 블로그 글이야. 선생님 부탁대로만 고치고, 부탁하지 않은 부분은 그대로 둬. 고친 결과 전체를 같은 형식으로 돌려줘.
[선생님 부탁] ${clean(body.ask, 500)}
[지금 글]
${JSON.stringify({ titles: d.titles, blocks: (Array.isArray(d.blocks) ? d.blocks : []).slice(0, 80), tags: d.tags, insta: clean(d.insta, 1500), threads: clean(d.threads, 800) }).slice(0, 16000)}
${out}`;
        } else if (body.kind === 'devlog' || body.kind === 'promo') {
          const commits = (Array.isArray(body.commits) ? body.commits : []).slice(0, 40).map((c) => '- ' + clean(c, 400)).join('\n');
          ask = (body.kind === 'promo'
            ? `'앱 소개(홍보)' 블로그 글을 써 줘. 문체: ${tone}. 길이: ${len}.
선생님 예전 앱 소개 글 짜임: 제목("○○ 추천! … '앱(영문)' … 무료 기능") → 스티커 → 인사 · 소개 2~4줄 → summary 요약 상자 → 사진 → 부제목 "○○은 어떤 앱인가요?" → "이 앱을 만든 이유" → "시작하는 방법"(① ② ③) → "주요 기능"(■ 항목과 '- ' 줄) → "이 앱의 특징"(① ② ③ ④, 개인정보 이야기가 재료에 있으면 넣기) → 출시 소식이 있으면 표 → "지금 바로 써 보세요 → 주소" → link → 스티커.`
            : `'개발 일기(출시 · 제작 기록)' 블로그 글을 써 줘. 문체: ${tone}. 길이: ${len}.
선생님 예전 개발 기록 글 짜임: 제목("○○ 첫 앱 출시 기록 : 부제" 또는 "내가 만든 ○○ 제작 후기") → 스티커 → 인사 · 무엇을 만들었는지 2~4줄 → 주소 또는 link → 부제목 "○○는 어떤 앱인가요?" → "시간 순으로 정리한 개발 일정"(table: '날짜  한 일' 줄들, 커밋 기록에서 날짜별로 묶기) → "숫자로 본 개발 일지"(재료에 숫자가 있을 때만: 큰 숫자 한 줄 + '· 설명' 한 줄씩) → "만들면서 기억에 남는 일들"(1. 2. 3.) → "앞으로 이렇게 하고 싶어요"('· ' 줄) → 댓글 부탁 · 인사 → 스티커.`) + `
커밋 기록은 개발 용어 그대로 옮기지 말고, 쓰는 사람이 느낄 변화로 쉽게 풀어 써. 앱 주소는 본문에 한 번 그대로 넣어.
앱스토어 · 구글 플레이 주소가 있으면: summary 요약 상자의 '앱:' 줄에 어디서 받을 수 있는지 쓰고, 글 끝 권유 부분에 text 블록 '아이폰은 앱스토어에서' 다음 link 블록(앱스토어 주소), text 블록 '안드로이드는 구글 플레이에서' 다음 link 블록(구글 플레이 주소)을 넣어. 웹 주소 link 도 따로 하나. 주소가 비어 있는 스토어는 출시 상태대로 '준비 중'이라고만 쓰고 주소를 지어내지 마.
[앱 이름] ${F('app', 100)}
[앱 주소(웹)] ${F('url', 300)}
[앱스토어 주소(아이폰)] ${F('ios', 300) || '(없음)'}
[구글 플레이 주소(안드로이드)] ${F('play', 300) || '(없음)'}
[출시 상태] ${F('status', 200) || '(없음)'}
[이 앱은] ${F('about', 800)}
[오늘 만든 것 · 고친 것] ${F('did')}
[어려웠던 점] ${F('hard')}
[쓰는 사람 반응] ${F('react')}
[다음 계획] ${F('next', 800)}
[더 하고 싶은 말] ${F('extra')}
[최근 커밋 기록]
${commits || '(없음)'}
${clean(body.sample, 3000) ? `[선생님이 예전에 쓴 글 — 말투만 참고하고 내용은 가져오지 마]\n${clean(body.sample, 3000)}` : ''}
${photos.length ? `사진(스크린샷) ${photos.length}장이 위에 있어. 본문에 [사진 n] 자리를 알맞게 넣어.` : '사진은 없어.'}
${out}`;
        } else {
          ask = `'연수 다녀온 후기' 블로그 글을 써 줘. 문체: ${tone}. 길이: ${len}.
선생님 블로그 형식 그대로: 제목("○○ 연수 후기 : 부제" 처럼) → 스티커 → "안녕하세요, 문선생입니다 :)" 인사와 어떤 연수였는지 2~4줄(언제 · 어디 · 무엇) → 사진 → 부제목 "어떤 연수였나요?" → "인상 깊었던 장면" → "이런 걸 배웠어요"(① ② ③) → "제 수업에 이렇게 적용해 볼게요"(■ 또는 '· ') → 사진이 많으면 "연수 사진 공유" → 함께 들으면 좋을 선생님들께 한마디 · 인사 → 스티커. 재료에 없는 부제목은 빼.
[연수 이름] ${F('name', 200)}
[날짜] ${F('date', 100)}
[장소 · 주관] ${F('place', 200)}
[인상 깊었던 것] ${F('moment')}
[배운 점] ${F('learn')}
[내 수업에 적용해 볼 점] ${F('apply')}
[연수 자료에서 옮긴 내용] ${F('material', 6000)}
[더 하고 싶은 말] ${F('extra')}
${clean(body.sample, 3000) ? `[선생님이 예전에 쓴 글 — 말투만 참고하고 내용은 가져오지 마]\n${clean(body.sample, 3000)}` : ''}
${photos.length ? `사진 ${photos.length}장이 위에 있어. 사진 속 장면을 보고 본문에 [사진 n] 자리를 알맞게 넣어. 사진에 학생 얼굴이나 이름이 보이면 checks 에 적어.` : '사진은 없어.'}
${out}`;
        }
        content.push({ type: 'text', text: ask });
        const res = await client.messages.parse({
          model: MODEL, max_tokens: 12000, output_config: { effort: 'medium', format: zodOutputFormat(BlogPost) },
          system: [{ type: 'text', text: BLOG_BASE, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content }],
        });
        if (res.stop_reason === 'refusal' || !res.parsed_output) return json(req, { error: 'AI가 글을 쓰지 못했어요' }, 502);
        const p = res.parsed_output;
        return json(req, { titles: p.titles.slice(0, 5).map((t) => t.slice(0, 120)), blocks: p.blocks.slice(0, 80).map((b) => ({ t: b.t, v: String(b.v || '').slice(0, 3000) })), tags: p.tags.slice(0, 15).map((t) => t.replace(/^#/, '').slice(0, 30)), insta: p.insta.slice(0, 2200), threads: p.threads.slice(0, 600), checks: p.checks.slice(0, 6).map((t) => t.slice(0, 200)) });
      }
      // ── 선생님 ──
      if (url.pathname === '/seteuk' || url.pathname === '/reflect') {
        const who = await verifyFirebase(String(req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
        if (!who || !ADMIN_EMAILS.includes(who.email)) return json(req, { error: 'unauthorized' }, 401);
        const ask = url.pathname === '/seteuk'
          ? `아래는 고등학교 통합사회 'AI활용탐구'(데이터 분석 · 8단계 문제해결학습)에서 한 학생이 남긴 탐구 기록이야. 이 기록만 근거로 학교생활기록부 '세부능력 및 특기사항' 문장을 써 줘.
- 나이스 한도 1,500바이트보다 여유 있게 1,200~1,350바이트(한글 한 글자 3바이트 · 띄어쓰기 1바이트, 대략 공백 포함 410~450자), 1,400바이트는 넘기지 않기, 한 문단, '~함.' '~임.'처럼 명사형으로 끝맺기, 주어 생략
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

// ───────── 관리자 구글 로그인 검사 ─────────
// 소나기 프로젝트(데이터 실험실 선생님 화면) + moontr.site 프로젝트(블로그 글쓰기 · 관리자 허브, 2026-11-22)
const FIREBASE_PROJECTS = ['sonagi-1cc00', 'moon-d528d'];
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
    if (!ok || !FIREBASE_PROJECTS.includes(pay.aud) || pay.iss !== `https://securetoken.google.com/${pay.aud}`) return null;
    if (!(pay.exp > now) || !(pay.iat <= now + 60) || !pay.sub || !pay.email || pay.email_verified !== true) return null;
    return { email: String(pay.email).toLowerCase() };
  } catch { return null; }
}
