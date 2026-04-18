// ─── Shared app.js: Navigation state, auth helpers ──────────

document.addEventListener('DOMContentLoaded', () => {
  // Hamburger menu
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
  }

  // Check auth state and update nav
  checkAuth();

  // Logout button
  const logoutBtn = document.getElementById('navLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/login.html';
    });
  }

  // Register form
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }

  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
});

async function checkAuth() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) {
      updateNav(null);
      return null;
    }
    const user = await res.json();
    updateNav(user);
    return user;
  } catch {
    updateNav(null);
    return null;
  }
}

function updateNav(user) {
  const navRegister = document.getElementById('navRegister');
  const navLogin = document.getElementById('navLogin');
  const navDashboard = document.getElementById('navDashboard');
  const navAdmin = document.getElementById('navAdmin');
  const navLogout = document.getElementById('navLogout');

  if (user) {
    if (navRegister) navRegister.classList.add('hidden');
    if (navLogin) navLogin.classList.add('hidden');
    if (navLogout) navLogout.classList.remove('hidden');

    if (user.role === 'admin') {
      if (navAdmin) navAdmin.classList.remove('hidden');
      if (navDashboard) navDashboard.classList.add('hidden');
    } else {
      if (navDashboard) navDashboard.classList.remove('hidden');
      if (navAdmin) navAdmin.classList.add('hidden');
    }
  } else {
    if (navRegister) navRegister.classList.remove('hidden');
    if (navLogin) navLogin.classList.remove('hidden');
    if (navDashboard) navDashboard.classList.add('hidden');
    if (navAdmin) navAdmin.classList.add('hidden');
    if (navLogout) navLogout.classList.add('hidden');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const errEl = document.getElementById('registerError');
  errEl.classList.add('hidden');

  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm_password').value;
  if (password !== confirmPassword) {
    errEl.textContent = 'Passwords do not match';
    errEl.classList.remove('hidden');
    return;
  }

  const data = {
    full_name: document.getElementById('full_name').value.trim(),
    email: document.getElementById('email').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    address: document.getElementById('address').value.trim(),
    password,
  };

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      errEl.textContent = result.error;
      errEl.classList.remove('hidden');
      return;
    }
    window.location.href = '/dashboard.html';
  } catch {
    errEl.textContent = 'Something went wrong. Please try again.';
    errEl.classList.remove('hidden');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');

  const data = {
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('password').value,
  };

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      errEl.textContent = result.error;
      errEl.classList.remove('hidden');
      return;
    }
    if (result.role === 'admin') {
      window.location.href = '/admin.html';
    } else {
      window.location.href = '/dashboard.html';
    }
  } catch {
    errEl.textContent = 'Something went wrong. Please try again.';
    errEl.classList.remove('hidden');
  }
}
