const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All friend routes require authentication
router.use(authenticate);

// GET /api/friends — list current user's friends
router.get('/', (req, res) => {
  const friends = db.prepare(`
    SELECT u.id, u.email, u.name, u.created_at
    FROM friendships f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(req.user.id);

  res.json({ friends });
});

// POST /api/friends/invite — generate a 6-char alphanumeric invite code
router.post('/invite', (req, res) => {
  const code = crypto.randomBytes(4).toString('base64url').slice(0, 6).toUpperCase();

  db.prepare('INSERT INTO invites (code, creator_id) VALUES (?, ?)').run(code, req.user.id);

  res.status(201).json({ code });
});

// GET /api/friends/invites — list my pending (unused) invite codes
router.get('/invites', (req, res) => {
  const invites = db.prepare(`
    SELECT code, created_at, used_by, used_at
    FROM invites
    WHERE creator_id = ? AND used_by IS NULL
    ORDER BY created_at DESC
  `).all(req.user.id);

  res.json({ invites });
});

module.exports = router;
