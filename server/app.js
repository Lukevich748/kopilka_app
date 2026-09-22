const path = require('path');
const express = require('express');

const db = require('./db');
const { CURRENCIES, isSupportedCurrency } = require('./currencies');
const rates = require('./rates');
const auth = require('./auth');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Аутентификация ---
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const token = await auth.register(username, password);
    auth.setSessionCookie(res, token);
    res.status(201).json({ ok: true });
  } catch (err) {
    if (err instanceof auth.AuthError) return res.status(400).json({ error: err.message });
    next(err);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const token = await auth.login(username, password);
    auth.setSessionCookie(res, token);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof auth.AuthError) return res.status(401).json({ error: err.message });
    next(err);
  }
});

app.post('/api/auth/logout', async (req, res, next) => {
  try {
    await auth.logout(req);
    auth.clearSessionCookie(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.get('/api/auth/status', async (req, res, next) => {
  try {
    const [authenticated, hasAccount] = await Promise.all([auth.isAuthenticated(req), auth.hasAccount()]);
    res.json({ authenticated, hasAccount });
  } catch (err) {
    next(err);
  }
});

// Всё остальное под /api/* требует входа.
app.use('/api', auth.requireAuth);

function signedAmount(tx) {
  return tx.type === 'withdrawal' ? -tx.amount : tx.amount;
}

// Текущий остаток по валюте (пополнения минус снятия), без учёта записи
// excludeId — нужно при редактировании, чтобы не мешать старое значение
// правки с новым при проверке "хватает ли средств".
function currencyBalance(transactions, currency, excludeId) {
  return transactions.reduce((sum, tx) => {
    if (tx.id === excludeId || tx.currency !== currency) return sum;
    return sum + signedAmount(tx);
  }, 0);
}

function computeSummary(settings, transactions) {
  const baseCurrency = settings.baseCurrency;
  const totalsByCurrency = {};

  for (const tx of transactions) {
    totalsByCurrency[tx.currency] = (totalsByCurrency[tx.currency] || 0) + signedAmount(tx);
  }

  let grandTotal = 0;
  for (const [code, amount] of Object.entries(totalsByCurrency)) {
    const converted = rates.convert(amount, code, baseCurrency);
    if (converted !== null) grandTotal += converted;
  }

  return {
    baseCurrency,
    grandTotal: round2(grandTotal),
    totalsByCurrency: Object.fromEntries(
      Object.entries(totalsByCurrency).map(([code, amount]) => [code, round2(amount)])
    ),
    transactionsCount: transactions.length,
  };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// Кумулятивная сумма по месяцам в базовой валюте — для графика динамики.
function computeMonthlyHistory(settings, transactions) {
  const baseCurrency = settings.baseCurrency;
  if (transactions.length === 0) {
    return { baseCurrency, points: [] };
  }

  const addedByMonth = new Map();
  for (const tx of transactions) {
    const converted = rates.convert(tx.amount, tx.currency, baseCurrency);
    if (converted === null) continue;
    const month = tx.date.slice(0, 7); // 'YYYY-MM'
    const signed = tx.type === 'withdrawal' ? -converted : converted;
    addedByMonth.set(month, (addedByMonth.get(month) || 0) + signed);
  }

  const months = [...addedByMonth.keys()].sort();
  const nowMonth = new Date().toISOString().slice(0, 7);
  const lastMonth = months[months.length - 1] > nowMonth ? months[months.length - 1] : nowMonth;

  const points = [];
  let [year, month] = months[0].split('-').map(Number);
  const [lastYear, lastMonthNum] = lastMonth.split('-').map(Number);
  let running = 0;

  while (year < lastYear || (year === lastYear && month <= lastMonthNum)) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const added = addedByMonth.get(key) || 0;
    running += added;
    points.push({ month: key, total: round2(running), added: round2(added) });

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return { baseCurrency, points };
}

// --- Справочник валют ---
app.get('/api/currencies', (req, res) => {
  res.json(CURRENCIES);
});

// --- Настройки ---
app.get('/api/settings', async (req, res, next) => {
  try {
    res.json(await db.getSettings());
  } catch (err) {
    next(err);
  }
});

app.put('/api/settings', async (req, res, next) => {
  try {
    const settings = await db.getSettings();
    const { baseCurrency, enabledCurrencies } = req.body || {};

    let nextEnabled = settings.enabledCurrencies;
    if (enabledCurrencies !== undefined) {
      const unique = Array.isArray(enabledCurrencies) ? [...new Set(enabledCurrencies)] : [];
      if (unique.length === 0) {
        return res.status(400).json({ error: 'Должна остаться хотя бы одна включённая валюта' });
      }
      if (!unique.every(isSupportedCurrency)) {
        return res.status(400).json({ error: 'Неизвестная валюта в списке' });
      }
      nextEnabled = unique;
    }

    const nextBase = baseCurrency !== undefined ? baseCurrency : settings.baseCurrency;
    if (!isSupportedCurrency(nextBase)) {
      return res.status(400).json({ error: 'Неподдерживаемая базовая валюта' });
    }
    if (!nextEnabled.includes(nextBase)) {
      return res.status(400).json({ error: 'Нельзя отключить валюту, выбранную как базовая' });
    }

    const nextSettings = { baseCurrency: nextBase, enabledCurrencies: nextEnabled };
    await db.saveSettings(nextSettings);
    res.json(nextSettings);
  } catch (err) {
    next(err);
  }
});

// --- Пополнения (история) ---
app.get('/api/transactions', async (req, res, next) => {
  try {
    const transactions = await db.listTransactions();
    const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    res.json(sorted);
  } catch (err) {
    next(err);
  }
});

function parseTransactionInput(body) {
  const { amount, currency, date, type, comment } = body || {};
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { error: 'Сумма должна быть положительным числом' };
  }
  if (!isSupportedCurrency(currency)) {
    return { error: 'Неподдерживаемая валюта' };
  }
  const safeType = type === 'withdrawal' ? 'withdrawal' : 'deposit';
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const safeComment = typeof comment === 'string' ? comment.trim().slice(0, 300) : '';
  return { amount: round2(numericAmount), currency, date: safeDate, type: safeType, comment: safeComment };
}

app.post('/api/transactions', async (req, res, next) => {
  try {
    const parsed = parseTransactionInput(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const settings = await db.getSettings();
    if (!settings.enabledCurrencies.includes(parsed.currency)) {
      return res.status(400).json({ error: 'Эта валюта отключена в настройках' });
    }

    if (parsed.type === 'withdrawal') {
      const transactions = await db.listTransactions();
      const balance = round2(currencyBalance(transactions, parsed.currency));
      if (round2(balance - parsed.amount) < 0) {
        return res.status(400).json({ error: `Недостаточно средств в этой валюте: доступно ${balance}` });
      }
    }

    const tx = await db.insertTransaction(parsed);
    res.status(201).json(tx);
  } catch (err) {
    next(err);
  }
});

app.put('/api/transactions/:id', async (req, res, next) => {
  try {
    const parsed = parseTransactionInput(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const tx = await db.getTransaction(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Запись не найдена' });

    const settings = await db.getSettings();
    // Разрешаем оставить валюту записи прежней, даже если её потом отключили —
    // а вот переключиться можно только на валюту, включённую сейчас.
    if (parsed.currency !== tx.currency && !settings.enabledCurrencies.includes(parsed.currency)) {
      return res.status(400).json({ error: 'Эта валюта отключена в настройках' });
    }

    if (parsed.type === 'withdrawal') {
      const transactions = await db.listTransactions();
      const balance = round2(currencyBalance(transactions, parsed.currency, tx.id));
      if (round2(balance - parsed.amount) < 0) {
        return res.status(400).json({ error: `Недостаточно средств в этой валюте: доступно ${balance}` });
      }
    }

    const updated = await db.updateTransaction(tx.id, parsed);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/transactions/:id', async (req, res, next) => {
  try {
    const removed = await db.deleteTransaction(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Запись не найдена' });
    res.json(removed);
  } catch (err) {
    next(err);
  }
});

// --- Сводка (всего накоплено) ---
app.get('/api/summary', async (req, res, next) => {
  try {
    await rates.ensureFreshRates();
    const [settings, transactions] = await Promise.all([db.getSettings(), db.listTransactions()]);
    res.json(computeSummary(settings, transactions));
  } catch (err) {
    next(err);
  }
});

// --- График динамики (накопления по месяцам) ---
app.get('/api/history-chart', async (req, res, next) => {
  try {
    await rates.ensureFreshRates();
    const [settings, transactions] = await Promise.all([db.getSettings(), db.listTransactions()]);
    res.json(computeMonthlyHistory(settings, transactions));
  } catch (err) {
    next(err);
  }
});

// --- Курсы валют ---
app.get('/api/rates', async (req, res, next) => {
  try {
    await rates.ensureFreshRates();
    res.json(rates.getSnapshot());
  } catch (err) {
    next(err);
  }
});

app.post('/api/rates/refresh', async (req, res, next) => {
  try {
    await rates.fetchLiveRates();
    res.json(rates.getSnapshot());
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

module.exports = app;
