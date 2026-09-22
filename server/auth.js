// Аутентификация с простейшей регистрацией прямо в приложении — без
// переменных окружения для логина/пароля/секрета подписи. Пользователь и
// сессии хранятся в Supabase (см. supabase/schema.sql: users, sessions).
// Кука хранит только случайный opaque-токен сессии, её валидность и срок
// годности проверяются запросом к БД — так и на serverless не нужен
// отдельный секрет для подписи куки.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');

const COOKIE_NAME = 'kopilka_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

// Хеш заведомо несуществующего пароля — сравниваем с ним, когда логина нет
// в базе, чтобы попытка входа под несуществующим логином занимала по времени
// столько же, сколько под существующим с неверным паролем.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8O9qzGDcPmvE6yTJVMHW3XvhOKvY.6';

class AuthError extends Error {}

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

function getTokenFromReq(req) {
  return parseCookies(req.headers.cookie)[COOKIE_NAME];
}

function setSessionCookie(res, token) {
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  const secureAttr = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secureAttr}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

async function hasAccount() {
  return (await db.countUsers()) > 0;
}

async function createSessionForUser(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db.createSession({ token, userId, expiresAt });
  return token;
}

// Регистрация разрешена только пока нет ни одного аккаунта — приложение
// личное, одного пользователя достаточно, а открытая регистрация отдала бы
// доступ к общим накоплениям любому, кто найдёт ссылку.
async function register(username, password) {
  const cleanUsername = typeof username === 'string' ? username.trim() : '';
  if (!cleanUsername) throw new AuthError('Введите логин');
  if (typeof password !== 'string' || password.length < 6) {
    throw new AuthError('Пароль должен быть не короче 6 символов');
  }
  if (await hasAccount()) {
    throw new AuthError('Регистрация уже пройдена — войдите через форму входа');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.createUser({ username: cleanUsername, passwordHash });
  return createSessionForUser(user.id);
}

async function login(username, password) {
  const cleanUsername = typeof username === 'string' ? username.trim() : '';
  const user = await db.getUserByUsername(cleanUsername);
  const passwordOk = await bcrypt.compare(
    typeof password === 'string' ? password : '',
    user ? user.password_hash : DUMMY_HASH
  );
  if (!user || !passwordOk) throw new AuthError('Неверный логин или пароль');
  return createSessionForUser(user.id);
}

async function logout(req) {
  const token = getTokenFromReq(req);
  if (token) await db.deleteSession(token);
}

async function isAuthenticated(req) {
  const token = getTokenFromReq(req);
  if (!token) return false;
  return !!(await db.getValidSession(token));
}

async function requireAuth(req, res, next) {
  try {
    if (await isAuthenticated(req)) return next();
    res.status(401).json({ error: 'Требуется вход' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  AuthError,
  hasAccount,
  register,
  login,
  logout,
  isAuthenticated,
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
};
