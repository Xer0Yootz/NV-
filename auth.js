// Neon Vigil OAuth starter for Cloudflare Pages (hexos, linked to Xer0Yootz/NV-).
// No build step. No secret keys in this file: only the Supabase URL and the
// public anon key from config.js are used in the browser. Never put the
// service_role / secret key here.
var supabaseClient = null;
function getClient() {
  if (supabaseClient) return supabaseClient;
  var cfg = window.NV_CONFIG || {};
  var status = document.getElementById('status');
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    if (status) status.textContent = 'Sign-in is not configured yet: add the Supabase anon key in config.js (see README).';
    return null;
  }
  supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nv-supabase-auth' }
  });
  return supabaseClient;
}
async function checkSessionAndRedirect(target) {
  var client = getClient();
  if (!client) return;
  var data = await client.auth.getSession();
  if (data && data.data && data.data.session) window.location.replace(target);
}
async function requireSession(loginPage) {
  var client = getClient();
  if (!client) return null;
  var data = await client.auth.getSession();
  if (!data || !data.data || !data.data.session) {
    window.location.replace(loginPage);
    return null;
  }
  return data.data.session.user;
}
async function signInWithGitHub() {
  var client = getClient();
  if (!client) return;
  var btn = document.getElementById('githubBtn');
  var status = document.getElementById('status');
  if (btn) btn.disabled = true;
  if (status) status.textContent = 'Sending you to GitHub…';
  var result = await client.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: window.location.origin + '/hub.html' }
  });
  if (result && result.error && status) {
    status.textContent = 'GitHub sign-in error: ' + result.error.message;
    if (btn) btn.disabled = false;
  }
}
async function signInWithGoogle() {
  var client = getClient();
  if (!client) return;
  var btn = document.getElementById('googleBtn');
  var status = document.getElementById('status');
  if (btn) btn.disabled = true;
  if (status) status.textContent = 'Sending you to Google…';
  var result = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/hub.html' }
  });
  if (result && result.error && status) {
    status.textContent = 'Google sign-in error: ' + result.error.message;
    if (btn) btn.disabled = false;
  }
}
async function signOut() {
  var client = getClient();
  if (client) await client.auth.signOut();
  window.location.replace('index.html');
}
