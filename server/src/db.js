const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'cozycast.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS friendships (
    user_id TEXT NOT NULL REFERENCES users(id),
    friend_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, friend_id)
  );

  CREATE TABLE IF NOT EXISTS invites (
    code TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES users(id),
    used_by TEXT REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    used_at TEXT
  );

  CREATE TABLE IF NOT EXISTS casts (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT,
    participants TEXT,
    audio_path TEXT NOT NULL,
    duration INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

module.exports = db;
