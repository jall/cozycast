const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const authenticate = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/signup
router.post('/signup', (req, res) => {
  const { email, password, name, invite_code } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password, and name are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  // Validate invite code if provided
  let invite = null;
  if (invite_code) {
    invite = db.prepare('SELECT * FROM invites WHERE code = ? AND used_by IS NULL').get(invite_code);
    if (!invite) {
      return res.status(400).json({ error: 'Invalid or already used invite code' });
    }
  }

  const id = uuidv4();
  const password_hash = bcrypt.hashSync(password, 10);

  const insertUser = db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)');
  insertUser.run(id, email, password_hash, name);

  // If invite code was used, mark it and create bidirectional friendship
  if (invite) {
    const markInvite = db.prepare("UPDATE invites SET used_by = ?, used_at = datetime('now') WHERE code = ?");
    const insertFriendship = db.prepare('INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)');

    const applyInvite = db.transaction(() => {
      markInvite.run(id, invite.code);
      insertFriendship.run(id, invite.creator_id);
      insertFriendship.run(invite.creator_id, id);
    });
    applyInvite();
  }

  const token = jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: '30d' });

  res.status(201).json({ token, user: { id, email, name } });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
