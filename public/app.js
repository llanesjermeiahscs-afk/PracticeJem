// public/app.js: updated to display server-side validation errors per-field
// Purpose: present helpful errors to the user and show a consistent UI experience.

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function showAuthState(loggedIn, user) {
  document.getElementById('profile').classList.toggle('hidden', !loggedIn);
  document.getElementById('todos-section').classList.toggle('hidden', !loggedIn);
  document.getElementById('login').classList.toggle('hidden', loggedIn);
  document.getElementById('register').classList.toggle('hidden', loggedIn);
  if (loggedIn && user) {
    document.getElementById('profile-info').innerText = `Logged in as ${user.name || user.email}`;
  } else {
    document.getElementById('profile-info').innerText = '';
  }
}

// Helper: render field errors array from server into a message element (per-form)
function renderFieldErrors(targetElement, errors) {
  if (!errors || !errors.length) {
    targetElement.innerHTML = '';
    return;
  }
  // Show each error on its own line. errors: [{ field, message }]
  targetElement.innerHTML = errors.map(e => `<div>${e.field}: ${e.message}</div>`).join('');
  targetElement.style.color = 'red';
}

// ---------- Register ----------
document.getElementById('reg-submit').onclick = async () => {
  const email = document.getElementById('reg-email').value;
  const name = document.getElementById('reg-name').value;
  const password = document.getElementById('reg-password').value;
  const { status, data } = await api('/register', { method: 'POST', body: JSON.stringify({ email, name, password }) });
  const msg = document.getElementById('reg-msg');
  if (status === 201) {
    msg.innerText = 'Registered successfully. Now log in.';
    msg.style.color = 'green';
  } else if (data && data.errors) {
    renderFieldErrors(msg, data.errors);
  } else {
    msg.innerText = data.message || 'Registration failed';
    msg.style.color = 'red';
  }
};

// ---------- Login ----------
document.getElementById('login-submit').onclick = async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const { status, data } = await api('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  const msg = document.getElementById('login-msg');
  if (status === 200) {
    msg.innerText = 'Login successful';
    msg.style.color = 'green';
    await loadProfileAndTodos();
  } else if (data && data.errors) {
    renderFieldErrors(msg, data.errors);
  } else {
    msg.innerText = data.message || 'Login failed';
    msg.style.color = 'red';
  }
};

// ---------- Add Todo ----------
document.getElementById('todo-add').onclick = async () => {
  const text = document.getElementById('todo-text').value;
  const { status, data } = await api('/todos', { method: 'POST', body: JSON.stringify({ text }) });
  const msg = document.getElementById('todos-msg');
  if (status === 201) {
    msg.innerText = 'Todo added';
    msg.style.color = 'green';
    document.getElementById('todo-text').value = '';
    loadTodos();
  } else if (data && data.errors) {
    renderFieldErrors(msg, data.errors);
  } else {
    msg.innerText = data.message || 'Failed to add todo';
    msg.style.color = 'red';
  }
};

// The rest of public/app.js (renderTodos, toggleDone, deleteTodo, startEdit, loadProfileAndTodos, loadTodos) remains the same as Lesson 4.
// For brevity, include them unchanged if already present in your file. They will continue to work and show the global messages (todos-msg).

// Keep existing functions renderTodos, toggleDone, deleteTodo, startEdit, loadProfileAndTodos, loadTodos
// (If your file previously had them, no edits are required beyond the above changes.)