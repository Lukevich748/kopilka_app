// Vercel-функция: подключает готовый Express-app без .listen() — Vercel сам
// оборачивает его в serverless-обработчик запроса.
module.exports = require('../server/app');
