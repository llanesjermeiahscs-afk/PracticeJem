// public/new-rental.js - handle register/login and creating rentals with image uploads
(function(){
  // Helpers
  async function postJSON(url, body) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  function setToken(token) {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }
  function getToken() { return localStorage.getItem('token'); }

  // Register
  const registerForm = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');
  const authMessage = document.getElementById('auth-message');

  registerForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(registerForm));
    try {
      const res = await postJSON('/api/register', data);
      authMessage.textContent = 'Registered. You can now log in.';
    } catch (err) {
      authMessage.textContent = 'Register failed: ' + err.message;
    }
  });

  loginForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(loginForm));
    try {
      const res = await postJSON('/api/login', data);
      const token = res.token;
      if (token) setToken(token);
      authMessage.textContent = 'Logged in';
    } catch (err) {
      authMessage.textContent = 'Login failed: ' + err.message;
    }
  });

  // Image preview
  const imagesInput = document.getElementById('images');
  const preview = document.getElementById('image-preview');
  imagesInput.addEventListener('change', () => {
    preview.innerHTML = '';
    const files = Array.from(imagesInput.files).slice(0,6);
    files.forEach(f => {
      const reader = new FileReader();
      const el = document.createElement('div'); el.className = 'thumb';
      reader.onload = (e) => {
        const img = document.createElement('img'); img.src = e.target.result; img.alt = f.name;
        el.appendChild(img);
      };
      reader.readAsDataURL(f);
      preview.appendChild(el);
    });
  });

  // Create rental
  const rentalForm = document.getElementById('rental-form');
  const rentalMessage = document.getElementById('rental-message');
  rentalForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    rentalMessage.textContent = '';
    const form = new FormData();
    const fd = new FormData(rentalForm);
    form.append('title', fd.get('title'));
    form.append('location', fd.get('location') || '');
    if (fd.get('price')) form.append('price', fd.get('price'));
    form.append('description', fd.get('description') || '');
    const files = imagesInput.files;
    for (let i=0;i<Math.min(files.length,6);i++) form.append('images', files[i]);

    // Show progress UI
    const progressWrap = document.getElementById('upload-progress');
    const progressFill = progressWrap.querySelector('.fill');
    const progressPercent = document.getElementById('upload-percent');
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';
    progressWrap.hidden = false;

    // Disable form controls while uploading
    const controls = rentalForm.querySelectorAll('input,button,textarea');
    controls.forEach(c => c.disabled = true);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/rentals');
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressFill.style.width = pct + '%';
        progressPercent.textContent = pct + '%';
      }
    };

    xhr.onload = async () => {
      controls.forEach(c => c.disabled = false);
      if (xhr.status >= 200 && xhr.status < 300) {
        rentalMessage.textContent = 'Created rental — redirecting to feed...';
        setTimeout(() => location.href = '/feed.html', 900);
      } else {
        rentalMessage.textContent = 'Create failed: ' + xhr.responseText;
      }
      progressWrap.hidden = true;
    };

    xhr.onerror = () => {
      controls.forEach(c => c.disabled = false);
      rentalMessage.textContent = 'Upload failed (network error)';
      progressWrap.hidden = true;
    };

    xhr.send(form);
  });

})();
