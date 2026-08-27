(() => {
  if (!Api.isLoggedIn()) {
    location.href = '/admin/login.html';
    return;
  }

  const el = (id) => document.getElementById(id);
  const admin = Api.currentAdmin();
  if (admin) el('admin-name').textContent = admin.name;

  el('btn-logout').addEventListener('click', () => {
    Api.clearSession();
    location.href = '/admin/login.html';
  });

  async function loadStats() {
    try {
      const stats = await Api.stats();
      el('stat-quizzes').textContent = stats.quizCount;
      el('stat-sessions').textContent = stats.sessionsHosted;
      el('stat-players').textContent = stats.playersReached;
    } catch (err) {
      console.error(err);
    }
  }

  async function loadQuizzes() {
    const list = el('quiz-list');
    try {
      const quizzes = await Api.listQuizzes();
      list.innerHTML = '';
      el('quiz-empty').classList.toggle('hidden', quizzes.length > 0);

      quizzes.forEach((q) => {
        const row = document.createElement('div');
        row.className = 'card-flat row between';
        row.innerHTML = `
          <div>
            <strong>${escapeHtml(q.title)}</strong>
            <p class="muted" style="font-size:0.85rem;">${q.questionCount} question${q.questionCount === 1 ? '' : 's'} · hosted ${q.timesHosted} time${q.timesHosted === 1 ? '' : 's'}</p>
          </div>
          <div class="row">
            <a class="btn btn-secondary" href="/host.html">Host</a>
            <a class="btn btn-secondary" href="/admin/editor.html?id=${q._id}">Edit</a>
            <button class="btn btn-danger" data-id="${q._id}">Delete</button>
          </div>
        `;
        row.querySelector('.btn-danger').addEventListener('click', async (e) => {
          if (!confirm(`Delete "${q.title}"? This can't be undone.`)) return;
          const id = e.currentTarget.dataset.id;
          try {
            await Api.deleteQuiz(id);
            loadQuizzes();
            loadStats();
          } catch (err) {
            alert(err.message);
          }
        });
        list.appendChild(row);
      });
    } catch (err) {
      list.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  loadStats();
  loadQuizzes();
})();
