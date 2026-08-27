const jwt = require('jsonwebtoken');
const Quiz = require('../models/Quiz');
const Result = require('../models/Result');
const generateCode = require('../utils/generateCode');

// All active game sessions live in memory, keyed by 6-digit join code.
// This keeps the real-time hot path fast; finished sessions are written to
// MongoDB (see Result model) once, when the game ends.
const sessions = new Map();

// Reverse lookups so a disconnecting socket knows which session to clean up.
const hostSocketToCode = new Map();
const playerSocketToCode = new Map();

function roomFor(code) {
  return `session:${code}`;
}

function verifyAdminToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function publicTeamList(session) {
  return Array.from(session.teams.values()).map((t) => ({
    teamName: t.teamName,
    score: t.score,
    connected: t.connected,
  }));
}

function leaderboard(session) {
  return publicTeamList(session).sort((a, b) => b.score - a.score);
}

function currentQuestionPublic(session) {
  const q = session.quizSnapshot.questions[session.currentQuestionIndex];
  return {
    index: session.currentQuestionIndex,
    total: session.quizSnapshot.questions.length,
    text: q.text,
    options: q.options.map((o) => o.text),
    timeLimit: q.timeLimit,
  };
}

function clearQuestionTimer(session) {
  if (session.questionTimer) {
    clearTimeout(session.questionTimer);
    session.questionTimer = null;
  }
}

function scoreAnswer(question, optionIndex, timeTakenMs) {
  const correct = optionIndex === question.correctIndex;
  if (!correct) return 0;
  const limitMs = question.timeLimit * 1000;
  const ratio = Math.max(0, Math.min(1, timeTakenMs / limitMs));
  // Fastest correct answer scores full points; slowest correct answer still
  // scores half points. Wrong answers always score 0.
  const points = Math.round(question.points * (1 - ratio * 0.5));
  return points;
}

function endSession(io, code, { persist } = { persist: true }) {
  const session = sessions.get(code);
  if (!session) return;

  clearQuestionTimer(session);

  if (persist && session.startedAt) {
    const teams = Array.from(session.teams.values()).map((t) => ({
      teamName: t.teamName,
      score: t.score,
      correctAnswers: t.answers.filter((a) => a.correct).length,
      totalAnswers: t.answers.length,
    }));

    Result.create({
      quiz: session.quizId,
      quizTitle: session.quizSnapshot.title,
      hostedBy: session.hostAdminId,
      code,
      teams,
      questionCount: session.quizSnapshot.questions.length,
      startedAt: session.startedAt,
      endedAt: new Date(),
    }).catch((err) => console.error('Failed to persist game result:', err));
  }

  for (const t of session.teams.values()) {
    playerSocketToCode.delete(t.socketId);
  }
  hostSocketToCode.delete(session.hostSocketId);
  sessions.delete(code);
}

function initGameSockets(io) {
  io.on('connection', (socket) => {
    // ---------------------------------------------------------------
    // HOST EVENTS
    // ---------------------------------------------------------------

    socket.on('host:create', async ({ quizId, token }, ack) => {
      if (typeof ack !== 'function') return;
      const payload = verifyAdminToken(token);
      if (!payload) return ack({ ok: false, error: 'Please log in again.' });

      try {
        const quiz = await Quiz.findOne({ _id: quizId, createdBy: payload.id });
        if (!quiz) return ack({ ok: false, error: 'Quiz not found.' });
        if (!quiz.questions.length) {
          return ack({ ok: false, error: 'This quiz has no questions yet.' });
        }

        const code = generateCode((c) => sessions.has(c));

        const session = {
          code,
          quizId: quiz._id,
          quizSnapshot: {
            title: quiz.title,
            questions: quiz.questions.map((q) => ({
              text: q.text,
              options: q.options.map((o) => ({ text: o.text })),
              correctIndex: q.correctIndex,
              timeLimit: q.timeLimit,
              points: q.points,
            })),
          },
          hostSocketId: socket.id,
          hostAdminId: payload.id,
          status: 'lobby',
          currentQuestionIndex: -1,
          teams: new Map(), // key: teamName (lowercased) -> team state
          questionTimer: null,
          startedAt: null,
          createdAt: new Date(),
        };

        sessions.set(code, session);
        hostSocketToCode.set(socket.id, code);
        socket.join(roomFor(code));

        quiz.timesHosted += 1;
        quiz.save().catch(() => {});

        ack({
          ok: true,
          code,
          quizTitle: quiz.title,
          questionCount: quiz.questions.length,
        });
      } catch (err) {
        console.error('host:create error:', err);
        ack({ ok: false, error: 'Could not create game session.' });
      }
    });

    socket.on('host:start', ({ code }, ack) => {
      const session = sessions.get(code);
      if (!session || session.hostSocketId !== socket.id) {
        return ack && ack({ ok: false, error: 'Session not found.' });
      }
      if (session.teams.size === 0) {
        return ack && ack({ ok: false, error: 'Wait for at least one team to join.' });
      }

      session.startedAt = new Date();
      ack && ack({ ok: true });
      advanceToNextQuestion(io, session);
    });

    socket.on('host:next', ({ code }, ack) => {
      const session = sessions.get(code);
      if (!session || session.hostSocketId !== socket.id) {
        return ack && ack({ ok: false, error: 'Session not found.' });
      }
      ack && ack({ ok: true });
      advanceToNextQuestion(io, session);
    });

    socket.on('host:end', ({ code }, ack) => {
      const session = sessions.get(code);
      if (!session || session.hostSocketId !== socket.id) {
        return ack && ack({ ok: false, error: 'Session not found.' });
      }
      io.to(roomFor(code)).emit('game:ended', { leaderboard: leaderboard(session) });
      endSession(io, code, { persist: !!session.startedAt });
      ack && ack({ ok: true });
    });

    // ---------------------------------------------------------------
    // PLAYER / TEAM EVENTS
    // ---------------------------------------------------------------

    socket.on('player:join', ({ code, teamName }, ack) => {
      if (typeof ack !== 'function') return;
      const cleanCode = String(code || '').trim();
      const cleanName = String(teamName || '').trim().slice(0, 24);

      const session = sessions.get(cleanCode);
      if (!session) return ack({ ok: false, error: 'Game code not found.' });
      if (session.status !== 'lobby') {
        return ack({ ok: false, error: 'This game has already started.' });
      }
      if (!cleanName) return ack({ ok: false, error: 'Enter a team name.' });

      const key = cleanName.toLowerCase();
      if (session.teams.has(key)) {
        return ack({ ok: false, error: 'That team name is already taken. Pick another.' });
      }

      session.teams.set(key, {
        teamName: cleanName,
        socketId: socket.id,
        score: 0,
        connected: true,
        answers: [],
      });
      playerSocketToCode.set(socket.id, cleanCode);
      socket.join(roomFor(cleanCode));

      ack({ ok: true, quizTitle: session.quizSnapshot.title });
      io.to(roomFor(cleanCode)).emit('lobby:update', { teams: publicTeamList(session) });
    });

    socket.on('player:answer', ({ code, optionIndex }, ack) => {
      const session = sessions.get(code);
      if (!session || session.status !== 'question') {
        return ack && ack({ ok: false, error: 'No question is active.' });
      }

      const team = Array.from(session.teams.values()).find((t) => t.socketId === socket.id);
      if (!team) return ack && ack({ ok: false, error: 'You are not part of this game.' });

      const already = team.answers.find((a) => a.questionIndex === session.currentQuestionIndex);
      if (already) return ack && ack({ ok: false, error: 'You already answered this question.' });

      const question = session.quizSnapshot.questions[session.currentQuestionIndex];
      const timeTakenMs = Date.now() - session.questionStartedAt;
      const points = scoreAnswer(question, optionIndex, timeTakenMs);
      const correct = optionIndex === question.correctIndex;

      team.answers.push({
        questionIndex: session.currentQuestionIndex,
        optionIndex,
        correct,
        pointsAwarded: points,
      });
      team.score += points;

      ack && ack({ ok: true, correct, pointsAwarded: points, totalScore: team.score });

      // Let the host see answers come in live, without revealing the answer to other players.
      io.to(session.hostSocketId).emit('question:answer-received', {
        answeredCount: countAnswersForCurrentQuestion(session),
        totalTeams: session.teams.size,
      });

      maybeEndQuestionEarly(io, session);
    });

    // ---------------------------------------------------------------
    // DISCONNECT
    // ---------------------------------------------------------------

    socket.on('disconnect', () => {
      const hostCode = hostSocketToCode.get(socket.id);
      if (hostCode) {
        const session = sessions.get(hostCode);
        if (session) {
          io.to(roomFor(hostCode)).emit('game:host-left');
          endSession(io, hostCode, { persist: !!session.startedAt });
        }
        return;
      }

      const playerCode = playerSocketToCode.get(socket.id);
      if (playerCode) {
        const session = sessions.get(playerCode);
        if (session) {
          const team = Array.from(session.teams.values()).find((t) => t.socketId === socket.id);
          if (team) {
            if (session.status === 'lobby') {
              session.teams.delete(team.teamName.toLowerCase());
            } else {
              team.connected = false;
            }
            io.to(roomFor(playerCode)).emit('lobby:update', { teams: publicTeamList(session) });
          }
        }
        playerSocketToCode.delete(socket.id);
      }
    });
  });
}

function countAnswersForCurrentQuestion(session) {
  let count = 0;
  for (const t of session.teams.values()) {
    if (t.answers.some((a) => a.questionIndex === session.currentQuestionIndex)) count += 1;
  }
  return count;
}

function maybeEndQuestionEarly(io, session) {
  if (session.status !== 'question') return;
  const connectedTeams = Array.from(session.teams.values()).filter((t) => t.connected !== false);
  const allAnswered =
    connectedTeams.length > 0 &&
    connectedTeams.every((t) =>
      t.answers.some((a) => a.questionIndex === session.currentQuestionIndex)
    );
  if (allAnswered) {
    clearQuestionTimer(session);
    endCurrentQuestion(io, session);
  }
}

function advanceToNextQuestion(io, session) {
  clearQuestionTimer(session);
  session.currentQuestionIndex += 1;

  if (session.currentQuestionIndex >= session.quizSnapshot.questions.length) {
    session.status = 'ended';
    io.to(roomFor(session.code)).emit('game:ended', { leaderboard: leaderboard(session) });
    endSession(io, session.code, { persist: true });
    return;
  }

  session.status = 'question';
  session.questionStartedAt = Date.now();

  io.to(roomFor(session.code)).emit('question:show', currentQuestionPublic(session));

  const question = session.quizSnapshot.questions[session.currentQuestionIndex];
  session.questionTimer = setTimeout(() => {
    endCurrentQuestion(io, session);
  }, question.timeLimit * 1000 + 250); // small grace period for network latency
}

function endCurrentQuestion(io, session) {
  if (session.status !== 'question') return;
  clearQuestionTimer(session);
  session.status = 'question-results';

  const question = session.quizSnapshot.questions[session.currentQuestionIndex];

  // Send each team their own correctness privately, plus the shared leaderboard.
  for (const team of session.teams.values()) {
    const answer = team.answers.find((a) => a.questionIndex === session.currentQuestionIndex);
    io.to(team.socketId).emit('question:end', {
      correctIndex: question.correctIndex,
      yourAnswer: answer ? answer.optionIndex : null,
      yourCorrect: answer ? answer.correct : false,
      pointsAwarded: answer ? answer.pointsAwarded : 0,
      totalScore: team.score,
    });
  }

  io.to(session.hostSocketId).emit('question:end', {
    correctIndex: question.correctIndex,
    optionCounts: countOptionSelections(session, question.options.length),
    leaderboard: leaderboard(session),
    isLastQuestion:
      session.currentQuestionIndex >= session.quizSnapshot.questions.length - 1,
  });
}

function countOptionSelections(session, optionCount) {
  const counts = new Array(optionCount).fill(0);
  for (const t of session.teams.values()) {
    const a = t.answers.find((ans) => ans.questionIndex === session.currentQuestionIndex);
    if (a && a.optionIndex >= 0 && a.optionIndex < optionCount) counts[a.optionIndex] += 1;
  }
  return counts;
}

module.exports = initGameSockets;
