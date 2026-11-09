// فرم‌های خدمات: همه با data-kind می‌آیند و از یک تابع مشترک ارسال می‌شوند (sendForm در site.js)
document.querySelectorAll('form[data-kind]').forEach(f => {
  const msg = f.querySelector('.form__msg');
  const say = (text, err) => { msg.textContent = text; msg.classList.toggle('err', !!err); };

  // نتیجه‌ی تست علایق و شخصیت، اگر کاربر آن را انجام داده باشد
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('safiran-test')); } catch {}
  const valid = saved && saved.h && saved.b && Object.keys(saved.h).length === 6 && Object.keys(saved.b).length === 5;
  const slot = document.createElement('div');
  slot.className = 'form__test';
  if (valid) {
    const code = Object.entries(saved.h).map(([k, v], i) => [k, v, i]).sort((x, y) => y[1] - x[1] || x[2] - y[2]).slice(0, 3).map(x => x[0]).join('');
    slot.innerHTML = `<label class="form__check"><input type="checkbox" name="withtest"><span>نتیجه‌ی تست علایق و شخصیت من (کد <b dir="ltr">${code}</b>) هم همراه این فرم برای تیم مؤسسه فرستاده شود. (اختیاری)</span></label>`;
  } else {
    slot.innerHTML = '<p class="form__hint">اگر <a href="test.html">تست علایق و شخصیت</a> را انجام دهید، می‌توانید نتیجه‌اش را همراه این فرم بفرستید. (اختیاری)</p>';
  }
  f.querySelector('.form__check').before(slot);

  // سقف انتخاب در گروه‌های چندگزینه‌ای
  f.querySelectorAll('fieldset[data-type=checks]').forEach(box => box.addEventListener('change', e => {
    const max = +box.dataset.max;
    const picked = box.querySelectorAll('input:checked');
    if (max && picked.length > max) {
      e.target.checked = false;
      say(`در این بخش حداکثر ${max} مورد را می‌توانید انتخاب کنید.`, true);
    } else if (msg.textContent.startsWith('در این بخش')) say('');
  }));

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const bad = [];
    const answers = {};
    f.querySelectorAll('[aria-invalid=true]').forEach(el => el.removeAttribute('aria-invalid'));
    const mark = el => { el.setAttribute('aria-invalid', 'true'); bad.push(el); };

    const name = f.name.value.trim();
    const phone = toEn(f.phone.value).replace(/[\s-]/g, '');
    if (name.length < 2) mark(f.name);
    if (!/^(\+98|0098|0)?9\d{9}$/.test(phone)) mark(f.phone);

    f.querySelectorAll('[data-q]').forEach(box => {
      const key = box.dataset.q, type = box.dataset.type, need = box.dataset.required === '1';
      if (type === 'select' || type === 'area') {
        const el = box.querySelector('select,textarea');
        const val = el.value.trim();
        const min = +box.dataset.min || 0;
        if ((need && !val) || (val && val.length < min)) mark(el);
        answers[key] = val;
      } else if (type === 'radio') {
        const val = box.querySelector('input:checked')?.value || '';
        if (need && !val) mark(box);
        answers[key] = val;
      } else {
        const vals = [...box.querySelectorAll('input:checked')].map(i => i.value);
        if (need && !vals.length) mark(box);
        answers[key] = vals;
      }
    });

    if (bad.length) {
      say('لطفاً بخش‌های قرمز را کامل کنید.', true);
      const first = bad[0];
      (first.matches('fieldset') ? first.querySelector('input') : first).focus();
      return;
    }
    if (!f.consent.checked) {
      say('برای ارسال، لطفاً تیک موافقت را بزنید.', true);
      f.consent.focus();
      return;
    }
    await sendForm(f, {
      kind: f.dataset.kind,
      name,
      phone,
      answers,
      website: f.website.value,
      consent: true,
      ...(valid && f.withtest?.checked ? { test: { h: saved.h, b: saved.b } } : {}),
    }, say, f.dataset.success);
    if (msg.textContent === f.dataset.success) msg.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
});
