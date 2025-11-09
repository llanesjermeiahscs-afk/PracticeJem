// Enhanced register handler with extra validation
app.post('/api/register', (req, res) => {
  const { email, password, name } = req.body || {};

  // Basic presence checks
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const normalized = String(email).trim().toLowerCase();

  // Extra validation: simple email format check and password length
  if (!normalized.includes('@')) return res.status(400).json({ error: 'invalid email format' });
  if (String(password).length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

  const existing = db.get('SELECT id FROM users WHERE email = ?', [normalized]);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.run(
    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
    [normalized, password_hash, name || null]
  );
  const user = db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [result.lastInsertRowid]);
  return res.status(201).json({ user });
});