// 💬 문의 채팅 서버 (2026-11-07): 스냅주 · 큰법당 템플스테이 · 캠핑장 · 소호랩
//  - 사용자: 기기마다 정한 번호(uid)로 대화가 이어져요. 로그인은 필요 없어요. 글을 남기면 AI 가 먼저 답해요(답에는 'AI 답변' 표시)
//  - 관리자: moontr.site/help/ 에서 관리자 구글 계정으로 들어와 모든 앱의 대화를 보고 답해요 (Firebase 로그인 토큰을 확인)
//  - 이름 · 전화번호 같은 개인 정보는 받지 않아요. 글과 앱 이름, 닉네임(있으면)만 남아요
import { DurableObject } from 'cloudflare:workers';

const APPS = {
  snapzoo: { name: '스냅주', url: 'https://snapzoo.site/', guide: 'https://snapzoo.site/',
    about: '3D 섬을 걸어 다니며 동물 사진을 찍어 도감을 채우는 게임. 마을 · 강 · 바다 · 초원 · 사막 · 밀림 · 산꼭대기(케이블카) · 갈라파고스 섬(배)으로 이동. 큰 단추로 사진 찍기, 사진 점수만큼 코인, 코인으로 상점에서 옷 · 모자 · 액세서리 · 머리색 · 사진기 · 가구 · 벽지를 사요. 우리 집(마을 동쪽) 꾸미기 · 액자, 동작(모닥불 곁: 앉기 · 마시멜로 · 불꽃놀이 · 연날리기 / 동물 곁: 쓰다듬기 · 먹이 · 셀카), 메뉴의 도감 · 앨범 · 스크린샷 · 설정(기록 내보내기 · 불러오기). 기록은 이 기기 브라우저에만 저장돼요.' },
  templestay: { name: '큰법당 템플스테이', url: 'https://templestay.site/', guide: 'https://templestay.site/guide.html',
    about: '회원가입 없이 들어가는 3D 절. 마당 · 법당 · 공양간 · 내 방, 합장 · 반배 · 큰절 · 염주 · 108배, 소원 올리기와 연등, 캐릭터 꾸미기, 메뉴(☰)의 사용 설명서 · 개인 설정 · 신고하기.' },
  campingjang: { name: '캠핑장', url: 'https://campingjang.site/', guide: '',
    about: '3D 캠핑장. 디자인 세 가지(텐트 · 산속 / 캠핑카 · 바닷가 / 카바나 · 별밤), 장소 네 곳(캠프 마당 · 내 자리 · 물가 · 취사장), 장소마다 동작 다섯 가지, 표정으로 소통, 불꽃놀이, 낚시 · 곤충 잡기 · 요리 도감(이 기기에 저장), 메뉴의 조용한 서버로 · 사용 안내 · 신고하기.' },
  soholab: { name: '소호랩', url: 'https://soho-lab.site/', guide: '',
    about: '1인 개발자 3D 사무실. 집중 시간 기록, 상점, 내 웹 자랑, 사진 찍기, 내 기록 보기, 개인 및 환경 설정, 소호랩 사용법, 신고하기, 펫과 놀기, 주간 리포트 카드.' },
};
const ORIGINS = ['https://moontr.site', 'https://snapzoo.site', 'https://www.snapzoo.site', 'https://templestay.site', 'https://www.templestay.site', 'https://campingjang.site', 'https://www.campingjang.site', 'https://soho-lab.site', 'https://www.soho-lab.site', 'https://vaca-at.github.io', 'http://localhost:8765', 'http://127.0.0.1:8765'];
const cors = (req) => { const o = req.headers.get('Origin') || ''; return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) || /^http:\/\/localhost:\d+$/.test(o) ? o : ORIGINS[0], Vary: 'Origin' }; };
const json = (req, d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(req) } });
const clean = (s, n) => String(s || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);
const okUid = (u) => /^[A-Za-z0-9_-]{12,40}$/.test(String(u || ''));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors(req), 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400' } });
    const desk = env.DESK.get(env.DESK.idFromName('desk'));
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    // 사용자: 글 보내기 → 저장 → AI 답 → 대화 돌려주기
    if (url.pathname === '/send' && req.method === 'POST') {
      const app = APPS[body.app] ? body.app : '', uid = body.uid, text = clean(body.text, 800);
      if (!app || !okUid(uid) || !text) return json(req, { error: 'bad' }, 400);
      const r = await desk.fetch('https://desk/add', { method: 'POST', body: JSON.stringify({ app, uid, from: 'user', text, name: clean(body.name, 20) }) }).then((x) => x.json());
      if (r.error) return json(req, r, 429);
      let ai = '';
      try { ai = await aiAnswer(env, app, text, r.msgs); } catch (e) { console.log('AI 실패', String(e).slice(0, 300)); ai = ''; }
      if (!ai) ai = '글을 잘 받았어요. AI 가 지금 답하기 어려워서, 관리자가 확인하고 이 창에 답을 남길게요.';
      const r2 = await desk.fetch('https://desk/add', { method: 'POST', body: JSON.stringify({ app, uid, from: 'ai', text: ai }) }).then((x) => x.json());
      return json(req, { msgs: r2.msgs });
    }
    // 사용자: 내 대화 보기 (관리자 답을 읽은 걸로)
    if (url.pathname === '/list') {
      const app = url.searchParams.get('app'), uid = url.searchParams.get('uid');
      if (!APPS[app] || !okUid(uid)) return json(req, { error: 'bad' }, 400);
      return json(req, await desk.fetch(`https://desk/list?app=${app}&uid=${uid}&peek=${url.searchParams.get('peek') ? 1 : 0}`).then((x) => x.json()));
    }
    // 관리자
    if (url.pathname.startsWith('/admin/')) {
      const who = await verifyFirebase(String(req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
      const allowed = (env.ADMIN_EMAILS || ADMIN_EMAILS).split(',').map((s) => s.trim().toLowerCase());
      if (!who || !allowed.includes(who.email)) return json(req, { error: 'unauthorized' }, 401);
      if (url.pathname === '/admin/threads') return json(req, { apps: Object.fromEntries(Object.entries(APPS).map(([k, v]) => [k, v.name])), ...(await desk.fetch('https://desk/threads').then((x) => x.json())) });
      if (url.pathname === '/admin/thread') return json(req, await desk.fetch(`https://desk/list?app=${url.searchParams.get('app')}&uid=${url.searchParams.get('uid')}&op=1`).then((x) => x.json()));
      if (url.pathname === '/admin/reply' && req.method === 'POST') {
        const text = clean(body.text, 2000); if (!APPS[body.app] || !okUid(body.uid) || !text) return json(req, { error: 'bad' }, 400);
        return json(req, await desk.fetch('https://desk/add', { method: 'POST', body: JSON.stringify({ app: body.app, uid: body.uid, from: 'op', text }) }).then((x) => x.json()));
      }
      if (url.pathname === '/admin/delete' && req.method === 'POST') return json(req, await desk.fetch('https://desk/delete', { method: 'POST', body: JSON.stringify({ app: body.app, uid: body.uid }) }).then((x) => x.json()));
      if (url.pathname === '/admin/done' && req.method === 'POST') return json(req, await desk.fetch('https://desk/done', { method: 'POST', body: JSON.stringify({ app: body.app, uid: body.uid }) }).then((x) => x.json()));
    }
    return json(req, { ok: true, service: 'moontr-help' });
  },
};

// ───────── 🤖 AI 먼저 답하기 (Cloudflare Workers AI) ─────────
const guideCache = new Map();
async function guideText(app) {
  const a = APPS[app]; if (!a.guide) return '';
  const c = guideCache.get(app); if (c && Date.now() - c.at < 6 * 3600e3) return c.t;
  let t = '';
  try { const h = await fetch(a.guide, { cf: { cacheTtl: 3600 } }).then((r) => r.text()); t = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').slice(0, 7000); } catch {}
  guideCache.set(app, { at: Date.now(), t }); return t;
}
async function aiAnswer(env, app, text, msgs) {
  const a = APPS[app], guide = await guideText(app);
  const sys = `너는 '${a.name}'(${a.url}) 웹앱의 상담 도우미 AI 야. 반드시 한국어로, 초등학생도 알아듣게 쉬운 말로 3~5문장 안에 답해.
아래 앱 설명과 안내문에 있는 내용만 근거로 답하고, 모르는 것은 지어내지 말고 "관리자가 확인하고 답해 드릴게요"라고 해.
오류 · 고장 · 요청 · 제안이면 고마움을 전하고 관리자에게 전달됐다고 말해. 개인 정보(전화번호 · 주소 · 비밀번호)는 묻지 마.
[앱 설명] ${a.about}
[안내문] ${guide}`;
  const hist = (msgs || []).slice(-8).map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text })).filter((m, i, L) => !(i === L.length - 1 && m.role === 'user'));
  const messages = [{ role: 'system', content: sys }, ...hist, { role: 'user', content: text }];
  for (const model of ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/qwen/qwen3-30b-a3b-fp8']) {   // 앞 모델이 안 되면 다음 모델
    try { const r = await env.AI.run(model, { messages, max_tokens: 400 }); const v = r?.response ?? r?.result?.response ?? r?.choices?.[0]?.message?.content ?? ''; const out = (typeof v === 'string' ? v : JSON.stringify(v)).replace(/<think>[\s\S]*?<\/think>/g, '').trim(); if (out) return out.slice(0, 1500); console.log('AI 빈 답', model, JSON.stringify(r).slice(0, 300)); } catch (e) { console.log('AI 오류', model, String(e).slice(0, 300)); }
  }
  return '';
}

// ───────── 대화 보관함 (Durable Object 하나) ─────────
//  t:<app>:<uid> = { app, uid, name, msgs:[{from,text,at}], updatedAt, last, unreadOp, unreadUser, hour:[보낸 시각들] }
export class Desk extends DurableObject {
  async fetch(req) {
    const url = new URL(req.url), st = this.ctx.storage;
    if (url.pathname === '/add') {
      const b = await req.json(), key = `t:${b.app}:${b.uid}`, t = (await st.get(key)) || { app: b.app, uid: b.uid, name: '', msgs: [], unreadOp: 0, unreadUser: 0, hour: [] }, now = Date.now();
      if (b.from === 'user') { t.hour = (t.hour || []).filter((x) => now - x < 3600e3); if (t.hour.length >= 20) return Response.json({ error: '한 시간에 20번까지 보낼 수 있어요. 잠시 뒤에 다시 보내 주세요' }); t.hour.push(now); t.unreadOp = (t.unreadOp || 0) + 1; if (b.name) t.name = b.name; }
      if (b.from === 'op') { t.unreadUser = (t.unreadUser || 0) + 1; t.unreadOp = 0; }
      t.msgs.push({ from: b.from, text: b.text, at: now }); if (t.msgs.length > 200) t.msgs = t.msgs.slice(-200);
      t.updatedAt = now; if (b.from !== 'ai') t.last = b.text.slice(0, 80);
      await st.put(key, t); return Response.json({ msgs: t.msgs });
    }
    if (url.pathname === '/list') {
      const key = `t:${url.searchParams.get('app')}:${url.searchParams.get('uid')}`, t = await st.get(key);
      if (!t) return Response.json({ msgs: [], unread: 0 });
      const unread = t.unreadUser || 0;
      if (url.searchParams.get('op') === '1') { t.unreadOp = 0; await st.put(key, t); }
      else if (url.searchParams.get('peek') !== '1' && unread) { t.unreadUser = 0; await st.put(key, t); }
      return Response.json({ msgs: url.searchParams.get('peek') === '1' ? [] : t.msgs, unread, name: t.name });
    }
    if (url.pathname === '/threads') {
      const all = await st.list({ prefix: 't:' }), out = [];
      for (const t of all.values()) out.push({ app: t.app, uid: t.uid, name: t.name, last: t.last, updatedAt: t.updatedAt, unreadOp: t.unreadOp || 0, n: t.msgs.length });
      out.sort((a, b) => b.updatedAt - a.updatedAt); return Response.json({ threads: out.slice(0, 300), unread: out.reduce((s, t) => s + (t.unreadOp ? 1 : 0), 0) });
    }
    if (url.pathname === '/delete') { const b = await req.json(); await st.delete(`t:${b.app}:${b.uid}`); return Response.json({ ok: true }); }
    if (url.pathname === '/done') { const b = await req.json(), key = `t:${b.app}:${b.uid}`, t = await st.get(key); if (t) { t.unreadOp = 0; await st.put(key, t); } return Response.json({ ok: true }); }
    return new Response('?', { status: 404 });
  }
}

// ───────── 관리자 구글(Firebase) 로그인 검사 (templestay 서버와 같은 방식) ─────────
const FIREBASE_PROJECT = 'moon-d528d';
const ADMIN_EMAILS = 'bellachord@gmail.com';
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
