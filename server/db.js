const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const DEFAULT_DATA = {
  settings: { baseCurrency: 'USD' },
  transactions: [],
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DATA, null, 2));
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return {
      settings: { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) },
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

// Единая очередь записи, чтобы параллельные запросы не затирали друг друга
// при записи в файл (это не БД с транзакциями, а простой JSON-файл).
let writeQueue = Promise.resolve();

function writeDb(data) {
  writeQueue = writeQueue.then(
    () =>
      new Promise((resolve, reject) => {
        const tmpPath = `${DB_PATH}.tmp`;
        fs.writeFile(tmpPath, JSON.stringify(data, null, 2), (err) => {
          if (err) return reject(err);
          fs.rename(tmpPath, DB_PATH, (err2) => (err2 ? reject(err2) : resolve()));
        });
      })
  );
  return writeQueue;
}

module.exports = { readDb, writeDb };
