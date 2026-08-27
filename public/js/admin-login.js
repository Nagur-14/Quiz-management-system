(() => {
  if (Api.isLoggedIn()) {
    location.href = '/admin/dashboard.html';
    return;
  }

  const el = (id) => document.getElementById(id);
  let mode = 'login'; // or 'register'

  function applyMode() {
    const isLogin = mode === 'login';
    el('form-title').textContent = isLogin ? 'Host login' : 'Create host account';
    el('form-subtitle').textContent = isLogin
      ? 'Log in to create quizzes and host live games.'
      : 'Sign up to start building quizzes for your audience.';
    el('field-name').classList.toggle('hidden', isLogin);
    el('btn-submit').textContent = isLogin ? 'Log in' : 'Create account';
    el('toggle-prompt').textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
    el('btn-toggle').textContent = isLogin ? 'Create one' : 'Log in';
    el('form-error').textContent = '';
  }

  el('btn-toggle').addEventListener('click', () => {
    mode = mode === 'login' ? 'register' : 'login';
    applyMode();
  });

  el('btn-submit').addEventListener('click', async () => {
    const email = el('input-email').value.trim();
    const password = el('input-password').value;
    const name = el('input-name').value.trim();
    el('form-error').textContent = '';

    if (!email || !password || (mode === 'register' && !name)) {
      el('form-error').textContent = 'Fill in all fields.';
      return;
    }

    el('btn-submit').disabled = true;
    try {
      const data = mode === 'login' ? await Api.login(email, password) : await Api.register(name, email, password);
      Api.setSession(data.token, data.admin);
      location.href = '/admin/dashboard.html';
    } catch (err) {
      el('form-error').textContent = err.message;
    } finally {
      el('btn-submit').disabled = false;
    }
  });

  ['input-email', 'input-password', 'input-name'].forEach((id) => {
    el(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') el('btn-submit').click();
    });
  });

  applyMode();
})();
