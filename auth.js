// حساب کاربری سایت: ثبت‌نام با کد ایمیل، ورود، و قفل کردن فرم‌ها برای کسانی که وارد نشده‌اند
const SafiranAuth = (() => {
  const BASE = 'https://sbkbmwsavszewsyxcqoz.supabase.co';
  const KEY = 'sb_publishable_MKaoNwyqUkfBtxtDSVQSIA_tC8aaLDK';
  const STORE = 'safiran-session';

  const read = () => { try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; } };
  const write = s => { try { s ? localStorage.setItem(STORE, JSON.stringify(s)) : localStorage.removeItem(STORE); } catch {} };

  const messages = {
    invalid_credentials: 'ایمیل یا رمز عبور اشتباه است.',
    email_not_confirmed: 'ایمیل شما هنوز تأیید نشده است.',
    otp_expired: 'کد اشتباه است یا منقضی شده. کد تازه بگیرید.',
    over_email_send_rate_limit: 'تعداد ایمیل‌های ارسالی زیاد شده است. کمی بعد دوباره امتحان کنید.',
    over_request_rate_limit: 'درخواست‌ها زیاد شده است. کمی بعد دوباره امتحان کنید.',
    weak_password: 'رمز عبور ضعیف است. رمز قوی‌تری انتخاب کنید.',
    same_password: 'رمز تازه باید با رمز قبلی فرق داشته باشد.',
    user_banned: 'این حساب مسدود شده است.',
    email_address_invalid: 'این آدرس ایمیل معتبر نیست.',
    validation_failed: 'لطفاً اطلاعات را درست وارد کنید.',
    user_already_exists: 'این ایمیل قبلاً ثبت‌نام کرده است. از صفحه‌ی ورود وارد شوید.',
    email_address_not_authorized: 'فعلاً امکان ارسال ایمیل به این آدرس نیست. کمی بعد دوباره امتحان کنید.',
  };

  // درخواست به سرویس ورود؛ خطا با متن فارسی برمی‌گردد
  async function gotrue(path, body, token) {
    let r;
    try {
      r = await fetch(`${BASE}/auth/v1/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${token || KEY}` },
        body: JSON.stringify(body),
      });
    } catch { throw Object.assign(new Error('اتصال برقرار نشد. اینترنت خود را بررسی کنید و دوباره امتحان کنید.'), { code: 'network' }); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const code = data.error_code || data.code || '';
      throw Object.assign(new Error(messages[code] || 'انجام نشد. لطفاً دوباره امتحان کنید.'), { code });
    }
    return data;
  }

  const keep = d => {
    const s = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + d.expires_in * 1000, member: read()?.member || null };
    write(s);
    return s;
  };

  async function token() {
    const s = read();
    if (!s) return null;
    if (s.expires_at - Date.now() > 60_000) return s.access_token;
    try {
      return keep(await gotrue('token?grant_type=refresh_token', { refresh_token: s.refresh_token })).access_token;
    } catch (e) {
      if (e.code !== 'network') write(null);
      return null;
    }
  }

  async function account(action, body = {}) {
    const t = await token();
    if (!t) throw Object.assign(new Error('لطفاً دوباره وارد شوید.'), { code: 'auth' });
    let r;
    try {
      r = await fetch(`${BASE}/functions/v1/account?a=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(body),
      });
    } catch { throw Object.assign(new Error('اتصال برقرار نشد. دوباره امتحان کنید.'), { code: 'network' }); }
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) { write(null); throw Object.assign(new Error('لطفاً دوباره وارد شوید.'), { code: 'auth' }); }
    if (r.status === 403 && data.error === 'blocked') { write(null); throw Object.assign(new Error('این حساب مسدود شده است.'), { code: 'blocked' }); }
    if (!r.ok) throw Object.assign(new Error('انجام نشد. لطفاً دوباره امتحان کنید.'), { code: data.error || 'failed' });
    return data;
  }

  // عضو را از سرور می‌گیرد؛ بار اول همان‌جا در بانک اطلاعات ساخته می‌شود
  async function refreshMember() {
    const { member } = await account('me');
    const s = read();
    if (s) write({ ...s, member });
    return member;
  }

  const finish = async d => { keep(d); return refreshMember(); };

  return {
    signedIn: () => !!read(),
    member: () => read()?.member || null,
    token,
    account,
    refreshMember,
    signUp: (email, password, data) => gotrue('signup', { email, password, data }),
    verifySignup: async (email, code) => finish(await gotrue('verify', { type: 'signup', email, token: code })),
    resendSignup: email => gotrue('resend', { type: 'signup', email }),
    signIn: async (email, password) => finish(await gotrue('token?grant_type=password', { email, password })),
    recover: email => gotrue('recover', { email }),
    verifyRecovery: async (email, code) => keep(await gotrue('verify', { type: 'recovery', email, token: code })),
    async setPassword(password) {
      const t = await token();
      const r = await fetch(`${BASE}/auth/v1/user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${t}` },
        body: JSON.stringify({ password }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(messages[data.error_code || data.code] || 'تغییر رمز انجام نشد.');
      }
    },
    async signOut() {
      const s = read();
      write(null);
      if (s) try { await fetch(`${BASE}/auth/v1/logout`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${s.access_token}` } }); } catch {}
    },
    // نام و موبایل عضو را در فرم می‌گذارد
    prefill(f) {
      const m = read()?.member;
      if (!m) return;
      if (f.name && !f.name.value) f.name.value = m.full_name;
      if (f.phone && !f.phone.value) f.phone.value = m.phone;
    },
  };
})();

// بعد از ورود به همان صفحه‌ای برمی‌گردد که کاربر از آن آمده بود
const safiranNext = () => {
  const n = new URLSearchParams(location.search).get('next') || '';
  return /^[a-z0-9-]+\.html(#[a-z0-9-]+)?$/i.test(n) ? n : 'index.html';
};

(() => {
  const here = location.pathname.split('/').pop() || 'index.html';

  // دکمه‌ی بالای سایت
  const cta = document.querySelector('.head-cta');
  if (cta && SafiranAuth.signedIn()) {
    cta.textContent = 'حساب من';
    cta.href = 'profile.html';
  }

  // فرم‌های ثبت‌نام فقط برای اعضا
  document.querySelectorAll('form[data-kind], #linkade-form, #producer-form').forEach(f => {
    if (SafiranAuth.signedIn()) { SafiranAuth.prefill(f); return; }
    f.style.display = 'none';
    const box = document.createElement('div');
    box.className = 'auth-gate';
    box.innerHTML = `<h3>برای ثبت درخواست، اول وارد حساب خود شوید</h3>
      <p>اگر هنوز عضو سایت نیستید، با جیمیل خود ثبت‌نام کنید؛ کمتر از یک دقیقه طول می‌کشد.</p>
      <ul class="actions">
        <li><a class="button primary" href="register.html?next=${encodeURIComponent(here)}">ثبت‌نام در سایت</a></li>
        <li><a class="button ghost-dark" href="login.html?next=${encodeURIComponent(here)}">ورود</a></li>
      </ul>`;
    f.before(box);
  });
})();
