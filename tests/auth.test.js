const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const source = html.slice(html.indexOf("    let _authMode = 'login';"), html.indexOf('    // DATABASE (Supabase)'));
const confirmed = { id: 'user-1', email: 'user@example.com', email_confirmed_at: '2026-10-05T12:00:00Z' };

function setup({ autoConfirm = false, user = confirmed, session = null, otpError = null } = {}) {
  const calls = [];
  let recoverySession = null;
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', checked: false, textContent: '', className: '', disabled: false, style: {},
      classList: { toggle() {}, add() {}, remove() {} }, focus() {},
      reportValidity: () => true,
    });
    return elements.get(id);
  };
  const storage = () => {
    const values = new Map();
    return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  };
  const context = vm.createContext({
    document: { getElementById: element, querySelectorAll: () => [] },
    location: { protocol: 'https:', href: 'https://tracker.example/index.html', hash: '', search: '' },
    URL, URLSearchParams, console, Date, setTimeout: () => 0, clearTimeout() {},
    localStorage: storage(), sessionStorage: storage(),
    SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'public-key',
    _authCallbackType: null, _hasAuthCallback: false,
    App: { currentUser: null, investments: [], categories: [], events: [] },
    fetch: async () => ({ ok: true, json: async () => ({ mailer_autoconfirm: autoConfirm }) }),
    sb: { auth: {
      onAuthStateChange() {},
      signUp: async args => { calls.push(['signup', args]); return { data: { user, session }, error: null }; },
      signInWithPassword: async () => ({ data: { user, session: { user } }, error: null }),
      signOut: async args => { calls.push(['signout', args]); return { error: null }; },
      getSession: async () => ({ data: { session: { user } }, error: null }),
      resetPasswordForEmail: async (email, options) => { calls.push(['recover', email, options]); return { error: null }; },
      verifyOtp: async args => { calls.push(['otp', args]); return { data: otpError ? null : { user, session: { user } }, error: otpError }; },
      updateUser: async args => { calls.push(['update', args]); return { data: { user }, error: null }; },
      resend: async args => { calls.push(['resend', args]); return { error: null }; },
    } },
    clearAIChat() {}, updateBDMDisplays() {}, loadAllData: async () => {}, navigate() {},
    renderCalendar() {}, initPullToRefresh() {}, updateCalc() {}, dateKey: () => '2026-10-05',
  });
  context.recoverySb = { auth: {
    onAuthStateChange() {},
    getSession: async () => ({ data: { session: recoverySession }, error: null }),
    verifyOtp: async args => {
      calls.push(['otp', args]);
      recoverySession = otpError ? null : { user };
      return { data: { user, session: recoverySession }, error: otpError };
    },
    updateUser: async args => { calls.push(['update', args, recoverySession?.user?.id]); return { data: { user }, error: null }; },
    signOut: async args => { calls.push(['signout', args]); recoverySession = null; return { error: null }; },
  } };
  vm.runInContext(source, context);
  vm.runInContext('onAuthSuccess = async user => { App.currentUser = user; };', context);
  return { context, calls, element };
}

test('signup refuses server auto-confirm before creating a user', async () => {
  const { context, calls } = setup({ autoConfirm: true });
  await assert.rejects(context.signUp(confirmed.email, 'password123', false), /confirmação/i);
  assert.equal(calls.filter(c => c[0] === 'signup').length, 0);
  assert.equal(context.App.currentUser, null);
});

test('signup waits for email confirmation and offers resend', async () => {
  const { context, element } = setup({ user: { ...confirmed, email_confirmed_at: null } });
  await context.signUp(confirmed.email, 'password123', false);
  assert.equal(context.App.currentUser, null);
  assert.match(element('auth-error').textContent, /confirme|confirmar/i);
  assert.equal(element('auth-password').value, '');
});

test('unexpected signup session is signed out instead of opening the app', async () => {
  const { context, calls } = setup({ session: { user: confirmed } });
  await assert.rejects(context.signUp(confirmed.email, 'password123', false), /confirmação/i);
  assert.equal(context.App.currentUser, null);
  assert.ok(calls.some(c => c[0] === 'signout'));
});

test('password login rejects an unconfirmed user', async () => {
  const { context, calls } = setup({ user: { ...confirmed, email_confirmed_at: null } });
  await assert.rejects(context.signIn(confirmed.email, 'password123', false), /confirme/i);
  assert.equal(context.App.currentUser, null);
  assert.ok(calls.some(c => c[0] === 'signout'));
});

test('restoring an unconfirmed session cannot enter the platform', async () => {
  const { context, calls } = setup({ user: { ...confirmed, email_confirmed_at: null } });
  assert.equal(await context.checkSession(), null);
  assert.ok(calls.some(c => c[0] === 'signout'));
});

test('confirmed password login continues to work', async () => {
  const { context } = setup();
  await context.signIn(confirmed.email, 'password123', false);
  assert.equal(context.App.currentUser.id, confirmed.id);
});

test('recovery sends a reset email and holds the user on authentication', async () => {
  const { context, calls, element } = setup();
  await context.requestPasswordRecovery(confirmed.email);
  assert.equal(calls[0][0], 'recover');
  assert.equal(calls[0][1], confirmed.email);
  assert.equal(context.App.currentUser, null);
  assert.match(element('auth-error').textContent, /se.*conta/i);
});

test('password cannot be changed before a valid recovery proof', async () => {
  const { context, calls } = setup();
  await assert.rejects(context.saveRecoveredPassword('newPassword123', 'newPassword123'), /código|recuperação/i);
  assert.equal(calls.filter(c => c[0] === 'update').length, 0);
});

test('invalid recovery OTP never enables a password update', async () => {
  const { context, calls } = setup({ otpError: { message: 'Token has expired or is invalid', code: 'otp_expired' } });
  await context.requestPasswordRecovery(confirmed.email);
  await assert.rejects(context.verifyRecoveryCode(confirmed.email, '123456'), /código|expir/i);
  await assert.rejects(context.saveRecoveredPassword('newPassword123', 'newPassword123'));
  assert.equal(calls.filter(c => c[0] === 'update').length, 0);
});

test('valid recovery OTP updates password then requires a new login', async () => {
  const { context, calls, element } = setup();
  await context.requestPasswordRecovery(confirmed.email);
  await context.verifyRecoveryCode(confirmed.email, '123456');
  assert.equal(calls.find(c => c[0] === 'otp')[1].type, 'recovery');
  assert.equal(await context.checkSession(), null);
  await context.saveRecoveredPassword('newPassword123', 'newPassword123');
  assert.equal(calls.find(c => c[0] === 'update')[1].password, 'newPassword123');
  assert.ok(calls.some(c => c[0] === 'signout'));
  assert.equal(context.App.currentUser, null);
  assert.match(element('auth-error').textContent, /senha.*atualizada/i);
});

test('mismatching new passwords never reach the update API', async () => {
  const { context, calls } = setup();
  await context.requestPasswordRecovery(confirmed.email);
  await context.verifyRecoveryCode(confirmed.email, '123456');
  await assert.rejects(context.saveRecoveredPassword('newPassword123', 'different123'), /iguais|coincidem/i);
  assert.equal(calls.filter(c => c[0] === 'update').length, 0);
});

test('recovery link event holds the user on the new password form', async () => {
  const { context, element } = setup();
  context.beginPasswordReset(confirmed);
  assert.equal(await context.checkSession(), null);
  assert.equal(element('auth-password-confirm').disabled, false);
  assert.equal(context.App.currentUser, null);
});

test('cancelling verified recovery discards its session and clears password fields', async () => {
  const { context, calls, element } = setup();
  context.beginPasswordReset(confirmed);
  element('auth-password').value = 'private-password';
  await context.cancelPasswordRecovery();
  assert.equal(element('auth-password').value, '');
  assert.ok(calls.some(c => c[0] === 'signout'));
  await assert.rejects(context.saveRecoveredPassword('newPassword123', 'newPassword123'));
});

test('switching sessions during recovery prevents changing another user password', async () => {
  const { context, calls } = setup();
  context.beginPasswordReset(confirmed);
  context.recoverySb.auth.getSession = async () => ({ data: { session: { user: { ...confirmed, id: 'other-user' } } } });
  await assert.rejects(context.saveRecoveredPassword('newPassword123', 'newPassword123'), /expirou/);
  assert.equal(calls.filter(c => c[0] === 'update').length, 0);
});

test('recovery request cooldown prevents duplicate emails', async () => {
  const { context, calls } = setup();
  await context.requestPasswordRecovery(confirmed.email);
  await assert.rejects(context.requestPasswordRecovery(confirmed.email), /aguarde/i);
  assert.equal(calls.filter(c => c[0] === 'recover').length, 1);
});

test('unavailable server settings prevent creating an unchecked signup', async () => {
  const { context, calls } = setup();
  context.fetch = async () => ({ ok: false });
  await assert.rejects(context.signUp(confirmed.email, 'password123', false), /verificar/i);
  assert.equal(calls.filter(c => c[0] === 'signup').length, 0);
});

test('file-based Android assets are never used as an email redirect URL', async () => {
  const { context, calls } = setup();
  context.location.protocol = 'file:';
  context.location.href = 'file:///android_asset/web/index.html';
  await context.requestPasswordRecovery(confirmed.email);
  assert.equal(calls.find(c => c[0] === 'recover')[2].redirectTo, undefined);
});

test('confirmation callback opens a confirmed account in a new non-remembered tab', async () => {
  const { context } = setup();
  context._hasAuthCallback = true;
  context._authCallbackType = 'signup';
  context.localStorage.setItem('bdm_remember', '0');
  assert.equal((await context.checkSession()).id, confirmed.id);
  assert.equal(context.sessionStorage.getItem('bdm_tab_active'), '1');
});

test('a persisted recovery session resumes reset rather than opening the portfolio', async () => {
  const { context, element } = setup();
  context.recoverySb.auth.getSession = async () => ({ data: { session: { user: confirmed } } });
  assert.equal(await context.checkSession(), null);
  assert.equal(element('auth-password-confirm').disabled, false);
  assert.equal(context.App.currentUser, null);
});

test('changing the normal login during recovery cannot change a different account password', async () => {
  const { context, calls } = setup();
  await context.requestPasswordRecovery(confirmed.email);
  await context.verifyRecoveryCode(confirmed.email, '123456');
  context.sb.auth.getSession = async () => ({ data: { session: { user: { ...confirmed, id: 'other-user' } } } });
  await context.saveRecoveredPassword('newPassword123', 'newPassword123');
  assert.equal(calls.find(c => c[0] === 'update')[2], confirmed.id);
});

test('starting recovery clears the previous account portfolio and chat', async () => {
  const { context } = setup();
  let clearedChat = false;
  context.clearAIChat = () => { clearedChat = true; };
  context.App.investments = [{ id: 'private-previous-investment' }];
  context.App.events = [{ id: 'private-previous-event' }];
  context.App.categories = [{ id: 'private-previous-category' }];
  context.beginPasswordReset(confirmed);
  assert.equal(context.App.investments.length, 0);
  assert.equal(context.App.events.length, 0);
  assert.equal(context.App.categories.length, 0);
  assert.equal(clearedChat, true);
});

test('failed logout retries only session cleanup after the password has been updated', async () => {
  const { context, calls } = setup();
  await context.requestPasswordRecovery(confirmed.email);
  await context.verifyRecoveryCode(confirmed.email, '123456');
  const originalSignout = context.recoverySb.auth.signOut;
  let attempts = 0;
  context.recoverySb.auth.signOut = async args => {
    if (++attempts === 1) return { error: { message: 'Network error' } };
    return originalSignout(args);
  };
  await assert.rejects(context.saveRecoveredPassword('newPassword123', 'newPassword123'));
  await context.saveRecoveredPassword('newPassword123', 'newPassword123');
  assert.equal(calls.filter(c => c[0] === 'update').length, 1);
  assert.equal(attempts, 2);
});
