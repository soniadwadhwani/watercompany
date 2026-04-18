const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const { initDb, getDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 },
  })
);

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// ─── Auth Routes ────────────────────────────────────────────

app.post('/api/register', async (req, res) => {
  try {
    const { full_name, email, phone, address, password } = req.body;
    if (!full_name || !email || !phone || !address || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      'INSERT INTO users (full_name, email, phone, address, password_hash) VALUES (?, ?, ?, ?, ?)'
    ).run(full_name, email, phone, address, hash);

    req.session.userId = result.lastInsertRowid;
    req.session.role = 'customer';
    res.json({ message: 'Registration successful', role: 'customer' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ message: 'Login successful', role: user.role, name: user.full_name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out' });
});

app.get('/api/me', requireAuth, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, full_name, email, phone, address, role, created_at FROM users WHERE id = ?').get(req.session.userId);
  res.json(user);
});

// ─── Connection Routes (Customer) ───────────────────────────

app.post('/api/connections', requireAuth, (req, res) => {
  const { connection_type, property_type, property_address } = req.body;
  if (!connection_type || !property_type || !property_address) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO connections (user_id, connection_type, property_type, property_address) VALUES (?, ?, ?, ?)'
  ).run(req.session.userId, connection_type, property_type, property_address);

  res.json({ message: 'Connection application submitted', id: result.lastInsertRowid });
});

app.get('/api/connections', requireAuth, (req, res) => {
  const db = getDb();
  const connections = db.prepare(
    'SELECT * FROM connections WHERE user_id = ? ORDER BY applied_at DESC'
  ).all(req.session.userId);
  res.json(connections);
});

// ─── Admin Routes ───────────────────────────────────────────

app.get('/api/admin/registrations', requireAdmin, (req, res) => {
  const db = getDb();
  const users = db.prepare(
    "SELECT id, full_name, email, phone, address, created_at FROM users WHERE role = 'customer' ORDER BY created_at DESC"
  ).all();
  res.json(users);
});

app.get('/api/admin/connections', requireAdmin, (req, res) => {
  const db = getDb();
  const connections = db.prepare(`
    SELECT c.*, u.full_name, u.email, u.phone
    FROM connections c
    JOIN users u ON u.id = c.user_id
    ORDER BY c.applied_at DESC
  `).all();
  res.json(connections);
});

app.patch('/api/admin/connections/:id', requireAdmin, (req, res) => {
  const { status, admin_remarks } = req.body;
  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved or rejected' });
  }

  const db = getDb();
  const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(req.params.id);
  if (!conn) return res.status(404).json({ error: 'Connection not found' });

  let meterNumber = null;
  if (status === 'approved') {
    meterNumber = 'WC-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  db.prepare(
    'UPDATE connections SET status = ?, admin_remarks = ?, meter_number = COALESCE(?, meter_number), processed_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(status, admin_remarks || null, meterNumber, req.params.id);

  res.json({ message: `Connection ${status}`, meter_number: meterNumber });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const db = getDb();
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'").get().count;
  const totalConnections = db.prepare('SELECT COUNT(*) as count FROM connections').get().count;
  const pending = db.prepare("SELECT COUNT(*) as count FROM connections WHERE status = 'pending'").get().count;
  const approved = db.prepare("SELECT COUNT(*) as count FROM connections WHERE status = 'approved'").get().count;
  const rejected = db.prepare("SELECT COUNT(*) as count FROM connections WHERE status = 'rejected'").get().count;
  res.json({ totalUsers, totalConnections, pending, approved, rejected });
});

// ─── SPA fallback ───────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ──────────────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Water Company server running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
