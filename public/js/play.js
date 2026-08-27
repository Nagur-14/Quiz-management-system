(() => {
  const socket = io();

  const SHAPE_CLASSES = ['answer-a answer-btn', 'answer-b answer-btn', 'answer-c answer-btn', 'answer-d answer-btn'];
  const SHAPE_ICONS = ['shape-triangle', 'shape-diamond', 'shape-circle', 'shape-square'];

  const el = (id) => document.getElementById(id);
  const screens = {
    join: el('screen-join'),
    name: el('screen-name'),
    lobby: el('screen-lobby'),
    question: el('screen-question'),
    result: el('screen-result'),
    final: el('screen-final'),
  };

  function show(name) {
    Object.values(screens).forEach((s) => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
  }

  const state = {
    code: '',
    teamName: '',
    quizTitle: '',
    timerInterval: null,
    hasAnswered: false,
  };

  // ---------- Screen 1: code entry ----------
  const inputCode = el('input-code');
  inputCode.addEventListener('input', () => {
    inputCode.value = inputCode.value.replace(/\D/g, '').slice(0, 6);
  });
  inputCode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') el('btn-go-name').click();
  });

  el('btn-go-name').addEventListener('click', () => {
    const code = inputCode.value.trim();
    el('join-error').textContent = '';
    if (code.length !== 6) {
      el('join-error').textContent = 'Enter the 6-digit game code.';
      return;
    }
    state.code = code;
    show('name');
    el('input-team').focus();
  });

  // ---------- Screen 2: team name ----------
  el('btn-back-code').addEventListener('click', () => show('join'));

  const inputTeam = el('input-team');
  inputTeam.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') el('btn-join').click();
  });

  el('btn-join').addEventListener('click', () => {
    const teamName = inputTeam.value.trim();
    el('name-error').textContent = '';
    if (!teamName) {
      el('name-error').textContent = 'Enter a team name.';
      return;
    }

    el('btn-join').disabled = true;
    socket.emit('player:join', { code: state.code, teamName }, (res) => {
      el('btn-join').disabled = false;
      if (!res.ok) {
        el('name-error').textContent = res.error;
        return;
      }
      state.teamName = teamName;
      state.quizTitle = res.quizTitle;
      el('lobby-quiz-title').textContent = res.quizTitle;
      el('lobby-team-name').textContent = teamName;
      show('lobby');
    });
  });

  // ---------- Screen 3: lobby ----------
  socket.on('lobby:update', ({ teams }) => {
    el('lobby-count').textContent = teams.length;
    const box = el('lobby-teams');
    box.innerHTML = '';
    teams.forEach((t) => {
      const chip = document.createElement('span');
      chip.className = 'badge';
      chip.textContent = t.teamName;
      box.appendChild(chip);
    });
  });

  // ---------- Screen 4: question ----------
  socket.on('question:show', (q) => {
    state.hasAnswered = false;
    el('question-progress').textContent = `Question ${q.index + 1} / ${q.total}`;
    el('question-text').textContent = q.text;
    el('answer-status').textContent = '';

    const grid = el('answer-grid');
    grid.innerHTML = '';
    q.options.forEach((optText, i) => {
      const btn = document.createElement('button');
      btn.className = SHAPE_CLASSES[i % 4];
      btn.innerHTML = `<span class="shape-icon ${SHAPE_ICONS[i % 4]}" style="background:rgba(255,255,255,0.85)"></span><span>${escapeHtml(optText)}</span>`;
      btn.addEventListener('click', () => submitAnswer(i, grid));
      grid.appendChild(btn);
    });

    startTimer(q.timeLimit);
    show('question');
  });

  function submitAnswer(optionIndex, grid) {
    if (state.hasAnswered) return;
    state.hasAnswered = true;
    Array.from(grid.children).forEach((b) => (b.disabled = true));
    grid.children[optionIndex].style.outline = '3px solid white';

    socket.emit('player:answer', { code: state.code, optionIndex }, (res) => {
      if (!res.ok) {
        el('answer-status').textContent = res.error || "Couldn't submit answer.";
        return;
      }
      el('answer-status').textContent = 'Answer locked in — waiting for results…';
    });
  }

  function startTimer(seconds) {
    clearInterval(state.timerInterval);
    const circle = el('timer-circle');
    const text = el('timer-text');
    const circumference = 2 * Math.PI * 27;
    circle.style.strokeDasharray = `${circumference}`;

    let remaining = seconds;
    text.textContent = remaining;
    circle.style.strokeDashoffset = '0';

    state.timerInterval = setInterval(() => {
      remaining -= 1;
      text.textContent = Math.max(remaining, 0);
      const ratio = Math.max(remaining, 0) / seconds;
      circle.style.strokeDashoffset = `${circumference * (1 - ratio)}`;
      if (remaining <= 0) clearInterval(state.timerInterval);
    }, 1000);
  }

  // ---------- Screen 5: per-question result ----------
  socket.on('question:end', (data) => {
    clearInterval(state.timerInterval);
    if (data.yourCorrect === undefined) return; // this event variant is for the host

    el('result-icon').textContent = data.yourCorrect ? '✅' : '❌';
    el('result-heading').textContent = data.yourCorrect ? 'Correct!' : (data.yourAnswer === null ? 'Time up!' : 'Not quite.');
    el('result-points').textContent = data.yourCorrect ? `+${data.pointsAwarded} points` : 'No points this round';
    el('result-score').textContent = data.totalScore;
    show('result');
  });

  // ---------- Screen 6: final leaderboard ----------
  socket.on('game:ended', ({ leaderboard }) => {
    const box = el('final-leaderboard');
    box.innerHTML = '';
    leaderboard.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-row';
      row.innerHTML = `<span class="rank">#${i + 1}</span><span class="name">${escapeHtml(t.teamName)}</span><span class="score">${t.score}</span>`;
      box.appendChild(row);
    });
    show('final');
  });

  socket.on('game:host-left', () => {
    alert('The host ended the game.');
    location.reload();
  });

  el('btn-play-again').addEventListener('click', () => location.reload());

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
})();
