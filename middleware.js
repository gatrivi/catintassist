/**
 * Vercel Edge Middleware — site-wide gate for CatIntAssist (private beta).
 *
 * Two named users, credentials in Vercel env vars (NOT in the client bundle):
 *   APP_AUTH_USERS  = "user1:pass1,user2:pass2"
 *   APP_AUTH_SECRET = random string (derives the device cookie token)
 *
 * Successful login sets a 1-year HttpOnly device cookie, so each device
 * logs in once. The cookie token is an HMAC of the credentials with the
 * secret — it cannot be forged without the secret and holds no password.
 */

const COOKIE_NAME = 'cia_device';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year — "remember this device"

const encoder = new TextEncoder();

async function tokenFor(user, pass, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${user}:${pass}`));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function parseUsers(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((pair) => {
      const idx = pair.indexOf(':');
      if (idx < 0) return null;
      return { user: pair.slice(0, idx).trim(), pass: pair.slice(idx + 1).trim() };
    })
    .filter(Boolean);
}

function page(title, body, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#0b1220;color:#fff;font-family:ui-monospace,Menlo,Consolas,monospace}
.card{width:min(340px,92vw);background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);
border-radius:10px;padding:26px 24px;box-shadow:0 12px 48px rgba(0,0,0,0.5)}
h1{font-size:17px;margin:0 0 4px}p.sub{font-size:11px;color:rgba(255,255,255,0.5);margin:0 0 18px}
label{display:block;font-size:11px;color:rgba(255,255,255,0.65);margin:10px 0 4px}
input{width:100%;box-sizing:border-box;background:rgba(255,255,255,0.06);color:#fff;
border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:9px 10px;font:inherit;font-size:13px}
button{width:100%;margin-top:16px;background:rgba(239,68,68,0.3);border:1px solid rgba(239,68,68,0.55);
color:#fff;border-radius:6px;padding:10px;font:inherit;font-size:13px;cursor:pointer}
button:hover{background:rgba(239,68,68,0.45)}
.err{color:#f59e0b;font-size:11px;margin:12px 0 0}
</style></head><body><div class="card">${body}</div></body></html>`,
    {
      status,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    },
  );
}

function loginPage(error = false) {
  return page(
    'CatIntAssist — Sign in',
    `<h1>CatIntAssist</h1><p class="sub">Private beta — interpreter access only</p>
<form method="POST">
<label for="u">User</label><input id="u" name="u" autocomplete="username" required autofocus>
<label for="p">Pass</label><input id="p" name="p" type="password" autocomplete="current-password" required>
<button type="submit">Sign in</button>
${error ? '<p class="err" role="alert">Wrong user or pass — try again.</p>' : ''}
</form>`,
    error ? 401 : 200,
  );
}

async function verify(request, users, secret) {
  const form = await request.formData();
  const user = (form.get('u') || '').toString().trim();
  const pass = (form.get('p') || '').toString();
  const match = users.find((u) => u.user === user && u.pass === pass);
  if (!match) return null;
  return { user, token: await tokenFor(user, pass, secret) };
}

export default async function middleware(request) {
  const users = parseUsers(process.env.APP_AUTH_USERS);
  const secret = process.env.APP_AUTH_SECRET || '';

  // Credentials not configured: fail closed, tell the operator in the response.
  if (users.length === 0 || !secret) {
    return page('Setup required', '<h1>CatIntAssist</h1><p class="sub">Access not configured (missing APP_AUTH_USERS / APP_AUTH_SECRET).</p>', 503);
  }

  const url = new URL(request.url);

  if (request.method === 'POST') {
    const auth = await verify(request, users, secret);
    if (!auth) {
      return loginPage(true);
    }
    const res = new Response(null, { status: 303, headers: { location: '/' } });
    res.headers.append(
      'set-cookie',
      `${COOKIE_NAME}=${auth.token}; Max-Age=${COOKIE_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    );
    return res;
  }

  // Plain edge Request has no .cookies helper — parse the header.
  const rawCookie = request.headers.get('cookie') || '';
  const cookieMatch = rawCookie.match(/(?:^|;\s*)cia_device=([a-f0-9]{64})/);
  const cookie = cookieMatch ? cookieMatch[1] : null;
  if (cookie) {
    for (const u of users) {
      if (cookie === (await tokenFor(u.user, u.pass, secret))) return null; // allow through
    }
  }

  if (url.searchParams.get('e') === '1') return loginPage(true);
  return loginPage(false);
}

export const config = {
  matcher: '/:path*',
};
