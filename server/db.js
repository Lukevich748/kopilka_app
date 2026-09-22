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

async function countUsers() {
  const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

async function createUser({ username, passwordHash }) {
  const { data, error } = await supabase
    .from('users')
    .insert({ username, password_hash: passwordHash })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Такой логин уже занят');
    throw error;
  }
  return data;
}

async function getUserByUsername(username) {
  const { data, error } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
  if (error) throw error;
  return data;
}

async function createSession({ token, userId, expiresAt }) {
  const { error } = await supabase.from('sessions').insert({ token, user_id: userId, expires_at: expiresAt });
  if (error) throw error;
}

async function getValidSession(token) {
  const { data, error } = await supabase.from('sessions').select('*').eq('token', token).maybeSingle();
  if (error) throw error;
  if (!data || new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}

async function deleteSession(token) {
  const { error } = await supabase.from('sessions').delete().eq('token', token);
  if (error) throw error;
}

module.exports = {
  getSettings,
  saveSettings,
  listTransactions,
  getTransaction,
  insertTransaction,
  updateTransaction,
  deleteTransaction,
  countUsers,
  createUser,
  getUserByUsername,
  createSession,
  getValidSession,
  deleteSession,
};
