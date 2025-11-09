// migrations/migrate-add-done.js
// Purpose: safely add a 'done' column to the todos table if it doesn't exist.
// Why: SQLite supports ALTER TABLE ADD COLUMN; we check existing columns first to avoid errors.
// Usage: node migrations/migrate-add-done.js

const db = require('../db')._raw; // raw better-sqlite3 Database object
// Get table info for 'todos'
const info = db.prepare(`PRAGMA table_info('todos')`).all();
// Check if 'done' column present
const hasDone = info.some(col => col.name === 'done');

if (hasDone) {
  console.log("Migration skipped: 'done' column already exists.");
  process.exit(0);
}

// Add the new column with default 0 (false)
db.prepare(`ALTER TABLE todos ADD COLUMN done INTEGER DEFAULT 0`).run();
console.log("Migration complete: 'done' column added to todos.");