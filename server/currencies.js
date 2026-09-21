// Справочник поддерживаемых валют (метаданные без курса — актуальный курс
// подтягивается отдельно в rates.js).
const CURRENCIES = [
  { code: 'USD', name: 'Доллар США', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Евро', symbol: '€', flag: '🇪🇺' },
  { code: 'PLN', name: 'Польский злотый', symbol: 'zł', flag: '🇵🇱' },
  { code: 'RUB', name: 'Российский рубль', symbol: '₽', flag: '🇷🇺' },
  { code: 'BYN', name: 'Белорусский рубль', symbol: 'Br', flag: '🇧🇾' },
];

const CURRENCY_MAP = new Map(CURRENCIES.map((c) => [c.code, c]));

function isSupportedCurrency(code) {
  return CURRENCY_MAP.has(code);
}

function getCurrency(code) {
  return CURRENCY_MAP.get(code);
}

module.exports = { CURRENCIES, isSupportedCurrency, getCurrency };
