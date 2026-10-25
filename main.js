// تنظیمات فرم ثبت‌نام
// وقتی پروژه‌ی Supabase ساخته شد، آدرس و کلید عمومی (publishable) را این‌جا بگذارید.
// تا آن موقع، فرم یک پیامک آماده به شماره‌ی مؤسسه باز می‌کند.
const CONFIG = {
  phone: '09150900177',
  supabaseUrl: '',
  supabaseKey: '',
  table: 'signups',
};

// منوی موبایل
const menuBtn = document.querySelector('.menu-btn');
const nav = document.getElementById('nav');
menuBtn.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', open);
});
nav.addEventListener('click', e => {
  if (e.target.tagName === 'A') {
    nav.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
});

// دکمه‌ی «ثبت‌نام» روی کارت هر خدمت، همان خدمت را در فرم انتخاب می‌کند
const form = document.getElementById('signup-form');
document.querySelectorAll('.svc__link').forEach(a =>
  a.addEventListener('click', () => { form.service.value = a.dataset.service; })
);

// تبدیل اعداد فارسی/عربی به انگلیسی
const toEn = s => s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

const msg = form.querySelector('.form__msg');
const say = (text, err) => { msg.textContent = text; msg.classList.toggle('err', !!err); };

form.addEventListener('submit', async e => {
  e.preventDefault();
  const data = {
    name: form.name.value.trim(),
    phone: toEn(form.phone.value).replace(/[\s-]/g, ''),
    service: form.service.value,
    mode: form.mode.value,
    note: form.note.value.trim(),
  };
  const bad = [];
  if (data.name.length < 2) bad.push(form.name);
  if (!/^(\+98|0098|0)?9\d{9}$/.test(data.phone)) bad.push(form.phone);
  if (!data.service) bad.push(form.service);
  [form.name, form.phone, form.service].forEach(el => el.setAttribute('aria-invalid', bad.includes(el)));
  if (bad.length) {
    say('لطفاً نام، شماره‌ی موبایل درست و خدمت موردنظر را وارد کنید.', true);
    bad[0].focus();
    return;
  }

  if (CONFIG.supabaseUrl && CONFIG.supabaseKey) {
    say('در حال ارسال…');
    try {
      const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/${CONFIG.table}`, {
        method: 'POST',
        headers: {
          apikey: CONFIG.supabaseKey,
          Authorization: `Bearer ${CONFIG.supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error(r.status);
      form.reset();
      say('درخواست شما ثبت شد. به‌زودی با شما تماس می‌گیریم. 🌿');
    } catch {
      say(`ارسال انجام نشد. لطفاً با شماره‌ی ${CONFIG.phone} تماس بگیرید.`, true);
    }
    return;
  }

  // بدون Supabase: پیامک آماده
  const body = `درخواست ثبت‌نام\nنام: ${data.name}\nموبایل: ${data.phone}\nخدمت: ${data.service}\nنوع جلسه: ${data.mode}` + (data.note ? `\nتوضیح: ${data.note}` : '');
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    location.href = `sms:${CONFIG.phone}?&body=${encodeURIComponent(body)}`;
    say('برنامه‌ی پیامک باز شد؛ فقط دکمه‌ی ارسال را بزنید.');
  } else {
    say(`لطفاً این اطلاعات را با پیامک به ${CONFIG.phone} بفرستید یا تماس بگیرید.`);
  }
});
