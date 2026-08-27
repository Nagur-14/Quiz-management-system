const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    options: {
      type: [optionSchema],
      validate: {
        validator: (arr) => arr.length >= 2 && arr.length <= 6,
        message: 'A question needs between 2 and 6 options.',
      },
      required: true,
    },
    correctIndex: { type: Number, required: true, min: 0 },
    timeLimit: { type: Number, default: 20, min: 5, max: 120 }, // seconds
    points: { type: Number, default: 1000, min: 0 },
  },
  { _id: true }
);

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    coverColor: { type: String, default: '#6C5CE7' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    questions: {
      type: [questionSchema],
      validate: {
        validator: (arr) => arr.length >= 1,
        message: 'A quiz needs at least one question.',
      },
    },
    isPublished: { type: Boolean, default: true },
    timesHosted: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Quiz', quizSchema);
