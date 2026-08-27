require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const quizRoutes = require('./routes/quizRoutes');
const resultsRoutes = require('./routes/resultsRoutes');
const initGameSockets = require('./sockets/gameManager');

const app = express();
const server = http.createServer(app);

const origin = process.env.CLIENT_ORIGIN && process.env.CLIENT_ORIGIN !== '*'
  ? process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim())
  : '*';

const io = new Server(server, {
  cors: { origin, methods: ['GET', 'POST'] },
});

app.use(cors({ origin }));
app.use(express.json());

// --- API routes ---
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/results', resultsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// --- Serve the static frontend (plain HTML/CSS/JS) ---
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Any non-API route falls back to index.html so deep links still load the app shell.
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// --- Real-time game engine ---
initGameSockets(io);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Quiz app server listening on port ${PORT}`);
  });
});
