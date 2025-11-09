// view-users.js — small helper to show rows from users table for practice
// Run: node view-users.js
// NOTE: This is only for local practice; do NOT add similar tooling to production.

const db = require('./db'); // reuses the db.js helper
const rows = db.all('SELECT id, email, name, created_at FROM users ORDER BY id DESC');
console.log('Users:');
rows.forEach(r => console.log(r));