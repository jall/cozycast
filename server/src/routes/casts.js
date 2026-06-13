const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const authenticate = require('../middleware/auth');

const router = express.Router();

// Configure multer for audio uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /^audio\//;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

// All cast routes require authentication
router.use(authenticate);

// POST /api/casts — upload a new cast
router.post('/', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Audio file is required' });
  }

  const { title, description, participants, duration } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const id = uuidv4();
  const audio_path = req.file.filename;

  db.prepare(`
    INSERT INTO casts (id, creator_id, title, description, participants, audio_path, duration)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, title, description || null, participants || null, audio_path, duration ? parseInt(duration, 10) : null);

  res.status(201).json({
    cast: { id, title, description, participants, audio_path, duration: duration ? parseInt(duration, 10) : null, created_at: new Date().toISOString() },
  });
});

// GET /api/casts/feed — casts from friends + own casts, newest first
router.get('/feed', (req, res) => {
  const casts = db.prepare(`
    SELECT c.*, u.name AS creator_name, u.email AS creator_email
    FROM casts c
    JOIN users u ON u.id = c.creator_id
    WHERE c.creator_id = ?
       OR c.creator_id IN (SELECT friend_id FROM friendships WHERE user_id = ?)
    ORDER BY c.created_at DESC
  `).all(req.user.id, req.user.id);

  res.json({ casts });
});

// GET /api/casts/:id — single cast detail
router.get('/:id', (req, res) => {
  const cast = db.prepare(`
    SELECT c.*, u.name AS creator_name, u.email AS creator_email
    FROM casts c
    JOIN users u ON u.id = c.creator_id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!cast) {
    return res.status(404).json({ error: 'Cast not found' });
  }

  // Verify the requester is the creator or a friend of the creator
  if (cast.creator_id !== req.user.id) {
    const friendship = db.prepare(
      'SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?'
    ).get(req.user.id, cast.creator_id);
    if (!friendship) {
      return res.status(403).json({ error: 'You do not have access to this cast' });
    }
  }

  res.json({ cast });
});

// GET /api/casts/:id/audio — stream the audio file
router.get('/:id/audio', (req, res) => {
  const cast = db.prepare('SELECT * FROM casts WHERE id = ?').get(req.params.id);

  if (!cast) {
    return res.status(404).json({ error: 'Cast not found' });
  }

  // Verify access
  if (cast.creator_id !== req.user.id) {
    const friendship = db.prepare(
      'SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?'
    ).get(req.user.id, cast.creator_id);
    if (!friendship) {
      return res.status(403).json({ error: 'You do not have access to this cast' });
    }
  }

  const filePath = path.join(__dirname, '..', '..', 'uploads', cast.audio_path);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Audio file not found' });
  }

  res.sendFile(filePath);
});

module.exports = router;
