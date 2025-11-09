// app.js: Express application (refactored from server.js)
// Purpose: export the configured Express app so tests can import it without starting a listener.
// server.js will import this file and actually start listening in production/dev.
//
// Why this refactor:
// - Tests can import app and use Supertest without starting a real network listener.
// - Separation of app configuration and server startup improves testability and clarity.

require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { body, param, validationResult } = require('express-validator');
const db = require('./db');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Standard middleware
app.use(express.json());
app.use(cookieParser());

// Serve static files only when running in non-test environments; tests don't need static assets
if (process.env.NODE_ENV !== 'test') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// Ensure uploads directory exists and configure multer
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safe = file.originalname.replace(/[^a-z0-9.\-_-]/gi, '_');
    cb(null, `${unique}-${safe}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// --- helpers for validation formatting ---
function formatValidationErrors(result) {
  return result.array().map(err => ({ field: err.param || 'body', message: err.msg }));
}
function validateRequest(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({ message: 'Validation failed', errors: formatValidationErrors(result) });
  }
  next();
}

// --- auth helpers ---
function setAuthCookie(res, user) {
  const payload = { sub: user.id, email: user.email };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  // httpOnly cookie is safer vs XSS because JS cannot read it
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 15 * 60 * 1000 });
  return token;
}
function authenticateJWT(req, res, next) {
  try {
    let token = null;
    if (req.cookies && req.cookies.token) token = req.cookies.token;
    else if (req.headers && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') token = parts[1];
    }
    if (!token) return res.status(401).json({ message: 'Missing token' });

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// -------------------- Routes --------------------

// Register
app.post(
  '/api/register',
  [
    body('email').exists().withMessage('email is required').bail()
      .isEmail().withMessage('email must be a valid email address')
      .trim().normalizeEmail(),
    body('password').exists().withMessage('password is required').bail()
      .isLength({ min: 8 }).withMessage('password must be at least 8 characters'),
    body('name').optional().trim().escape()
  ],
  validateRequest,
  (req, res) => {
    const { email, password, name } = req.body;
    const normalized = String(email).toLowerCase();
    const existing = db.get('SELECT id FROM users WHERE email = ?', [normalized]);
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    const password_hash = bcrypt.hashSync(password, 10);
    const result = db.run('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)', [normalized, password_hash, name || null]);
    const user = db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [result.lastInsertRowid]);
    return res.status(201).json({ user });
  }
);

// Login
app.post(
  '/api/login',
  [
    body('email').exists().withMessage('email is required').bail().isEmail().withMessage('email must be valid').trim().normalizeEmail(),
    body('password').exists().withMessage('password is required')
  ],
  validateRequest,
  (req, res) => {
    const { email, password } = req.body;
    const normalized = String(email).toLowerCase();
    const user = db.get('SELECT id, email, password_hash, name FROM users WHERE email = ?', [normalized]);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = setAuthCookie(res, user);
    return res.json({ message: 'Logged in', token });
  }
);

// Me
app.get('/api/me', authenticateJWT, (req, res) => {
  const userId = req.user && req.user.id;
  const user = db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [userId]);
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json({ user });
});

// Create todo
app.post(
  '/api/todos',
  authenticateJWT,
  [
    body('text').exists().withMessage('text is required').bail()
      .isLength({ min: 1 }).withMessage('text cannot be empty').trim().escape()
  ],
  validateRequest,
  (req, res) => {
    const userId = req.user.id;
    const { text } = req.body;
    const result = db.run('INSERT INTO todos (user_id, text, done) VALUES (?, ?, ?)', [userId, text, 0]);
    const todo = db.get('SELECT id, text, created_at, done FROM todos WHERE id = ?', [result.lastInsertRowid]);
    todo.done = !!todo.done;
    return res.status(201).json({ todo });
  }
);

// -------------------- Rentals feed & interactions --------------------

// Get feed: list recent rentals with owner, images, likes count and recent comments
app.get('/api/feed', (req, res) => {
  // Support pagination: ?offset=0&limit=10
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 8, 1), 50);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);

  const rows = db.all(
    `SELECT r.id, r.title, r.description, r.price, r.location, r.images, r.owner_id, r.created_at, u.name as owner_name
     FROM rentals r
     JOIN users u ON r.owner_id = u.id
     ORDER BY r.id DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  const totalRow = db.get('SELECT COUNT(*) as count FROM rentals');
  const total = totalRow ? totalRow.count : 0;

  const feed = rows.map(r => {
    let images = [];
    try { images = JSON.parse(r.images || '[]'); } catch (e) { images = []; }
    const comments = db.all(`SELECT c.id, c.text, c.created_at, u.name as user_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.rental_id = ? ORDER BY c.id ASC LIMIT 5`, [r.id]);
    const likesCountRow = db.get('SELECT COUNT(*) as count FROM likes WHERE rental_id = ?', [r.id]);
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      price: r.price,
      location: r.location,
      images,
      owner: { id: r.owner_id, name: r.owner_name },
      created_at: r.created_at,
      comments,
      likes: likesCountRow ? likesCountRow.count : 0
    };
  });

  const hasMore = offset + rows.length < total;
  return res.json({ feed, offset, limit, total, hasMore });
});

// Create a rental post (owner must be authenticated)
app.post('/api/rentals', authenticateJWT, upload.array('images', 6), [
  body('title').exists().withMessage('title is required').bail().isLength({ min: 1 }).withMessage('title cannot be empty').trim().escape(),
  body('description').optional().trim().escape(),
  body('price').optional().isNumeric().withMessage('price must be a number'),
  body('location').optional().trim().escape()
], validateRequest, (req, res) => {
  const ownerId = req.user.id;
  const { title, description, price, location } = req.body;
  const files = req.files || [];
  const filenames = files.map(f => `/uploads/${path.basename(f.path)}`);
  const imagesJSON = JSON.stringify(filenames);

  const result = db.run('INSERT INTO rentals (owner_id, title, description, price, location, images) VALUES (?, ?, ?, ?, ?, ?)', [ownerId, title, description || null, price ? Number(price) : null, location || null, imagesJSON]);
  const rental = db.get('SELECT id, title, description, price, location, images, created_at FROM rentals WHERE id = ?', [result.lastInsertRowid]);
  rental.images = JSON.parse(rental.images || '[]');
  return res.status(201).json({ rental });
});

// Get rental detail
app.get('/api/rentals/:id', [ param('id').isInt({ gt: 0 }).withMessage('id must be a positive integer') ], validateRequest, (req, res) => {
  const id = Number(req.params.id);
  const r = db.get('SELECT r.*, u.name as owner_name FROM rentals r JOIN users u ON r.owner_id = u.id WHERE r.id = ?', [id]);
  if (!r) return res.status(404).json({ message: 'Rental not found' });
  try { r.images = JSON.parse(r.images || '[]'); } catch (e) { r.images = []; }
  const comments = db.all('SELECT c.id, c.text, c.created_at, u.name as user_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.rental_id = ? ORDER BY c.id ASC', [id]);
  const likesCountRow = db.get('SELECT COUNT(*) as count FROM likes WHERE rental_id = ?', [id]);
  return res.json({ rental: { ...r, comments, likes: likesCountRow ? likesCountRow.count : 0 } });
});

// Add a comment to a rental
app.post('/api/rentals/:id/comments', authenticateJWT, [ param('id').isInt({ gt: 0 }).withMessage('id must be a positive integer'), body('text').exists().withMessage('text is required').bail().isLength({ min: 1 }).withMessage('text cannot be empty').trim().escape() ], validateRequest, (req, res) => {
  const rentalId = Number(req.params.id);
  const userId = req.user.id;
  const { text } = req.body;
  const exists = db.get('SELECT id FROM rentals WHERE id = ?', [rentalId]);
  if (!exists) return res.status(404).json({ message: 'Rental not found' });
  const result = db.run('INSERT INTO comments (rental_id, user_id, text) VALUES (?, ?, ?)', [rentalId, userId, text]);
  const comment = db.get('SELECT c.id, c.text, c.created_at, u.name as user_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?', [result.lastInsertRowid]);
  return res.status(201).json({ comment });
});

// Toggle like (feedback) on a rental
app.post('/api/rentals/:id/like', authenticateJWT, [ param('id').isInt({ gt: 0 }).withMessage('id must be a positive integer') ], validateRequest, (req, res) => {
  const rentalId = Number(req.params.id);
  const userId = req.user.id;
  const exists = db.get('SELECT id FROM rentals WHERE id = ?', [rentalId]);
  if (!exists) return res.status(404).json({ message: 'Rental not found' });
  const liked = db.get('SELECT id FROM likes WHERE rental_id = ? AND user_id = ?', [rentalId, userId]);
  if (liked) {
    db.run('DELETE FROM likes WHERE id = ?', [liked.id]);
    return res.json({ liked: false });
  }
  db.run('INSERT INTO likes (rental_id, user_id) VALUES (?, ?)', [rentalId, userId]);
  return res.json({ liked: true });
});

// List todos
app.get('/api/todos', authenticateJWT, (req, res) => {
  const userId = req.user.id;
  const todos = db.all('SELECT id, text, created_at, done FROM todos WHERE user_id = ? ORDER BY id DESC', [userId]);
  const normalized = todos.map(t => ({ ...t, done: !!t.done }));
  return res.json({ todos: normalized });
});

// Patch todo
app.patch(
  '/api/todos/:id',
  authenticateJWT,
  [
    param('id').isInt({ gt: 0 }).withMessage('id must be a positive integer'),
    body('text').optional().isLength({ min: 1 }).withMessage('text cannot be empty').trim().escape(),
    body('done').optional().isBoolean().withMessage('done must be a boolean')
  ],
  validateRequest,
  (req, res) => {
    const userId = req.user.id;
    const todoId = Number(req.params.id);
    const todo = db.get('SELECT id, user_id, text, done FROM todos WHERE id = ?', [todoId]);
    if (!todo) return res.status(404).json({ message: 'Todo not found' });
    if (todo.user_id !== userId) return res.status(403).json({ message: 'Not authorized to modify this todo' });

    const { text, done } = req.body;
    const updates = [];
    const params = [];
    if (typeof text !== 'undefined') {
      updates.push('text = ?');
      params.push(String(text));
    }
    if (typeof done !== 'undefined') {
      updates.push('done = ?');
      params.push(done ? 1 : 0);
    }
    if (updates.length === 0) return res.status(400).json({ message: 'Nothing to update' });

    params.push(todoId);
    const sql = `UPDATE todos SET ${updates.join(', ')} WHERE id = ?`;
    db.run(sql, params);
    const updated = db.get('SELECT id, text, created_at, done FROM todos WHERE id = ?', [todoId]);
    updated.done = !!updated.done;
    return res.json({ todo: updated });
  }
);

// Delete todo
app.delete(
  '/api/todos/:id',
  authenticateJWT,
  [ param('id').isInt({ gt: 0 }).withMessage('id must be a positive integer') ],
  validateRequest,
  (req, res) => {
    const userId = req.user.id;
    const todoId = Number(req.params.id);
    const todo = db.get('SELECT id, user_id FROM todos WHERE id = ?', [todoId]);
    if (!todo) return res.status(404).json({ message: 'Todo not found' });
    if (todo.user_id !== userId) return res.status(403).json({ message: 'Not authorized to delete this todo' });

    db.run('DELETE FROM todos WHERE id = ?', [todoId]);
    return res.json({ message: 'Deleted' });
  }
);

// Global error handler so unexpected errors return consistent JSON in tests and UI
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  res.status(500).json({ message: 'Internal server error' });
});

module.exports = app;