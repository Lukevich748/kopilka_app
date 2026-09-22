// Клиент Supabase (Postgres) — на serverless-платформах вроде Vercel файловая
// система эфемерна, поэтому вместо локального data/db.json данные хранятся
// во внешней базе. URL и ключ передаются через переменные окружения и
// никогда не должны попадать в репозиторий.
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Не заданы переменные окружения SUPABASE_URL и/или SUPABASE_SERVICE_ROLE_KEY. ' +
      'Смотрите .env.example.'
  );
}

// Service-role ключ используется только на сервере (в serverless-функциях),
// в браузер он не попадает — поэтому Row Level Security можно не настраивать.
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

module.exports = supabase;
