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

/* =====================================================================================
   📱 아이아이노트 이용 현황 (2026-11-10): 플레이스토어 · 앱스토어 숫자 + 앱 안 이용(가족 · 일기 수)
   - storeDaily  : 매일 09:30(한국)에 모아서 Firestore ops_store/{날짜} · ops_use/{날짜}에 숫자만 저장해요
   - iinoteStats : moontr.site 관리자 허브가 읽어 가요 (관리자 로그인 확인, ?refresh=1 이면 지금 다시 모아요)
   - 이름 · 메일 · 일기 내용은 모으지 않아요. 숫자만.
   준비와 올리기는 같은 폴더의 STORES.md 를 보세요.
   ===================================================================================== */
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret, defineString } = require("firebase-functions/params");
const crypto = require("crypto");
const zlib = require("zlib");

// functions/.env 에 적어요 (비밀 아님). 비어 있으면 그 스토어는 건너뛰어요
const PLAY_BUCKET = defineString("PLAY_BUCKET", { default: "" });          // 예: pubsite_prod_rev_01234567890123456789
const PLAY_PACKAGE = defineString("PLAY_PACKAGE", { default: "kr.co.iinote.app" });
const ASC_ISSUER = defineString("ASC_ISSUER", { default: "" });            // App Store Connect API 발급자 ID
const ASC_KEY_ID = defineString("ASC_KEY_ID", { default: "" });            // 키 ID (10글자)
const ASC_VENDOR = defineString("ASC_VENDOR", { default: "" });            // 공급업체 번호 (판매 및 추세 화면 왼쪽 위)
const ASC_APP_ID = defineString("ASC_APP_ID", { default: "6831842667" });  // 아이아이노트 앱스토어 번호
const ASC_P8 = defineSecret("ASC_P8");                                     // 키 파일(.p8) 내용 — 비밀 저장소에만

const kday = (ms = Date.now()) => new Date(ms + 9 * 36e5).toISOString().slice(0, 10);   // 한국 날짜
async function isOperator(req) {
  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer /, "");
    const me = await admin.auth(moon).verifyIdToken(token);
    return me.email === OPERATOR && me.email_verified;
  } catch (e) { return false; }
}

/* ---------- 플레이스토어: Play Console '대량 보고서'(Cloud Storage) 설치 통계 CSV ---------- */
// stats/installs/installs_<패키지>_<YYYYMM>_overview.csv (UTF-16 글자). 하루 이틀 늦게 채워져요
async function playStats() {
  const bucket = PLAY_BUCKET.value(); if (!bucket) return { skipped: "PLAY_BUCKET 없음" };
  const out = {}, now = new Date();
  for (const back of [1, 0]) {   // 지난달 + 이번 달
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1), ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
    const path = `stats/installs/installs_${PLAY_PACKAGE.value()}_${ym}_overview.csv`;
    let buf;
    try { [buf] = await admin.storage().bucket(bucket).file(path).download(); } catch (e) { if (e.code === 404) continue; throw e; }
    const text = (buf[0] === 0xff && buf[1] === 0xfe ? buf.toString("utf16le") : buf.toString("utf8")).replace(/^﻿/, "");
    const rows = text.split(/\r?\n/).filter(Boolean).map(l => l.split(",").map(c => c.replace(/^"|"$/g, "").trim()));
    const head = rows.shift() || [], col = name => head.findIndex(h => h.toLowerCase() === name.toLowerCase());
    const c = { date: col("Date"), inst: col("Daily Device Installs"), uninst: col("Daily Device Uninstalls"), users: col("Total User Installs"),
      newUsers: col("Daily User Installs"), active: col("Active Device Installs"), upd: col("Daily Device Upgrades") };
    for (const r of rows) {
      const day = r[c.date]; if (!/^\d{4}-\d{2}-\d{2}$/.test(day || "")) continue;
      const n = i => (i >= 0 ? Number(r[i]) || 0 : 0);
      out[day] = { installs: n(c.inst), uninstalls: n(c.uninst), updates: n(c.upd), newUsers: n(c.newUsers), totalUsers: n(c.users), activeDevices: n(c.active) };
    }
  }
  return out;
}

/* ---------- 앱스토어: App Store Connect API 판매 보고서(일별 요약) ---------- */
// 제품 종류 1 · 1F · 1T = 새 다운로드, 3 · 3F = 다시 받기, 7 · 7F · 7T = 업데이트. 다음 날 채워져요
function ascToken() {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url"), now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: ASC_KEY_ID.value(), typ: "JWT" }), body = b64({ iss: ASC_ISSUER.value(), iat: now, exp: now + 1100, aud: "appstoreconnect-v1" });
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key: ASC_P8.value(), dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${head}.${body}.${sig}`;
}
async function iosStats(days = 10) {
  if (!ASC_ISSUER.value() || !ASC_KEY_ID.value() || !ASC_VENDOR.value() || !ASC_P8.value()) return { skipped: "App Store Connect 키 없음" };
  const token = ascToken(), out = {};
  for (let i = 1; i <= days; i++) {
    const day = kday(Date.now() - i * 864e5);
    const q = new URLSearchParams({ "filter[frequency]": "DAILY", "filter[reportDate]": day, "filter[reportSubType]": "SUMMARY", "filter[reportType]": "SALES", "filter[vendorNumber]": ASC_VENDOR.value(), "filter[version]": "1_1" });
    const r = await fetch(`https://api.appstoreconnect.apple.com/v1/salesReports?${q}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/a-gzip" } });
    if (r.status === 404) { out[day] = { downloads: 0, redownloads: 0, updates: 0, countries: {} }; continue; }   // 그날 기록 없음
    if (!r.ok) { out[day] = { error: `${r.status}` }; continue; }
    const tsv = zlib.gunzipSync(Buffer.from(await r.arrayBuffer())).toString("utf8").split(/\r?\n/).filter(Boolean).map(l => l.split("\t"));
    const head = tsv.shift() || [], col = n => head.indexOf(n);
    const cType = col("Product Type Identifier"), cUnits = col("Units"), cId = col("Apple Identifier"), cCountry = col("Country Code");
    const o = { downloads: 0, redownloads: 0, updates: 0, countries: {} };
    for (const row of tsv) {
      if (String(row[cId]) !== String(ASC_APP_ID.value())) continue;
      const t = row[cType] || "", u = Number(row[cUnits]) || 0;
      if (/^(1|1F|1T|F1)$/.test(t)) { o.downloads += u; o.countries[row[cCountry]] = (o.countries[row[cCountry]] || 0) + u; }
      else if (/^(3|3F|3T|F3)$/.test(t)) o.redownloads += u;
      else if (/^(7|7F|7T|F7)$/.test(t)) o.updates += u;
    }
    out[day] = o;
  }
  return out;
}

/* ---------- 앱 안 이용: 가족 · 사람 · 일기 수 (숫자만) ---------- */
async function useStats() {
  const now = Date.now(), d1 = kday(now), d7 = kday(now - 6 * 864e5), d30 = kday(now - 29 * 864e5);
  const groups = await db.collection("groups").get();
  const o = { families: groups.size, newFamilies7: 0, adults: 0, kids: 0, diaries7: 0, diaries30: 0, writers1: 0, writers7: 0, famsActive1: 0, famsActive7: 0, famsActive30: 0, perDay: {} };
  for (const g of groups.docs) {
    if ((g.get("createdAt") || 0) >= now - 7 * 864e5) o.newFamilies7++;
    const ps = await g.ref.collection("profiles").select("type").get();
    ps.forEach(p => { if (p.get("type") === "child") o.kids++; else o.adults++; });
    const ds = await g.ref.collection("diaries").where("date", ">=", d30).select("date", "profileId").get();
    const w1 = new Set(), w7 = new Set();
    ds.forEach(x => { const dt = x.get("date"); o.diaries30++; o.perDay[dt] = (o.perDay[dt] || 0) + 1;
      if (dt >= d7) { o.diaries7++; w7.add(x.get("profileId")); } if (dt >= d1) w1.add(x.get("profileId")); });
    o.writers1 += w1.size; o.writers7 += w7.size;
    if (w1.size) o.famsActive1++; if (w7.size) o.famsActive7++; if (ds.size) o.famsActive30++;
  }
  return o;
}

async function collectAll() {
  const res = { at: Date.now() };
  const save = async (name, fn) => {
    try {
      const data = await fn(); res[name] = data.skipped ? data.skipped : "ok";
      if (data.skipped) return;
      const b = db.batch();
      Object.entries(data).forEach(([day, v]) => b.set(db.collection("ops_store").doc(day), { [name]: v, at: Date.now() }, { merge: true }));
      await b.commit();
    } catch (e) { console.error(name, e); res[name] = "오류: " + (e.message || e); }
  };
  await save("play", playStats);
  await save("ios", iosStats);
  try { await db.collection("ops_use").doc(kday()).set({ ...(await useStats()), at: Date.now() }); res.use = "ok"; }
  catch (e) { console.error("use", e); res.use = "오류: " + (e.message || e); }
  await db.collection("ops_store").doc("_last").set(res);
  return res;
}

exports.storeDaily = onSchedule({ schedule: "30 9 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3", secrets: [ASC_P8], timeoutSeconds: 300 }, async () => { await collectAll(); });

exports.iinoteStats = onRequest({ region: "asia-northeast3", cors: ["https://moontr.site"], invoker: "public", maxInstances: 2, secrets: [ASC_P8], timeoutSeconds: 300 }, async (req, res) => {
  if (!(await isOperator(req))) { res.status(403).json({ error: "관리자만 볼 수 있어요" }); return; }
  const last = (await db.collection("ops_store").doc("_last").get()).data() || null;
  const run = req.query.refresh === "1" || !last ? await collectAll() : last;
  const from = kday(Date.now() - 90 * 864e5);
  const store = {}, use = {};
  (await db.collection("ops_store").where(admin.firestore.FieldPath.documentId(), ">=", from).get()).forEach(d => { if (d.id !== "_last") store[d.id] = d.data(); });
  (await db.collection("ops_use").where(admin.firestore.FieldPath.documentId(), ">=", from).get()).forEach(d => { use[d.id] = d.data(); });
  res.set("Cache-Control", "no-store").json({ run, store, use });
});
