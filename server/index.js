// Точка входа для локального запуска (npm start / npm run dev) — постоянно
// работающий процесс с обычным app.listen(). На Vercel этот файл не
// используется: там serverless-функция api/index.js напрямую подключает
// server/app.js без .listen().
try {
  require('dotenv').config();
} catch {
  // dotenv не обязателен: если переменные окружения уже заданы иначе
  // (например, экспортированы в shell), приложение всё равно запустится.
}

const app = require('./app');
const rates = require('./rates');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🐷  Копилка запущена: http://localhost:${PORT}\n`);
  rates.startAutoRefresh();
});
