// Справочник валют: код, название, символ, флаг-эмодзи и курс к базовой
// расчётной единице (USD). Курсы приблизительные и нужны только для того,
// чтобы посчитать сводный "итого" по всем валютам сразу — при желании их
// можно поправить вручную, отредактировав этот файл.
const CURRENCIES = [
  { code: 'USD', name: 'Доллар США', symbol: '$', flag: '🇺🇸', rateToUSD: 1 },
  { code: 'EUR', name: 'Евро', symbol: '€', flag: '🇪🇺', rateToUSD: 1.08 },
];

const CURRENCY_MAP = new Map(CURRENCIES.map((c) => [c.code, c]));

function isSupportedCurrency(code) {
  return CURRENCY_MAP.has(code);
}

function getCurrency(code) {
  return CURRENCY_MAP.get(code);
}

function convert(amount, fromCode, toCode) {
  const from = getCurrency(fromCode);
  const to = getCurrency(toCode);
  if (!from || !to) return null;
  const inUSD = amount * from.rateToUSD;
  return inUSD / to.rateToUSD;
}

module.exports = { CURRENCIES, isSupportedCurrency, getCurrency, convert };
