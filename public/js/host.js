(() => {
  if (!Api.isLoggedIn()) {
    location.href = '/admin/login.html';
    return;
  }

  const socket = io();
  const el = (id) => document.getElementById(id);
  const screens = {
    pick: el('screen-pick'),
    lobby: el('screen-lobby'),
    question: el('screen-question'),
    result: el('screen-result'),
    final: el('screen-final'),
  };

  function show(name) {
    Object.values(screens).forEach((s) => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
  }

  const SHAPE_CLASSES = ['answer-a answer-btn', 'answer-b answer-btn', 'answer-c answer-btn', 'answer-d answer-btn'];
  const SHAPE_ICONS = ['shape-triangle', 'shape-diamond', 'shape-circle', 'shape-square'];
  const SHAPE_COLORS = ['var(--shape-a)', 'var(--shape-b)', 'var(--shape-c)', 'var(--shape-d)'];

  const state = { code: null, quizId: null, totalTeams: 0 };

  el('lobby-host-url').textContent = location.origin + '/';

  // ---------- Screen 1: pick a quiz ----------
  async function loadQuizzes() {
    try {
      const quizzes = await Api.listQuizzes();
      const list = el('pick-list');
      list.innerHTML = '';
      if (quizzes.length === 0) {
        el('pick-empty').classList.remove('hidden');
        return;
      }
      quizzes.forEach((q) => {
        const row = document.createElement('div');
        row.className = 'card-flat row between';
        row.innerHTML = `
          <div>
            <strong>${escapeHtml(q.title)}</strong>
            <p class="muted" style="font-size:0.85rem;">${q.questionCount} question${q.questionCount === 1 ? '' : 's'} · hosted ${q.timesHosted} time${q.timesHosted === 1 ? '' : 's'}</p>
          </div>
          <button class="btn btn-primary">Host</button>
        `;
        row.querySelector('button').addEventListener('click', () => createSession(q._id));
        list.appendChild(row);
      });
    } catch (err) {
      el('pick-error').textContent = err.message;
    }
  }
  loadQuizzes();

  function createSession(quizId) {
    el('pick-error').textContent = '';
    socket.emit('host:create', { quizId, token: Api.token() }, (res) => {
      if (!res.ok) {
        el('pick-error').textContent = res.error;
        return;
      }
      state.code = res.code;
      state.quizId = quizId;
      renderPin(res.code);
      el('lobby-quiz-title').textContent = res.quizTitle;
      show('lobby');
    });
  }

  function renderPin(code) {
    const box = el('lobby-pin');
    box.innerHTML = '';
    code.split('').forEach((digit) => {
      const d = document.createElement('span');
      d.className = 'pin-digit';
      d.textContent = digit;
      box.appendChild(d);
    });
  }

  // ---------- Screen 2: lobby ----------
  socket.on('lobby:update', ({ teams }) => {
    state.totalTeams = teams.length;
    el('lobby-count').textContent = teams.length;
    el('btn-start').disabled = teams.length === 0;

    const box = el('lobby-teams');
    box.innerHTML = '';
    teams.forEach((t) => {
      const chip = document.createElement('span');
      chip.className = 'badge';
      chip.textContent = t.teamName;
      box.appendChild(chip);
    });
  });

  el('btn-start').addEventListener('click', () => {
    socket.emit('host:start', { code: state.code }, (res) => {
      if (!res.ok) alert(res.error);
    });
  });

  // ---------- Screen 3: live question ----------
  socket.on('question:show', (q) => {
    el('question-progress').textContent = `Question ${q.index + 1} / ${q.total}`;
    el('answer-count-badge').textContent = `0 / ${state.totalTeams} answered`;
    el('question-text').textContent = q.text;

    const grid = el('answer-grid');
    grid.innerHTML = '';
    q.options.forEach((optText, i) => {
      const div = document.createElement('div');
      div.className = SHAPE_CLASSES[i % 4];
      div.innerHTML = `<span class="shape-icon ${SHAPE_ICONS[i % 4]}" style="background:rgba(255,255,255,0.85)"></span><span>${escapeHtml(optText)}</span>`;
      grid.appendChild(div);
    });

    show('question');
  });

  socket.on('question:answer-received', ({ answeredCount, totalTeams }) => {
    el('answer-count-badge').textContent = `${answeredCount} / ${totalTeams} answered`;
  });

  // ---------- Screen 4: question results (host variant has optionCounts) ----------
  socket.on('question:end', (data) => {
    if (data.optionCounts === undefined) return; // player-only variant, ignore here

    const bars = el('result-bars');
    bars.innerHTML = '';
    const max = Math.max(1, ...data.optionCounts);
    data.optionCounts.forEach((count, i) => {
      const wrap = document.createElement('div');
      const isCorrect = i === data.correctIndex;
      const pct = Math.round((count / max) * 100);
      wrap.innerHTML = `
        <div class="row between" style="margin-bottom:4px;">
          <span class="row" style="gap:8px;">
            <span class="shape-icon ${SHAPE_ICONS[i % 4]}" style="background:${SHAPE_COLORS[i % 4]}"></span>
            ${isCorrect ? '<strong style="color:var(--success)">Correct answer</strong>' : '<span class="muted">Answer ' + (i+1) + '</span>'}
          </span>
          <span class="muted">${count}</span>
        </div>
        <div style="height:10px; background:var(--bg-soft); border-radius:6px; overflow:hidden;">
          <div style="height:100%; width:${pct}%; background:${isCorrect ? 'var(--success)' : 'var(--surface-alt)'};"></div>
        </div>
      `;
      bars.appendChild(wrap);
    });

    const board = el('result-leaderboard');
    board.innerHTML = '';
    data.leaderboard.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-row';
      row.innerHTML = `<span class="rank">#${i + 1}</span><span class="name">${escapeHtml(t.teamName)}</span><span class="score">${t.score}</span>`;
      board.appendChild(row);
    });

    el('btn-next').textContent = data.isLastQuestion ? 'Show final leaderboard' : 'Next question';
    show('result');
  });

  el('btn-next').addEventListener('click', () => {
    socket.emit('host:next', { code: state.code }, (res) => {
      if (!res.ok) alert(res.error);
    });
  });

  // ---------- Screen 5: final leaderboard ----------
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

  el('btn-new-game').addEventListener('click', () => location.reload());

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
})();
