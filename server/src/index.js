require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const friendsRoutes = require('./routes/friends');
const castsRoutes = require('./routes/casts');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve uploaded audio files statically
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/casts', castsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Global error handler for multer and other errors
app.use((err, req, res, next) => {
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.message });
  }
  if (err.message === 'Only audio files are allowed') {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Cozycast server running on port ${PORT}`);
});
