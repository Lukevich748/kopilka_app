// Живые курсы валют: подтягиваем актуальные данные с Frankfurter (ECB) и
// держим их в памяти, чтобы пересчёт "всего накоплено" был точным, а не по
// зашитым в код цифрам. Если сети нет (или API недоступен) — используем
// приблизительный резервный курс, чтобы приложение не падало.
const { CURRENCIES } = require('./currencies');

const RATES_API_URL = 'https://api.frankfurter.app/latest?from=USD';
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // раз в 6 часов
const FETCH_TIMEOUT_MS = 8000;

// Курс = сколько USD стоит 1 единица валюты. Используется, пока не подтянулись
// живые данные, и как последний резерв, если API недоступен. Frankfurter (ECB)
// не публикует курс для RUB и BYN, поэтому для них всегда используется это
// приблизительное значение — это не баг, а ограничение источника данных.
const FALLBACK_RATES_TO_USD = {
  USD: 1,
  EUR: 1.08,
  PLN: 0.25,
  RUB: 0.0107,
  BYN: 0.31,
};

const state = {
  ratesToUSD: { ...FALLBACK_RATES_TO_USD },
  updatedAt: null,
  source: 'fallback', // 'live' | 'fallback'
  lastError: null,
};

function getRateToUSD(code) {
  return state.ratesToUSD[code] ?? FALLBACK_RATES_TO_USD[code] ?? null;
}

function convert(amount, fromCode, toCode) {
  const fromRate = getRateToUSD(fromCode);
  const toRate = getRateToUSD(toCode);
  if (fromRate == null || toRate == null) return null;
  return (amount * fromRate) / toRate;
}

// На serverless-хостингах (Vercel) фоновый setInterval ненадёжен — функция
// "замораживается" между вызовами. Поэтому перед тем, как курсы понадобятся
// для ответа, проверяем их возраст и при необходимости подтягиваем свежие
// прямо в рамках запроса.
async function ensureFreshRates() {
  const age = state.updatedAt ? Date.now() - new Date(state.updatedAt).getTime() : Infinity;
  if (age > REFRESH_INTERVAL_MS) {
    await fetchLiveRates();
  }
}

function getSnapshot() {
  return {
    updatedAt: state.updatedAt,
    source: state.source,
    lastError: state.lastError,
    rates: CURRENCIES.map((c) => ({
      code: c.code,
      name: c.name,
      symbol: c.symbol,
      flag: c.flag,
      rateToUSD: getRateToUSD(c.code),
    })),
  };
}

async function fetchLiveRates() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(RATES_API_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`API ответил статусом ${res.status}`);

    const data = await res.json();
    if (!data || typeof data.rates !== 'object') throw new Error('Неожиданный формат ответа');

    const next = { USD: 1 };
    for (const currency of CURRENCIES) {
      if (currency.code === 'USD') continue;
      const unitsPerUSD = data.rates[currency.code]; // сколько единиц валюты за 1 USD
      if (typeof unitsPerUSD === 'number' && unitsPerUSD > 0) {
        next[currency.code] = 1 / unitsPerUSD;
      }
    }

    state.ratesToUSD = { ...FALLBACK_RATES_TO_USD, ...next };
    state.updatedAt = new Date().toISOString();
    state.source = 'live';
    state.lastError = null;
    return true;
  } catch (err) {
    state.lastError = err.name === 'AbortError' ? 'Превышено время ожидания ответа' : err.message;
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function startAutoRefresh() {
  fetchLiveRates();
  setInterval(fetchLiveRates, REFRESH_INTERVAL_MS);
}

module.exports = { getRateToUSD, convert, getSnapshot, fetchLiveRates, startAutoRefresh, ensureFreshRates };
