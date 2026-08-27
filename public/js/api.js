// Tiny fetch helper used by the admin pages. Not a module so it can be
// dropped into any page with a plain <script> tag.

const Api = (() => {
  function token() {
    return localStorage.getItem('quizpit_token') || '';
  }

  function setSession(token_, admin) {
    localStorage.setItem('quizpit_token', token_);
    localStorage.setItem('quizpit_admin', JSON.stringify(admin));
  }

  function clearSession() {
    localStorage.removeItem('quizpit_token');
    localStorage.removeItem('quizpit_admin');
  }

  function currentAdmin() {
    try {
      return JSON.parse(localStorage.getItem('quizpit_admin') || 'null');
    } catch {
      return null;
    }
  }

  async function request(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const t = token();
    if (t) headers.Authorization = `Bearer ${t}`;

    const res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      // no body
    }

    if (!res.ok) {
      const message = (data && data.error) || `Request failed (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }

    return data;
  }

  return {
    token,
    setSession,
    clearSession,
    currentAdmin,
    isLoggedIn: () => !!token(),

    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    register: (name, email, password) =>
      request('/auth/register', { method: 'POST', body: { name, email, password } }),

    listQuizzes: () => request('/quizzes'),
    getQuiz: (id) => request(`/quizzes/${id}`),
    createQuiz: (quiz) => request('/quizzes', { method: 'POST', body: quiz }),
    updateQuiz: (id, quiz) => request(`/quizzes/${id}`, { method: 'PUT', body: quiz }),
    deleteQuiz: (id) => request(`/quizzes/${id}`, { method: 'DELETE' }),
    quizResults: (id) => request(`/quizzes/${id}/results`),

    stats: () => request('/results/stats'),
    allResults: () => request('/results'),
  };
})();
