/* Native Boa login.cgi contract; the backend owns validation and session cookies. */
(function () {
  'use strict';
  var form = document.getElementById('login-form');
  var username = document.getElementById('username');
  var password = document.getElementById('password');
  var note = document.getElementById('login-note');
  var state = document.getElementById('login-state');
  var button = document.getElementById('signin-button');
  var info = window.OpenDSLLoginInfo;
  var blocked = false, submitting = false;
  function message(text) { note.textContent = text; note.classList.add('error'); note.hidden = false; }
  function hideForm(text) {
    blocked = true; form.hidden = true; state.hidden = false; state.textContent = text;
  }
  if (!info || typeof info !== 'object' || Array.isArray(info)) {
    hideForm('The modem did not provide valid sign-in state. Reload this page to try again.');
    document.getElementById('return-login').hidden = false;
    return;
  }
  var flag = Number(info.error_status || 0);
  if (flag === 3) message('Invalid username or password.');
  else if (flag === 7) {
    var elapsed = Number(info.lock_time);
    var remaining = Number.isFinite(elapsed) ? Math.max(0, Math.ceil(300 - elapsed)) : 300;
    hideForm('Sign-in is temporarily locked.');
    var tick = function () {
      state.textContent = 'Too many incorrect sign-in attempts. Try again in ' + Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0') + '.';
      if (remaining <= 0) { clearInterval(timer); setTimeout(function () { location.replace('/Main_Login.asp'); }, 2000); }
      remaining -= 1;
    };
    var timer = setInterval(tick, 1000); tick();
    window.addEventListener('pagehide', function () { clearInterval(timer); });
  } else if (flag === 8) {
    hideForm('You have signed out of your modem.'); document.getElementById('return-login').hidden = false;
  } else if (flag === 9) {
    var ip = typeof window.login_ip_str === 'function' ? String(window.login_ip_str()) : '';
    hideForm('Another device is already signed in.' + (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip !== '0.0.0.0' ? ' Address: ' + ip + '.' : '') + ' Close that session before trying again.');
    document.getElementById('return-login').hidden = false;
  } else if (flag) message('Your sign-in session could not be accepted. Please sign in again.');

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (blocked || submitting || !form.reportValidity()) return;
    // Match the stock form: trim ASCII spaces in the username, never the password.
    username.value = username.value.replace(/^ +| +$/g, '');
    if (!username.value) { username.focus(); return; }
    try { form.elements.login_authorization.value = window.btoa(username.value + ':' + password.value); }
    catch (error) { message('This account contains characters the modem sign-in format cannot encode.'); return; }
    // A fixed local landing page preserves the original first-run QIS decision.
    form.elements.next_page.value = 'index.asp';
    username.disabled = true; password.disabled = true; button.disabled = true; submitting = true;
    document.getElementById('signin-label').textContent = 'Signing in…';
    HTMLFormElement.prototype.submit.call(form);
  });
  function togglePassword() {
    var reveal = password.type === 'password';
    password.type = reveal ? 'text' : 'password';
    var eye = document.getElementById('password-toggle');
    eye.setAttribute('aria-pressed', String(reveal)); eye.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
    var label = document.getElementById('password-toggle-label');
    if (label) { label.setAttribute('aria-pressed', String(reveal)); label.textContent = reveal ? 'Hide password' : 'Show password'; }
  }
  document.getElementById('password-toggle').addEventListener('click', togglePassword);
  var toggleLabel = document.getElementById('password-toggle-label');
  if (toggleLabel) toggleLabel.addEventListener('click', togglePassword);
  password.addEventListener('keyup', function (event) { document.getElementById('caps-lock').hidden = !(event.getModifierState && event.getModifierState('CapsLock')); });
  if (window.history.replaceState) history.replaceState(null, document.title, location.pathname);
  if (!blocked) username.focus();
})();
