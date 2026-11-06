// 아이아이노트 새 소식 (2026-11-06): moontr.site 관리자 허브 · AI 연구소가 이 함수에 물어봐요.
// 아이아이노트는 Firebase 프로젝트(iinote)가 달라서, moontr.site 관리자 로그인(moon-d528d)을 여기서 확인하고
// 숫자와 문의 앞부분만 돌려줘요. 이름 · 메일 · 일기 내용은 보내지 않아요.
// 다른 아이아이노트 함수와 묶음(codebase)이 달라서, 서로 올려도 지워지지 않아요.
// 올리기: 이 폴더(firebase/iinote-pulse)에서  firebase deploy --only functions:pulse
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const moon = admin.initializeApp({ projectId: "moon-d528d" }, "moon");   // 로그인 표(토큰) 확인만

const OPERATOR = "bellachord@gmail.com";
const DAYS = 3;                  // 며칠 안에 들어온 사람을 '새 가족'으로 볼까요
const ERR_ID = "__errors";       // 자동 오류 기록은 의견이 아니라서 빼요
const cut = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };

exports.iinotePulse = onRequest({ region: "asia-northeast3", cors: ["https://moontr.site"], invoker: "public", maxInstances: 2 }, async (req, res) => {
  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer /, "");
    const me = await admin.auth(moon).verifyIdToken(token);
    if (me.email !== OPERATOR || !me.email_verified) throw new Error("not operator");
  } catch (e) { res.status(403).json({ error: "관리자만 볼 수 있어요" }); return; }

  const since = Date.now() - DAYS * 864e5;
  const day = new Date(since + 9 * 36e5).toISOString().slice(0, 10);   // 한국 날짜
  // 새로 들어온 사람: 새로 만든 가족 + 원래 있던 가족에 합류한 사람
  const groups = await db.collection("groups").get();
  const fams = (await Promise.all(groups.docs.map(async g => {
    const ps = await g.ref.collection("profiles").where("createdAt", ">=", since).get();
    if (ps.empty) return null;
    const list = ps.docs.map(d => ({ id: d.id, ...d.data() }));
    const adults = list.filter(p => p.type === "parent"), kids = list.filter(p => p.type === "child");
    const ds = await g.ref.collection("diaries").where("date", ">=", day).select("profileId").get();
    const ids = new Set(list.map(p => p.id)), mine = ds.docs.map(d => d.get("profileId")).filter(id => ids.has(id));
    return { at: Math.max(...list.map(p => p.createdAt || 0)), isNew: (g.get("createdAt") || 0) >= since, adults: adults.length, kids: kids.length,
      diaries: mine.length, adultWriters: adults.filter(p => mine.includes(p.id)).length };
  }))).filter(Boolean).sort((a, b) => b.at - a.at);

  // 의견 · 문의: 운영자가 아직 안 연 대화 + 챗봇이 바로 답해서 알림 없이 끝난 최근 대화
  const sup = await db.collection("support").orderBy("updatedAt", "desc").limit(100).get();
  const rows = sup.docs.filter(d => d.id !== ERR_ID).map(d => ({ n: d.get("unreadOp") || 0, kind: d.get("lastKind") || "", last: cut(d.get("last"), 60), at: d.get("updatedAt") || 0 }));
  const unread = rows.filter(x => x.n > 0);
  const bot = rows.filter(x => !x.n && x.kind === "answer" && x.at >= since);
  res.set("Cache-Control", "no-store").json({ days: DAYS, fams, unread, bot });
});
