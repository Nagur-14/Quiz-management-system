const express = require('express');
const Result = require('../models/Result');
const Quiz = require('../models/Quiz');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// GET /api/results - every past game session hosted by this admin, most recent first
router.get('/', async (req, res) => {
  const results = await Result.find({ hostedBy: req.admin.id }).sort({ endedAt: -1 }).limit(100);
  res.json(results);
});

// GET /api/results/stats - simple dashboard summary numbers
router.get('/stats', async (req, res) => {
  const [quizCount, results] = await Promise.all([
    Quiz.countDocuments({ createdBy: req.admin.id }),
    Result.find({ hostedBy: req.admin.id }),
  ]);

  const sessionsHosted = results.length;
  const playersReached = results.reduce((sum, r) => sum + r.teams.length, 0);

  res.json({ quizCount, sessionsHosted, playersReached });
});

module.exports = router;
