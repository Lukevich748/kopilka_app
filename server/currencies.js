// Справочник валют: код, название, символ, флаг-эмодзи и курс к базовой
// расчётной единице (USD). Курсы приблизительные и нужны только для того,
// чтобы посчитать сводный "итого" по всем валютам сразу — при желании их
// можно поправить вручную, отредактировав этот файл.
const CURRENCIES = [
  { code: 'USD', name: 'Доллар США', symbol: '$', flag: '🇺🇸', rateToUSD: 1 },
  { code: 'EUR', name: 'Евро', symbol: '€', flag: '🇪🇺', rateToUSD: 1.08 },
  { code: 'RUB', name: 'Российский рубль', symbol: '₽', flag: '🇷🇺', rateToUSD: 0.0107 },
  { code: 'GBP', name: 'Фунт стерлингов', symbol: '£', flag: '🇬🇧', rateToUSD: 1.27 },
  { code: 'UAH', name: 'Украинская гривна', symbol: '₴', flag: '🇺🇦', rateToUSD: 0.024 },
  { code: 'KZT', name: 'Казахстанский тенге', symbol: '₸', flag: '🇰🇿', rateToUSD: 0.0019 },
  { code: 'CNY', name: 'Китайский юань', symbol: '¥', flag: '🇨🇳', rateToUSD: 0.139 },
  { code: 'JPY', name: 'Японская иена', symbol: '¥', flag: '🇯🇵', rateToUSD: 0.0068 },
  { code: 'CHF', name: 'Швейцарский франк', symbol: 'Fr', flag: '🇨🇭', rateToUSD: 1.13 },
  { code: 'TRY', name: 'Турецкая лира', symbol: '₺', flag: '🇹🇷', rateToUSD: 0.029 },
  { code: 'AUD', name: 'Австралийский доллар', symbol: 'A$', flag: '🇦🇺', rateToUSD: 0.66 },
  { code: 'GEL', name: 'Грузинский лари', symbol: '₾', flag: '🇬🇪', rateToUSD: 0.37 },
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
