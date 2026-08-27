const express = require('express');
const Quiz = require('../models/Quiz');
const Result = require('../models/Result');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// All quiz management routes require a logged-in host/admin.
router.use(requireAuth);

// GET /api/quizzes - list quizzes created by the logged-in admin
router.get('/', async (req, res) => {
  const quizzes = await Quiz.find({ createdBy: req.admin.id })
    .select('title description coverColor questions isPublished timesHosted createdAt updatedAt')
    .sort({ updatedAt: -1 });

  const withCounts = quizzes.map((q) => ({
    _id: q._id,
    title: q.title,
    description: q.description,
    coverColor: q.coverColor,
    questionCount: q.questions.length,
    isPublished: q.isPublished,
    timesHosted: q.timesHosted,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  }));

  res.json(withCounts);
});

// GET /api/quizzes/:id - full quiz detail (for editing or hosting)
router.get('/:id', async (req, res) => {
  const quiz = await Quiz.findOne({ _id: req.params.id, createdBy: req.admin.id });
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
  res.json(quiz);
});

// POST /api/quizzes - create a quiz
router.post('/', async (req, res) => {
  try {
    const { title, description, coverColor, questions } = req.body;

    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'title and at least one question are required.' });
    }

    for (const q of questions) {
      if (!q.text || !Array.isArray(q.options) || q.options.length < 2) {
        return res.status(400).json({ error: 'Every question needs text and at least 2 options.' });
      }
      if (
        typeof q.correctIndex !== 'number' ||
        q.correctIndex < 0 ||
        q.correctIndex >= q.options.length
      ) {
        return res.status(400).json({ error: 'correctIndex must point at a valid option.' });
      }
    }

    const quiz = await Quiz.create({
      title,
      description,
      coverColor,
      questions,
      createdBy: req.admin.id,
    });

    res.status(201).json(quiz);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error('Create quiz error:', err);
    res.status(500).json({ error: 'Could not create quiz.' });
  }
});


// PUT /api/quizzes/:id - update a quiz
router.put('/:id', async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, createdBy: req.admin.id });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });

    const { title, description, coverColor, questions, isPublished } = req.body;

    if (title !== undefined) quiz.title = title;
    if (description !== undefined) quiz.description = description;
    if (coverColor !== undefined) quiz.coverColor = coverColor;
    if (isPublished !== undefined) quiz.isPublished = isPublished;
    if (questions !== undefined) {
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: 'A quiz needs at least one question.' });
      }
      quiz.questions = questions;
    }

    await quiz.save();
    res.json(quiz);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error('Update quiz error:', err);
    res.status(500).json({ error: 'Could not update quiz.' });
  }
});

// DELETE /api/quizzes/:id
router.delete('/:id', async (req, res) => {
  const quiz = await Quiz.findOneAndDelete({ _id: req.params.id, createdBy: req.admin.id });
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
  res.json({ success: true });
});

// GET /api/quizzes/:id/results - past hosted sessions for this quiz
router.get('/:id/results', async (req, res) => {
  const results = await Result.find({ quiz: req.params.id, hostedBy: req.admin.id }).sort({
    endedAt: -1,
  });
  res.json(results);
});

module.exports = router;
