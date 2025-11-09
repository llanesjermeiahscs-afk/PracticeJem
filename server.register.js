// POST /api/register handler (copy of the register section with extra comments)
// Purpose: validate input, hash password, store user in DB safely.
//
// Replace or inspect the register block in server.js to follow along.

app.post('/api/register', (req, res) => {
  // Pull values from request body (express.json parsed it earlier)
  const { email, password, name } = req.body || {};

  // Basic input validation: require email and password.
  // 400 Bad Request means the client didn't send correct/complete data.
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  // Normalize email: trim whitespace and convert to lowercase.
  // Why: prevents duplicate accounts that differ only by case or accidental spaces.
  const normalized = String(email).trim().toLowerCase();

  // Check if a user already exists with this email.
  // Using a parameterized query (the ? placeholder) avoids SQL injection.
  const existing = db.get('SELECT id FROM users WHERE email = ?', [normalized]);
  if (existing) {
    // 409 Conflict indicates the resource already exists.
    return res.status(409).json({ error: 'Email already registered' });
  }

  // Hash the password before storing it.
  // bcrypt.hashSync(password, 10) returns a salted hash; 10 is the cost factor.
  // Why hashing: never store plaintext passwords — hashing + salt protects users if DB leaks.
  const password_hash = bcrypt.hashSync(password, 10);

  // Insert the new user into the database.
  // Again use parameterized query with placeholders to avoid SQL injection.
  const result = db.run(
    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
    [normalized, password_hash, name || null]
  );

  // Retrieve and return only non-sensitive fields (do NOT return password_hash).
  // result.lastInsertRowid gives the new row id in better-sqlite3.
  const user = db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [result.lastInsertRowid]);

  // 201 Created means the resource was created successfully.
  return res.status(201).json({ user });
});