// db.js: initialize and provide simple helpers for SQLite (better-sqlite3 synchronous API)
// Modified for tests: honor process.env.DB_FILE, and if DB_FILE === ':memory:' do NOT create ./data dir
// so in-memory DB works in CI/tests. Tables include `done` column so migrations are not required for tests.
//
// Why this change:
// - Tests need an isolated DB (in-memory) to avoid interfering with local dev DB files.
// - Creating tables with done column up-front simplifies test setup and keeps behavior consistent.

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Determine DB file from env or default to ./data/dev.db
const dbFile = process.env.DB_FILE || path.join(__dirname, 'data', 'dev.db');

// If using file-based DB and data dir doesn't exist, create it.
// If using ':memory:' we must avoid creating a file path.
if (dbFile !== ':memory:') {
  const dataDir = path.resolve(path.dirname(dbFile));
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

// Connect to SQLite file (or in-memory) using better-sqlite3
const db = new Database(dbFile);

// Create users table and todos table with `done` column present by default.
// We use IF NOT EXISTS so repeated test runs / file DBs are safe.
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`).run();

// Export a small set of helpers similar to before. Keep raw DB export for advanced usage.
module.exports = {
  get: (sql, params = []) => db.prepare(sql).get(...params),
  all: (sql, params = []) => db.prepare(sql).all(...params),
  run: (sql, params = []) => db.prepare(sql).run(...params),
  _raw: db
};