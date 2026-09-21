const path = require('path');
const crypto = require('crypto');
const express = require('express');

const { readDb, writeDb } = require('./db');
const { CURRENCIES, isSupportedCurrency } = require('./currencies');
const rates = require('./rates');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function computeSummary(db) {
  const baseCurrency = db.settings.baseCurrency;
  const totalsByCurrency = {};

  for (const tx of db.transactions) {
    totalsByCurrency[tx.currency] = (totalsByCurrency[tx.currency] || 0) + tx.amount;
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
    transactionsCount: db.transactions.length,
  };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// --- Справочник валют ---
app.get('/api/currencies', (req, res) => {
  res.json(CURRENCIES);
});

// --- Настройки ---
app.get('/api/settings', (req, res) => {
  const db = readDb();
  res.json(db.settings);
});

app.put('/api/settings', async (req, res) => {
  const { baseCurrency } = req.body || {};
  if (!isSupportedCurrency(baseCurrency)) {
    return res.status(400).json({ error: 'Неподдерживаемая базовая валюта' });
  }
  const db = readDb();
  db.settings.baseCurrency = baseCurrency;
  await writeDb(db);
  res.json(db.settings);
});

// --- Пополнения (история) ---
app.get('/api/transactions', (req, res) => {
  const db = readDb();
  const sorted = [...db.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  res.json(sorted);
});

function parseTransactionInput(body) {
  const { amount, currency, date } = body || {};
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { error: 'Сумма должна быть положительным числом' };
  }
  if (!isSupportedCurrency(currency)) {
    return { error: 'Неподдерживаемая валюта' };
  }
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  return { amount: round2(numericAmount), currency, date: safeDate };
}

app.post('/api/transactions', async (req, res) => {
  const parsed = parseTransactionInput(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const tx = {
    id: crypto.randomUUID(),
    amount: parsed.amount,
    currency: parsed.currency,
    date: parsed.date,
    createdAt: new Date().toISOString(),
  };

  const db = readDb();
  db.transactions.push(tx);
  await writeDb(db);

  res.status(201).json(tx);
});

app.put('/api/transactions/:id', async (req, res) => {
  const parsed = parseTransactionInput(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const db = readDb();
  const tx = db.transactions.find((t) => t.id === req.params.id);
  if (!tx) return res.status(404).json({ error: 'Запись не найдена' });

  tx.amount = parsed.amount;
  tx.currency = parsed.currency;
  tx.date = parsed.date;
  tx.updatedAt = new Date().toISOString();

  await writeDb(db);
  res.json(tx);
});

app.delete('/api/transactions/:id', async (req, res) => {
  const db = readDb();
  const idx = db.transactions.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Запись не найдена' });
  const [removed] = db.transactions.splice(idx, 1);
  await writeDb(db);
  res.json(removed);
});

// --- Сводка (всего накоплено) ---
app.get('/api/summary', (req, res) => {
  const db = readDb();
  res.json(computeSummary(db));
});

// --- Курсы валют ---
app.get('/api/rates', (req, res) => {
  res.json(rates.getSnapshot());
});

app.post('/api/rates/refresh', async (req, res) => {
  await rates.fetchLiveRates();
  res.json(rates.getSnapshot());
});

app.listen(PORT, () => {
  console.log(`\n🐷  Копилка запущена: http://localhost:${PORT}\n`);
  rates.startAutoRefresh();
});
