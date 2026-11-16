/* 🔑 moontr 로그인 다리 (moon-d528d · 먼저 플래너 · 교무실 타이쿤 아이폰 앱의 카카오 로그인)
   왜 필요해요? 아이폰 앱에서 카카오(OpenID Connect) 로그인은 휴대폰 안 파이어베이스에서만 끝나고,
   그 열쇠(id token)는 한 번 쓰면 다시 못 써서 웹 화면(파이어베이스 웹)으로 넘길 수 없어요.
   그래서: 앱이 휴대폰 안 로그인 표(Firebase ID 토큰)를 보내면 → 진짜인지 파이어베이스에 물어보고 →
   같은 사람(같은 uid)의 '커스텀 토큰'을 만들어 돌려줘요 → 웹 화면은 signInWithCustomToken 으로 같은 계정에 들어가요.
   POST /kakao  { idToken }  →  { token }
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

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
    const url = new URL(req.url);
    if (req.method !== "POST" || url.pathname !== "/kakao") return json(req, { error: "없는 주소예요" }, 404);
    let sa; try { sa = JSON.parse(env.FB_SA || ""); } catch (e) { return json(req, { error: "서버 설정(FB_SA)이 없어요" }, 500); }
    const { idToken } = await req.json().catch(() => ({}));
    if (!idToken || typeof idToken !== "string" || idToken.length > 4000) return json(req, { error: "로그인 표가 없어요" }, 400);
    // 1) 휴대폰 안 로그인 표가 진짜인지 파이어베이스에 물어봐요 (가짜 · 지난 표면 실패)
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
    const j = await r.json().catch(() => ({}));
    const u = (j.users || [])[0];
    if (!r.ok || !u || !u.localId) return json(req, { error: "로그인 표를 확인하지 못했어요 (" + ((j.error || {}).message || r.status) + ")" }, 401);
    // 2) 카카오로 들어온 계정만 (이 다리는 카카오용)
    if (!(u.providerUserInfo || []).some((p) => p.providerId === "oidc.kakao")) return json(req, { error: "카카오 계정이 아니에요" }, 403);
    // 3) 같은 사람의 웹 로그인 열쇠
    try { return json(req, { token: await customToken(sa, u.localId) }); }
    catch (e) { return json(req, { error: "열쇠를 만들지 못했어요 (" + e.message + ")" }, 500); }
  }
};
