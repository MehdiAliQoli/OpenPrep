/* ================================================================
  OpenPrep — Auth JS
  ----------------------------------------------------------------
  Supabase-powered authentication flow.
  ================================================================ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'


/* ── SUPABASE CONFIG ─────────────────────────────────────────── */
const SUPABASE_URL = window.SUPABASE_URL
const SUPABASE_KEY = window.SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase config. Create root supabase.js (gitignored) and define window.SUPABASE_URL + window.SUPABASE_KEY.')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function getSiteBaseUrl() {
  if (window.location.protocol === 'file:') {
    return 'https://openprep';
  }
  return window.location.origin;
}



/* ── TAB SWITCHER ───────────────────────────────────────────── */
function switchTab(tab) {
  const panels = ['signinPanel', 'signupPanel', 'forgotPanel'];
  panels.forEach(id => {
    document.getElementById(id).style.display = 'none';
  });

  document.getElementById('signinTab').classList.remove('active');
  document.getElementById('signupTab').classList.remove('active');

  if (tab === 'signin') {
    document.getElementById('signinPanel').style.display = 'block';
    document.getElementById('signinTab').classList.add('active');
  } else if (tab === 'signup') {
    document.getElementById('signupPanel').style.display = 'block';
    document.getElementById('signupTab').classList.add('active');
  } else if (tab === 'forgot') {
    document.getElementById('forgotPanel').style.display = 'block';
  }
}


/* ── GOOGLE AUTH ────────────────────────────────────────────── */
async function handleGoogleAuth() {
  setLoading('googleSigninBtn', true);
  setLoading('googleSignupBtn', true);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getSiteBaseUrl() + '/index.html' }
  });

  if (error) {
    showAlert('signinAlert', error.message, 'error');
    showAlert('signupAlert', error.message, 'error');
    setLoading('googleSigninBtn', false);
    setLoading('googleSignupBtn', false);
  }
}


/* ── SIGN IN ────────────────────────────────────────────────── */
async function handleSignin(e) {
  e.preventDefault();
  clearErrors();

  const email    = document.getElementById('signinEmail').value.trim();
  const password = document.getElementById('signinPassword').value;

  // Validate
  let valid = true;
  if (!validateEmail(email)) {
    showFieldError('signinEmail', 'signinEmailErr', 'Please enter a valid email.');
    valid = false;
  }
  if (password.length < 6) {
    showFieldError('signinPassword', 'signinPasswordErr', 'Password must be at least 6 characters.');
    valid = false;
  }
  if (!valid) return;

  setLoading('signinSubmit', true);

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    showAlert('signinAlert', error.message, 'error');
    setLoading('signinSubmit', false);
    return;
  }

  window.location.href = getSiteBaseUrl() + '/index.html';
}


/* ── SIGN UP ────────────────────────────────────────────────── */
async function handleSignup(e) {
  e.preventDefault();
  clearErrors();

  const first    = document.getElementById('signupFirst').value.trim();
  const last     = document.getElementById('signupLast').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm  = document.getElementById('signupConfirm').value;
  const exam     = document.getElementById('signupExam').value;

  // Validate
  let valid = true;
  if (!first) {
    showFieldError('signupFirst', 'signupFirstErr', 'First name is required.');
    valid = false;
  }
  if (!last) {
    showFieldError('signupLast', 'signupLastErr', 'Last name is required.');
    valid = false;
  }
  if (!validateEmail(email)) {
    showFieldError('signupEmail', 'signupEmailErr', 'Please enter a valid email.');
    valid = false;
  }
  if (password.length < 8) {
    showFieldError('signupPassword', 'signupPasswordErr', 'Password must be at least 8 characters.');
    valid = false;
  }
  if (password !== confirm) {
    showFieldError('signupConfirm', 'signupConfirmErr', 'Passwords do not match.');
    valid = false;
  }
  if (!exam) {
    showFieldError('signupExam', 'signupExamErr', 'Please select the exam you are preparing for.');
    valid = false;
  }
  if (!valid) return;

  setLoading('signupSubmit', true);

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: first, last_name: last, exam_target: exam }
    }
  });

  setLoading('signupSubmit', false);

  if (error) {
    showAlert('signupAlert', error.message, 'error');
  } else {
    showAlert('signupAlert',
      'Account created! Check your email to confirm your address.',
      'success');
  }
}


/* ── FORGOT PASSWORD ────────────────────────────────────────── */
async function handleForgot(e) {
  e.preventDefault();
  clearErrors();

  const email = document.getElementById('forgotEmail').value.trim();

  if (!validateEmail(email)) {
    showFieldError('forgotEmail', 'forgotEmailErr', 'Please enter a valid email.');
    return;
  }

  setLoading('forgotSubmit', true);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getSiteBaseUrl() + '/Signup/auth.html'
  });

  setLoading('forgotSubmit', false);

  if (error) {
    showAlert('forgotAlert', error.message, 'error');
  } else {
    showAlert('forgotAlert',
      'Reset link sent! Check your inbox.',
      'success');
  }
}


/* ── PASSWORD STRENGTH ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  const pwInput = document.getElementById('signupPassword');
  if (!pwInput) return;

  pwInput.addEventListener('input', function () {
    const val = this.value;
    const bar  = document.getElementById('pwStrength');
    const fill = document.getElementById('pwFill');
    const lbl  = document.getElementById('pwLabel');

    if (val.length === 0) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';

    const score = getPasswordScore(val);
    const levels = [
      { width: '25%', color: '#E24B4A', text: 'Weak'   },
      { width: '50%', color: '#EF9F27', text: 'Fair'   },
      { width: '75%', color: '#1D9E75', text: 'Good'   },
      { width: '100%',color: '#1A6B45', text: 'Strong' },
    ];
    const lvl = levels[score];
    fill.style.width      = lvl.width;
    fill.style.background = lvl.color;
    lbl.style.color       = lvl.color;
    lbl.textContent       = lvl.text;
  });
});

function getPasswordScore(pw) {
  let score = 0;
  if (pw.length >= 8)                    score++;
  if (/[A-Z]/.test(pw))                  score++;
  if (/[0-9]/.test(pw))                  score++;
  if (/[^A-Za-z0-9]/.test(pw))           score++;
  return Math.min(score - 1, 3);
}


/* ── SHOW / HIDE PASSWORD ───────────────────────────────────── */
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';

  // Swap icon
  btn.innerHTML = isHidden
    ? `<svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
         <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
         <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
         <line x1="1" y1="1" x2="23" y2="23"/>
       </svg>`
    : `<svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
         <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
         <circle cx="12" cy="12" r="3"/>
       </svg>`;
}


/* ── FORGOT PASSWORD LINK ───────────────────────────────────── */
function showForgot(e) {
  e.preventDefault();
  switchTab('forgot');
}


/* ── HELPERS ────────────────────────────────────────────────── */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFieldError(inputId, errId, message) {
  const input = document.getElementById(inputId);
  const err   = document.getElementById(errId);
  if (input) input.classList.add('error');
  if (err)   err.textContent = message;
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  document.querySelectorAll('input, select').forEach(el => el.classList.remove('error'));
  document.querySelectorAll('.form-alert').forEach(el => {
    el.style.display = 'none';
    el.className = 'form-alert';
  });
}

function showAlert(id, message, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent  = message;
  el.className    = 'form-alert alert-' + type;
  el.style.display = 'block';
}

function setLoading(btnId, loading) {
  const btn     = document.getElementById(btnId);
  if (!btn) return;
  const label   = btn.querySelector('.btn-label');
  const spinner = btn.querySelector('.btn-spinner');

  btn.disabled = loading;
  if (label)   label.style.display   = loading ? 'none'  : '';
  if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Expose handlers for inline HTML attributes while running this file as an ES module.
window.switchTab = switchTab;
window.handleGoogleAuth = handleGoogleAuth;
window.handleSignin = handleSignin;
window.handleSignup = handleSignup;
window.handleForgot = handleForgot;
window.togglePassword = togglePassword;
window.showForgot = showForgot;
