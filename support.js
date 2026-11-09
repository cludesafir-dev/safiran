// پشتیبانی سایت: جواب خودکار از تابع سرور می‌آید و جواب همکاران از تلگرام، هر دو همین‌جا نمایش داده می‌شود
{
  const KEY = 'safiran-support';
  const POLL_MS = 8000;
  const POLL_FOR_MS = 10 * 60 * 1000;
  const LABELS = { auto: 'پاسخ خودکار', ai: 'پاسخ خودکار (هوش مصنوعی)', human: 'پشتیبانی' };

  const box = document.createElement('div');
  box.className = 'support';
  box.innerHTML = `
    <section class="support__panel" id="support-panel" role="dialog" aria-label="پشتیبانی سایت" hidden>
      <header class="support__head">
        <img class="support__avatar" src="img/logo-safiran.webp" alt="">
        <div>
          <strong>پشتیبانی سایت</strong>
          <span>پاسخگوی سؤالات شما هستیم</span>
        </div>
        <button type="button" class="support__close" aria-label="بستن"><i class="icon solid fa-times" aria-hidden="true"></i></button>
      </header>
      <div class="support__log" aria-live="polite">
        <p class="support__msg">سلام. سؤالتان را بنویسید. سؤال‌های عمومی همین‌جا خودکار جواب داده می‌شود و بقیه را همکاران ما پاسخ می‌دهند.</p>
      </div>
      <form class="support__form" novalidate>
        <div class="support__two">
          <input type="text" name="name" placeholder="نام شما" aria-label="نام شما" autocomplete="name" maxlength="80">
          <input type="tel" name="phone" placeholder="09xxxxxxxxx" aria-label="شماره‌ی موبایل" dir="ltr" inputmode="tel" autocomplete="tel" maxlength="20">
        </div>
        <textarea name="note" rows="2" placeholder="پیام شما" aria-label="پیام شما" maxlength="500"></textarea>
        <label class="form__hp" aria-hidden="true">وب‌سایت<input name="website" tabindex="-1" autocomplete="off"></label>
        <button type="submit" class="support__send">ارسال پیام</button>
        <p class="support__note">بعضی جواب‌های خودکار را هوش مصنوعی می‌نویسد و ممکن است خطا داشته باشد. متن سؤال‌های عمومی برای این کار به سرویس خارجی می‌رود، پس اطلاعات خصوصی ننویسید. نام و شماره‌ی شما به آن داده نمی‌شود.</p>
        <p class="support__status" role="status"></p>
      </form>
    </section>
    <button type="button" class="support__bubble" aria-label="پشتیبانی سایت" aria-expanded="false" aria-controls="support-panel"><i class="icon solid fa-comment-dots" aria-hidden="true"></i></button>`;
  document.body.appendChild(box);

  const panel = box.querySelector('.support__panel');
  const bubble = box.querySelector('.support__bubble');
  const f = box.querySelector('form');
  const two = box.querySelector('.support__two');
  const send = box.querySelector('.support__send');
  const log = box.querySelector('.support__log');
  const status = box.querySelector('.support__status');
  const tell = (text, err) => { status.textContent = text; status.classList.toggle('err', !!err); };

  // گفتگو بین صفحه‌های سایت حفظ می‌شود
  let state = {};
  try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
  if (state.name && state.phone) {
    f.name.value = state.name;
    f.phone.value = state.phone;
    two.hidden = true;
  }

  let lastId = 0, timer = 0, activeUntil = 0;

  const addMsg = m => {
    const p = document.createElement('p');
    p.className = m.role === 'user' ? 'support__msg support__msg--me' : 'support__msg';
    if (LABELS[m.role]) {
      const label = document.createElement('small');
      label.className = 'support__who';
      label.textContent = LABELS[m.role];
      p.appendChild(label);
    }
    p.appendChild(document.createTextNode(m.text));
    log.appendChild(p);
  };
  const render = messages => {
    messages.filter(m => m.id > lastId).forEach(m => { addMsg(m); lastId = m.id; });
    log.scrollTop = log.scrollHeight;
    if (panel.hidden) bubble.classList.toggle('has-new', lastId > (state.seen || 0));
    else if (lastId > (state.seen || 0)) { state.seen = lastId; save(); }
  };
  const api = (action, body) => fetch(`${CONFIG.support}?a=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const poll = async () => {
    if (!state.thread) return;
    try {
      const r = await api('poll', { thread: state.thread, after: lastId });
      if (r.ok) render((await r.json()).messages);
    } catch {}
  };
  // فقط وقتی پنجره باز است و کسی منتظر جواب است از سرور می‌پرسد
  const schedule = () => {
    clearTimeout(timer);
    if (panel.hidden || !state.thread || Date.now() > activeUntil) return;
    timer = setTimeout(async () => {
      if (!document.hidden) await poll();
      schedule();
    }, POLL_MS);
  };
  const wake = () => { activeUntil = Date.now() + POLL_FOR_MS; schedule(); };

  const toggle = open => {
    panel.hidden = !open;
    box.classList.toggle('is-open', open);
    bubble.setAttribute('aria-expanded', open);
    if (open) {
      (two.hidden ? f.note : f.name).focus();
      bubble.classList.remove('has-new');
      state.seen = lastId;
      save();
      log.scrollTop = log.scrollHeight;
      poll();
      wake();
    } else {
      clearTimeout(timer);
    }
  };

  bubble.addEventListener('click', () => toggle(panel.hidden));
  box.querySelector('.support__close').addEventListener('click', () => { toggle(false); bubble.focus(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.hidden) { toggle(false); bubble.focus(); }
  });

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      thread: state.thread,
      after: lastId,
      name: f.name.value.trim(),
      phone: toEn(f.phone.value).replace(/[\s-]/g, ''),
      note: f.note.value.trim(),
      page: document.title.split('|')[0].trim(),
      website: f.website.value,
      consent: true,
    };
    const bad = [];
    if (data.name.length < 2) bad.push(f.name);
    if (!/^(\+98|0098|0)?9\d{9}$/.test(data.phone)) bad.push(f.phone);
    if (data.note.length < 2) bad.push(f.note);
    [f.name, f.phone, f.note].forEach(el => el.setAttribute('aria-invalid', bad.includes(el)));
    if (bad.length) {
      two.hidden = false;
      tell('لطفاً نام، شماره‌ی موبایل درست و پیامتان را بنویسید.', true);
      bad[0].focus();
      return;
    }
    send.disabled = true;
    tell('در حال نوشتن پاسخ…');
    try {
      const r = await api('send', data);
      if (r.status === 429) {
        tell('پیام‌های زیادی فرستاده شده است. لطفاً کمی بعد دوباره امتحان کنید.', true);
      } else if (!r.ok) {
        throw new Error(r.status);
      } else {
        const out = await r.json();
        tell('');
        f.note.value = '';
        if (out.thread) Object.assign(state, { thread: out.thread, name: data.name, phone: data.phone });
        two.hidden = true;
        render(out.messages);
        save();
        wake();
      }
    } catch {
      tell(`ارسال انجام نشد. لطفاً با شماره‌ی ${CONFIG.phone} تماس بگیرید.`, true);
    }
    send.disabled = false;
  });

  poll();
}
