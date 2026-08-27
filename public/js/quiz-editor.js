(() => {
  if (!Api.isLoggedIn()) {
    location.href = '/admin/login.html';
    return;
  }

  const el = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const editingId = params.get('id');

  const qTemplate = el('question-template');
  const optTemplate = el('option-template');
  const container = el('questions-container');

  let questionCounter = 0;

  function addQuestion(data) {
    questionCounter += 1;
    const node = qTemplate.content.cloneNode(true);
    const card = node.querySelector('.question-card');
    card.dataset.qid = questionCounter;

    node.querySelector('.q-index').textContent = `Question ${container.children.length + 1}`;
    node.querySelector('.q-text').value = data?.text || '';
    node.querySelector('.q-time').value = data?.timeLimit ?? 20;
    node.querySelector('.q-points').value = data?.points ?? 1000;

    node.querySelector('.btn-remove-q').addEventListener('click', () => {
      card.remove();
      renumberQuestions();
    });

    const optionsList = node.querySelector('.options-list');
    node.querySelector('.btn-add-option').addEventListener('click', () => {
      if (optionsList.children.length >= 6) return alert('Maximum 6 options per question.');
      addOption(optionsList, questionCounter);
    });

    container.appendChild(node);

    const options = data?.options?.length ? data.options : [{ text: '' }, { text: '' }];
    options.forEach((o, i) => {
      addOption(optionsList, questionCounter, o.text, i === (data?.correctIndex ?? 0));
    });
  }

  function addOption(optionsList, qid, text = '', isCorrect = false) {
    const node = optTemplate.content.cloneNode(true);
    const radio = node.querySelector('.opt-correct');
    radio.name = `correct-${qid}`;
    radio.checked = isCorrect;
    node.querySelector('.opt-text').value = text;

    node.querySelector('.btn-remove-opt').addEventListener('click', (e) => {
      if (optionsList.children.length <= 2) return alert('A question needs at least 2 options.');
      e.currentTarget.closest('.option-row').remove();
    });

    optionsList.appendChild(node);
  }

  function renumberQuestions() {
    Array.from(container.children).forEach((card, i) => {
      card.querySelector('.q-index').textContent = `Question ${i + 1}`;
    });
  }

  el('btn-add-question').addEventListener('click', () => addQuestion());

  function collectPayload() {
    const title = el('quiz-title').value.trim();
    const description = el('quiz-desc').value.trim();
    const questions = [];

    for (const card of container.children) {
      const text = card.querySelector('.q-text').value.trim();
      const timeLimit = Number(card.querySelector('.q-time').value) || 20;
      const points = Number(card.querySelector('.q-points').value) || 1000;
      const optionRows = Array.from(card.querySelectorAll('.option-row'));
      const options = optionRows.map((row) => ({ text: row.querySelector('.opt-text').value.trim() }));
      const correctRadio = card.querySelector('.opt-correct:checked');
      const correctIndex = correctRadio ? optionRows.indexOf(correctRadio.closest('.option-row')) : -1;

      if (!text) throw new Error('Every question needs text.');
      if (options.some((o) => !o.text)) throw new Error('Every option needs text.');
      if (correctIndex === -1) throw new Error('Mark the correct answer for every question.');

      questions.push({ text, options, correctIndex, timeLimit, points });
    }

    if (!title) throw new Error('Give your quiz a title.');
    if (questions.length === 0) throw new Error('Add at least one question.');

    return { title, description, questions };
  }

  el('btn-save').addEventListener('click', async () => {
    el('editor-error').textContent = '';
    let payload;
    try {
      payload = collectPayload();
    } catch (err) {
      el('editor-error').textContent = err.message;
      return;
    }

    el('btn-save').disabled = true;
    try {
      if (editingId) {
        await Api.updateQuiz(editingId, payload);
      } else {
        await Api.createQuiz(payload);
      }
      location.href = '/admin/dashboard.html';
    } catch (err) {
      el('editor-error').textContent = err.message;
    } finally {
      el('btn-save').disabled = false;
    }
  });

  async function init() {
    if (editingId) {
      el('page-title').textContent = 'Edit quiz';
      try {
        const quiz = await Api.getQuiz(editingId);
        el('quiz-title').value = quiz.title;
        el('quiz-desc').value = quiz.description || '';
        quiz.questions.forEach((q) => addQuestion(q));
      } catch (err) {
        el('editor-error').textContent = err.message;
      }
    } else {
      addQuestion();
    }
  }

  init();
})();
