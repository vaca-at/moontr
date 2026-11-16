/* 🔑 moontr 로그인 다리 (moon-d528d · 먼저 플래너 · 교무실 타이쿤 아이폰 앱의 카카오 로그인)
   왜 필요해요? 아이폰 앱에서 카카오(OpenID Connect) 로그인은 휴대폰 안 파이어베이스에서만 끝나고,
   그 열쇠(id token)는 한 번 쓰면 다시 못 써서 웹 화면(파이어베이스 웹)으로 넘길 수 없어요.
   그래서: 앱이 휴대폰 안 로그인 표(Firebase ID 토큰)를 보내면 → 진짜인지 파이어베이스에 물어보고 →
   같은 사람(같은 uid)의 '커스텀 토큰'을 만들어 돌려줘요 → 웹 화면은 signInWithCustomToken 으로 같은 계정에 들어가요.
   POST /kakao  { idToken }  →  { token }
   POST /merge  { main, other }  →  { ok, linked }  (같은 사람의 두 계정을 하나로, 아래 설명)
   비밀값: FB_SA = 파이어베이스 서비스 계정 키(JSON 통째로) · 바깥 라이브러리 없이 WebCrypto 만 써요 */
const API_KEY = "AIzaSyA3CxawUPIfGeBWyffsNbCSM3ymjKHLH6o";   // moon-d528d 웹 공개 키 (웹 화면에도 있는 값)
const ORIGINS = ["capacitor://localhost", "ionic://localhost", "http://localhost", "https://localhost", "https://moontr.site"];

const cors = (req) => { const o = req.headers.get("Origin") || ""; return { "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0], "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" }; };
const json = (req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(req) } });
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uStr = (s) => b64u(new TextEncoder().encode(s));

// 서비스 계정 키로 커스텀 토큰(JWT, RS256) 만들기
async function customToken(sa, uid) {
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const head = b64uStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64uStr(JSON.stringify({ iss: sa.client_email, sub: sa.client_email, aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit", iat: now, exp: now + 3600, uid }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}

// 로그인 표(Firebase ID 토큰)가 진짜인지 파이어베이스에 물어봐요 (가짜 · 지난 표면 실패) → 그 사람 정보
async function lookup(idToken) {
  if (!idToken || typeof idToken !== "string" || idToken.length > 4000) return { err: "로그인 표가 없어요" };
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
  const j = await r.json().catch(() => ({})), u = (j.users || [])[0];
  return r.ok && u && u.localId ? { u } : { err: "로그인 표를 확인하지 못했어요 (" + ((j.error || {}).message || r.status) + ")" };
}
// 관리자 열쇠(구글 OAuth access token): 계정 지우기 · 로그인 방법 붙이기에 써요 (50분 동안 다시 써요)
let ADM = { t: "", exp: 0 };
async function adminToken(sa) {
  if (ADM.t && Date.now() < ADM.exp) return ADM.t;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const head = b64uStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64uStr(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${body}`));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${head}.${body}.${b64u(sig)}` });
  const j = await r.json(); if (!j.access_token) throw new Error("관리자 열쇠 " + (j.error || r.status));
  ADM = { t: j.access_token, exp: Date.now() + 50 * 60e3 }; return ADM.t;
}
const admin = async (sa, path, body) => {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await adminToken(sa)) }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error || {}).message || r.status); return j;
};
const KINDS = { "google.com": "구글", "apple.com": "Apple", "oidc.kakao": "카카오" };

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
    const url = new URL(req.url);
    if (req.method !== "POST" || !["/kakao", "/merge"].includes(url.pathname)) return json(req, { error: "없는 주소예요" }, 404);
    let sa; try { sa = JSON.parse(env.FB_SA || ""); } catch (e) { return json(req, { error: "서버 설정(FB_SA)이 없어요" }, 500); }
    const body = await req.json().catch(() => ({}));

    /* 🔗 POST /merge { main, other } — 같은 사람의 두 계정을 하나로 (2026-11-16 '애플 · 카카오 · 구글 어느 쪽으로 들어와도 같은 계정')
       main = 지금 쓰는 계정의 로그인 표, other = 따로 만들어진 계정의 로그인 표 (두 계정 모두 본인이 방금 로그인해 증명)
       other 의 로그인 방법(구글 · Apple · 카카오)을 떼어 main 에 붙이고 other 계정은 지워요. 기록 합치기 · other 기록 지우기는 앱이 먼저 해요 */
    if (url.pathname === "/merge") {
      const a = await lookup(body.main), b = await lookup(body.other);
      if (a.err || b.err) return json(req, { error: a.err || b.err }, 401);
      const U = a.u, O = b.u;
      if (U.localId === O.localId) return json(req, { ok: true, same: true, linked: [] });
      const P = (O.providerUserInfo || []).filter((p) => KINDS[p.providerId]);
      const has = new Set((U.providerUserInfo || []).map((p) => p.providerId));
      const dup = P.find((p) => has.has(p.providerId));
      if (dup) return json(req, { error: `이 계정에는 이미 다른 ${KINDS[dup.providerId]} 계정이 연결돼 있어요` }, 409);
      try {
        await admin(sa, "accounts:delete", { localId: O.localId });
        for (const p of P) await admin(sa, "accounts:update", { localId: U.localId, linkProviderUserInfo: { providerId: p.providerId, rawId: p.rawId, ...(p.email ? { email: p.email } : {}), ...(p.displayName ? { displayName: p.displayName } : {}) } });
        return json(req, { ok: true, linked: P.map((p) => p.providerId) });
      } catch (e) { return json(req, { error: "계정을 합치지 못했어요 (" + e.message + ")" }, 500); }
    }

    // 1) 휴대폰 안 로그인 표가 진짜인지 파이어베이스에 물어봐요
    const L = await lookup(body.idToken);
    if (L.err) return json(req, { error: L.err }, 401);
    const u = L.u;
    // 2) 카카오로 들어온 계정만 (이 다리는 카카오용)
    if (!(u.providerUserInfo || []).some((p) => p.providerId === "oidc.kakao")) return json(req, { error: "카카오 계정이 아니에요" }, 403);
    // 3) 같은 사람의 웹 로그인 열쇠
    try { return json(req, { token: await customToken(sa, u.localId) }); }
    catch (e) { return json(req, { error: "열쇠를 만들지 못했어요 (" + e.message + ")" }, 500); }
  }
};
