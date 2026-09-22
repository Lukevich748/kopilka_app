// Доступ к данным через Supabase (Postgres) вместо локального JSON-файла —
// нужно для работы на serverless-хостингах (Vercel), где диск не сохраняется
// между вызовами функции. Схема таблиц — в supabase/schema.sql.
const supabase = require('./supabase');

const DEFAULT_SETTINGS = {
  baseCurrency: 'USD',
  enabledCurrencies: ['USD', 'EUR', 'PLN', 'RUB', 'BYN'],
};

function rowToTx(row) {
  return {
    id: row.id,
    amount: Number(row.amount),
    currency: row.currency,
    type: row.type,
    date: row.date,
    comment: row.comment || '',
    createdAt: row.created_at,
    ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
  };
}

async function getSettings() {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  if (!data) return { ...DEFAULT_SETTINGS };
  return { baseCurrency: data.base_currency, enabledCurrencies: data.enabled_currencies };
}

async function saveSettings(settings) {
  const { error } = await supabase.from('settings').upsert({
    id: 1,
    base_currency: settings.baseCurrency,
    enabled_currencies: settings.enabledCurrencies,
  });
  if (error) throw error;
}

async function listTransactions() {
  const { data, error } = await supabase.from('transactions').select('*');
  if (error) throw error;
  return data.map(rowToTx);
}

async function getTransaction(id) {
  const { data, error } = await supabase.from('transactions').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToTx(data) : null;
}

async function insertTransaction(tx) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      amount: tx.amount,
      currency: tx.currency,
      type: tx.type,
      date: tx.date,
      comment: tx.comment,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToTx(data);
}

async function updateTransaction(id, tx) {
  const { data, error } = await supabase
    .from('transactions')
    .update({
      amount: tx.amount,
      currency: tx.currency,
      type: tx.type,
      date: tx.date,
      comment: tx.comment,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? rowToTx(data) : null;
}

async function deleteTransaction(id) {
  const { data, error } = await supabase.from('transactions').delete().eq('id', id).select().maybeSingle();
  if (error) throw error;
  return data ? rowToTx(data) : null;
}

module.exports = {
  getSettings,
  saveSettings,
  listTransactions,
  getTransaction,
  insertTransaction,
  updateTransaction,
  deleteTransaction,
};
