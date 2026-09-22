// Простая аутентификация по логину/паролю для одного пользователя —
// без отдельной таблицы пользователей: логин и bcrypt-хеш пароля заданы
// переменными окружения, а сессия — это самоподписанный (HMAC) токен в
// httpOnly-куке. Ни памяти на сервере, ни БД для сессий не нужно — подходит
// для serverless, где нет гарантии, что следующий запрос попадёт в тот же
// прогретый инстанс функции.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const COOKIE_NAME = 'kopilka_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Не задана переменная окружения SESSION_SECRET');
  return secret;
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('hex');
}

function createSessionToken() {
  const expires = String(Date.now() + SESSION_TTL_MS);
  return `${expires}.${sign(expires)}`;
}

function verifySessionToken(token) {
  if (!token) return false;
  const [expires, sig] = token.split('.');
  if (!expires || !sig) return false;

  const expectedSig = sign(expires);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  const expiresAt = Number(expires);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie);
  return verifySessionToken(cookies[COOKIE_NAME]);
}

function setSessionCookie(res) {
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  const secureAttr = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${createSessionToken()}; HttpOnly; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secureAttr}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

// Логин и пароль проверяются независимо и всегда оба (без short-circuit по
// логину), чтобы не давать по времени ответа отличить "неверный логин" от
// "неверный пароль".
async function checkCredentials(username, password) {
  const expectedUsername = process.env.AUTH_USERNAME;
  const expectedHash = process.env.AUTH_PASSWORD_HASH;
  if (!expectedUsername || !expectedHash) {
    throw new Error('Не заданы переменные окружения AUTH_USERNAME / AUTH_PASSWORD_HASH');
  }

  const usernameBuf = Buffer.from(typeof username === 'string' ? username : '');
  const expectedUsernameBuf = Buffer.from(expectedUsername);
  const usernameOk =
    usernameBuf.length === expectedUsernameBuf.length && crypto.timingSafeEqual(usernameBuf, expectedUsernameBuf);

  const passwordOk = await bcrypt.compare(typeof password === 'string' ? password : '', expectedHash);

  return usernameOk && passwordOk;
}

function requireAuth(req, res, next) {
  if (isAuthenticated(req)) return next();
  res.status(401).json({ error: 'Требуется вход' });
}

module.exports = { checkCredentials, setSessionCookie, clearSessionCookie, requireAuth, isAuthenticated };
