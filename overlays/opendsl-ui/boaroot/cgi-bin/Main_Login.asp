<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="referrer" content="same-origin">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self'; img-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'self'; object-src 'none'">
  <title>OpenDSL · Sign in</title>
  <link rel="stylesheet" href="/opendsl/styles.css">
  <script>
/* Native Boa emits a JSON object; no credential or token is exposed here. */
var OpenDSLLoginInfo = <% login_error_info(); %>;
<% login_state_hook(); %>
</script>
  <script src="/opendsl/login.js" defer></script>
</head>
<body class="login-page">
  <main class="login-main">
    <div class="focused-brand">
      <a class="brand-block" href="/Main_Login.asp" aria-label="OpenDSL home"><span class="brand-mark" aria-hidden="true"></span><span class="brand-text"><span class="wordmark">OpenDSL</span><span class="brand-model">DSL-N12E C1</span></span></a>
    </div>
    <section class="login-card" aria-labelledby="login-title">
      <div class="setup-caption"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><span>Modem access</span></div>
      <h1 id="login-title">Welcome back</h1>
      <p class="login-sub">Sign in to manage your network and connection.</p>
      <form id="login-form" method="post" name="form" action="/login.cgi" autocomplete="off">
        <input type="hidden" name="group_id" value="">
        <input type="hidden" name="action_mode" value="">
        <input type="hidden" name="action_script" value="">
        <input type="hidden" name="action_wait" value="5">
        <input type="hidden" name="current_page" value="Main_Login.asp">
        <input type="hidden" name="next_page" value="index.asp">
        <input type="hidden" name="login_authorization" value="">
        <div class="field"><label for="username">Username</label><input id="username" name="login_username" placeholder="Enter your username" autocomplete="off" required maxlength="20" autocapitalize="none" spellcheck="false"></div>
        <div class="field"><label for="password">Password</label><div class="password-field"><input id="password" name="login_passwd" type="password" placeholder="Enter your password" required maxlength="16" autocomplete="off"><button type="button" id="password-toggle" class="password-toggle" aria-label="Show password" aria-pressed="false"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>
        <p id="caps-lock" class="caps-lock" hidden>Caps Lock is on.</p>
        <div class="form-actions">
          <button type="button" class="action-button" id="password-toggle-label" aria-pressed="false">Show password</button>
          <button type="submit" class="action-button primary signin-button" id="signin-button"><span id="signin-label">Sign in</span></button>
        </div>
        <p class="login-note" id="login-note" role="status" hidden></p>
      </form>
      <p class="login-note" id="login-state" role="status" hidden></p>
      <a class="login-note" href="/Main_Login.asp" id="return-login" hidden>Return to sign in</a>
      <noscript><p class="noscript-note">JavaScript is required to prepare the modem's native sign-in request.</p></noscript>
    </section>
  </main>
</body>
</html>
