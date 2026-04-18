const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'watercompany.db');

let wrapper;

function saveToDisk() {
  if (wrapper) {
    const data = wrapper._db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

// Mimics better-sqlite3 prepared-statement API
class PreparedStatement {
  constructor(db, sql) {
    this._db = db;
    this._sql = sql;
  }

  run(...params) {
    this._db.run(this._sql, params);
    const rows = this._db.exec('SELECT last_insert_rowid()');
    const lastInsertRowid = rows.length ? rows[0].values[0][0] : 0;
    const changes = this._db.getRowsModified();
    saveToDisk();
    return { lastInsertRowid, changes };
  }

  get(...params) {
    const stmt = this._db.prepare(this._sql);
    stmt.bind(params);
    let result = null;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  }

  all(...params) {
    const stmt = this._db.prepare(this._sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
}

// Mimics better-sqlite3 database API
class DatabaseWrapper {
  constructor(db) {
    this._db = db;
  }

  prepare(sql) {
    return new PreparedStatement(this._db, sql);
  }

  exec(sql) {
    this._db.exec(sql);
    saveToDisk();
  }

  pragma(str) {
    try {
      this._db.run('PRAGMA ' + str);
    } catch (_) {
      // sql.js may not support all pragmas
    }
  }
}

function initTables() {
  wrapper.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      connection_type TEXT NOT NULL,
      property_type TEXT NOT NULL,
      property_address TEXT NOT NULL,
      meter_number TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_remarks TEXT,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
}

function seedAdmin() {
  const existing = wrapper.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!existing) {
    const hash = bcrypt.hashSync('admin123', 10);
    wrapper.prepare(
      'INSERT INTO users (full_name, email, phone, address, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('System Admin', 'admin@waterco.com', '0000000000', 'Head Office', hash, 'admin');
    console.log('Default admin created: admin@waterco.com / admin123');
  }
}

async function initDb() {
  const SQL = await initSqlJs();
  let db;
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  wrapper = new DatabaseWrapper(db);
  wrapper.pragma('foreign_keys = ON');
  initTables();
  seedAdmin();
}

function getDb() {
  if (!wrapper) throw new Error('Database not initialized. Call initDb() first.');
  return wrapper;
}

module.exports = { initDb, getDb };
