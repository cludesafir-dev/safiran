// منطق صفحه‌های ثبت‌نام، ورود، فراموشی رمز و حساب من
(() => {
  const $ = id => document.getElementById(id);
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const sayIn = el => (text, err) => { el.textContent = text; el.classList.toggle('err', !!err); };
  const busy = async (btn, fn) => { btn.disabled = true; try { await fn(); } finally { btn.disabled = false; } };
  document.querySelectorAll('[data-keep-next]').forEach(a => { a.href += location.search; });

  // ثبت‌نام: مرحله‌ی اول اطلاعات، مرحله‌ی دوم کد ایمیل
  const reg = $('register-form');
  if (reg) {
    if (SafiranAuth.signedIn()) location.replace(safiranNext());
    const say = sayIn(reg.querySelector('.form__msg'));
    const step2 = $('verify-form');
    const say2 = sayIn(step2.querySelector('.form__msg'));
    let email = '';
    reg.addEventListener('submit', e => {
      e.preventDefault();
      const full_name = reg.name.value.trim();
      const phone = toEn(reg.phone.value).replace(/[\s-]/g, '');
      email = reg.email.value.trim().toLowerCase();
      const password = reg.password.value;
      if (reg.website.value) return;
      if (full_name.length < 2) return say('لطفاً نام و نام خانوادگی را بنویسید.', true);
      if (!/^(\+98|0098|0)?9\d{9}$/.test(phone)) return say('شماره‌ی موبایل درست نیست.', true);
      if (!EMAIL.test(email)) return say('آدرس جیمیل درست نیست.', true);
      if (password.length < 8) return say('رمز عبور باید حداقل ۸ حرف باشد.', true);
      if (password !== reg.password2.value) return say('رمز عبور و تکرار آن یکسان نیست.', true);
      if (!reg.consent.checked) return say('برای ثبت‌نام، لطفاً قوانین را بپذیرید.', true);
      busy(reg.querySelector('button[type=submit]'), async () => {
        say('در حال ارسال کد…');
        try {
          await SafiranAuth.signUp(email, password, { full_name, phone });
          say('');
          reg.style.display = 'none';
          $('verify-email').textContent = email;
          step2.style.display = '';
          step2.code.focus();
        } catch (err) { say(err.message, true); }
      });
    });
    step2.addEventListener('submit', e => {
      e.preventDefault();
      const code = toEn(step2.code.value).replace(/\s/g, '');
      if (!/^\d{6,10}$/.test(code)) return say2('کد را از جیمیل خود درست وارد کنید.', true);
      busy(step2.querySelector('button[type=submit]'), async () => {
        say2('در حال بررسی…');
        try {
          await SafiranAuth.verifySignup(email, code);
          location.replace(safiranNext());
        } catch (err) { say2(err.message, true); }
      });
    });
    $('resend').addEventListener('click', async () => {
      try { await SafiranAuth.resendSignup(email); say2('کد تازه فرستاده شد. پوشه‌ی Spam را هم نگاه کنید.'); }
      catch (err) { say2(err.message, true); }
    });
  }

  // ورود
  const login = $('login-form');
  if (login) {
    if (SafiranAuth.signedIn()) location.replace(safiranNext());
    const say = sayIn(login.querySelector('.form__msg'));
    login.addEventListener('submit', e => {
      e.preventDefault();
      const email = login.email.value.trim().toLowerCase();
      if (!EMAIL.test(email) || !login.password.value) return say('لطفاً جیمیل و رمز عبور را وارد کنید.', true);
      busy(login.querySelector('button[type=submit]'), async () => {
        say('در حال ورود…');
        try {
          await SafiranAuth.signIn(email, login.password.value);
          location.replace(safiranNext());
        } catch (err) { say(err.message, true); }
      });
    });
  }

  // فراموشی رمز
  const forgot = $('forgot-form');
  if (forgot) {
    const say = sayIn(forgot.querySelector('.form__msg'));
    const step2 = $('reset-form');
    const say2 = sayIn(step2.querySelector('.form__msg'));
    let email = '';
    forgot.addEventListener('submit', e => {
      e.preventDefault();
      email = forgot.email.value.trim().toLowerCase();
      if (!EMAIL.test(email)) return say('آدرس جیمیل درست نیست.', true);
      busy(forgot.querySelector('button[type=submit]'), async () => {
        say('در حال ارسال کد…');
        try {
          await SafiranAuth.recover(email);
          say('');
          forgot.style.display = 'none';
          step2.style.display = '';
          step2.code.focus();
        } catch (err) { say(err.message, true); }
      });
    });
    step2.addEventListener('submit', e => {
      e.preventDefault();
      const code = toEn(step2.code.value).replace(/\s/g, '');
      if (!/^\d{6,10}$/.test(code)) return say2('کد را از جیمیل خود درست وارد کنید.', true);
      if (step2.password.value.length < 8) return say2('رمز تازه باید حداقل ۸ حرف باشد.', true);
      busy(step2.querySelector('button[type=submit]'), async () => {
        say2('در حال بررسی…');
        try {
          await SafiranAuth.verifyRecovery(email, code);
          await SafiranAuth.setPassword(step2.password.value);
          await SafiranAuth.refreshMember();
          location.replace('profile.html');
        } catch (err) { say2(err.message, true); }
      });
    });
  }

  // حساب من
  const prof = $('profile-form');
  if (prof) {
    if (!SafiranAuth.signedIn()) { location.replace('login.html?next=profile.html'); return; }
    const say = sayIn(prof.querySelector('.form__msg'));
    const pass = $('password-form');
    const say2 = sayIn(pass.querySelector('.form__msg'));
    const show = m => {
      $('profile-email').textContent = m.email;
      prof.name.value = m.full_name;
      prof.phone.value = m.phone;
      $('admin-link').style.display = m.is_admin ? '' : 'none';
    };
    SafiranAuth.refreshMember().then(show).catch(err => {
      if (err.code === 'auth' || err.code === 'blocked') location.replace('login.html?next=profile.html');
      else say(err.message, true);
    });
    prof.addEventListener('submit', e => {
      e.preventDefault();
      busy(prof.querySelector('button[type=submit]'), async () => {
        try {
          await SafiranAuth.account('update_profile', { full_name: prof.name.value.trim(), phone: toEn(prof.phone.value) });
          await SafiranAuth.refreshMember();
          say('اطلاعات ذخیره شد.');
        } catch (err) { say(err.code === 'invalid' ? 'نام یا شماره‌ی موبایل درست نیست.' : err.message, true); }
      });
    });
    pass.addEventListener('submit', e => {
      e.preventDefault();
      if (pass.password.value.length < 8) return say2('رمز تازه باید حداقل ۸ حرف باشد.', true);
      if (pass.password.value !== pass.password2.value) return say2('رمز و تکرار آن یکسان نیست.', true);
      busy(pass.querySelector('button[type=submit]'), async () => {
        try { await SafiranAuth.setPassword(pass.password.value); pass.reset(); say2('رمز عبور عوض شد.'); }
        catch (err) { say2(err.message, true); }
      });
    });
    $('logout').addEventListener('click', async () => {
      await SafiranAuth.signOut();
      location.replace('index.html');
    });
  }
})();
