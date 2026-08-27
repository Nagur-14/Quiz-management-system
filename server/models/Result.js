const mongoose = require('mongoose');

const teamResultSchema = new mongoose.Schema(
  {
    teamName: { type: String, required: true },
    score: { type: Number, required: true },
    correctAnswers: { type: Number, required: true },
    totalAnswers: { type: Number, required: true },
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    quizTitle: { type: String, required: true },
    hostedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    code: { type: String, required: true },
    teams: { type: [teamResultSchema], default: [] },
    questionCount: { type: Number, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Result', resultSchema);
