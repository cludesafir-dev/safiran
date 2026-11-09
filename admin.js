// پنل مدیریت اعضا. همه‌ی داده‌ها را سرور فقط به مدیر می‌دهد؛ متن کاربران همیشه escape می‌شود
(() => {
  const root = document.getElementById('admin-app');
  if (!root) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const date = s => { try { return new Date(s).toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }); } catch { return ''; } };
  const STATUS = { new: 'جدید', contacted: 'تماس گرفته شد', done: 'انجام شد' };
  const PAGE = 50;
  let offset = 0, q = '', total = 0;

  const fail = err => {
    if (err.code === 'auth' || err.code === 'blocked') location.replace('login.html?next=admin.html');
    else alert(err.message);
  };

  const shell = () => {
    root.innerHTML = `
      <div class="adm-bar">
        <input id="adm-q" type="search" placeholder="جستجو: نام، موبایل یا ایمیل" aria-label="جستجو">
        <button type="button" class="button ghost-dark" id="adm-recent">آخرین فرم‌ها</button>
        <button type="button" class="button" id="adm-csv">خروجی اکسل</button>
        <button type="button" class="button primary" id="adm-tg">ارسال فهرست به تلگرام</button>
      </div>
      <p class="adm-count" id="adm-count"></p>
      <div class="adm-scroll"><table class="adm-table">
        <thead><tr><th>نام</th><th>موبایل</th><th>ایمیل</th><th>عضویت</th><th>فرم‌ها</th><th>وضعیت</th></tr></thead>
        <tbody id="adm-rows"></tbody>
      </table></div>
      <div class="trow" id="adm-pager"></div>
      <section id="adm-detail" class="adm-detail" hidden></section>`;
    let timer;
    root.querySelector('#adm-q').addEventListener('input', e => {
      clearTimeout(timer);
      timer = setTimeout(() => { q = e.target.value.trim(); offset = 0; list(); }, 300);
    });
    root.querySelector('#adm-csv').addEventListener('click', csv);
    root.querySelector('#adm-recent').addEventListener('click', recent);
    root.querySelector('#adm-tg').addEventListener('click', async e => {
      const b = e.currentTarget;
      b.disabled = true;
      try { await SafiranAuth.account('admin_telegram'); alert('فهرست اعضا به تلگرام فرستاده شد.'); } catch (err) { fail(err); }
      b.disabled = false;
    });
  };

  async function list() {
    try {
      const d = await SafiranAuth.account('admin_list', { q, offset, limit: PAGE });
      total = d.total;
      root.querySelector('#adm-count').textContent = `تعداد اعضا: ${fa(total)}`;
      root.querySelector('#adm-rows').innerHTML = d.members.map(m => `
        <tr data-id="${esc(m.id)}" tabindex="0">
          <td>${esc(m.full_name)}${m.is_admin ? ' <small>(مدیر)</small>' : ''}</td>
          <td dir="ltr">${esc(m.phone)}</td>
          <td dir="ltr">${esc(m.email)}</td>
          <td>${esc(date(m.created_at))}</td>
          <td>${fa(m.submissions?.[0]?.count ?? 0)}</td>
          <td>${m.status === 'blocked' ? '<b class="adm-bad">مسدود</b>' : 'فعال'}</td>
        </tr>`).join('') || '<tr><td colspan="6">عضوی پیدا نشد.</td></tr>';
      const pager = root.querySelector('#adm-pager');
      pager.innerHTML = `${offset > 0 ? '<button type="button" class="button ghost-dark" data-p="-1">قبلی</button>' : '<span></span>'}${offset + PAGE < total ? '<button type="button" class="button ghost-dark" data-p="1">بعدی</button>' : ''}`;
    } catch (err) { fail(err); }
  }

  const subHtml = s => `
    <article class="adm-sub" data-sub="${s.id}">
      <header><b>${esc(s.title)}</b><span>${esc(date(s.created_at))}</span></header>
      <ul>${(Array.isArray(s.lines) ? s.lines : []).map(l => `<li>${esc(l)}</li>`).join('')}</ul>
      <label>وضعیت پیگیری
        <select data-status>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${s.status === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
      </label>
    </article>`;

  async function open(id) {
    const box = root.querySelector('#adm-detail');
    try {
      const { member: m, submissions } = await SafiranAuth.account('admin_member', { id });
      box.hidden = false;
      box.innerHTML = `
        <h3>${esc(m.full_name)}</h3>
        <p dir="ltr" class="adm-contact"><a href="tel:${esc(m.phone)}">${esc(m.phone)}</a> | <a href="mailto:${esc(m.email)}">${esc(m.email)}</a></p>
        <label>یادداشت داخلی (فقط مدیر می‌بیند)
          <textarea id="adm-note" rows="3" maxlength="2000">${esc(m.admin_note)}</textarea>
        </label>
        <div class="trow trow--end">
          <button type="button" class="button" id="adm-save">ذخیره‌ی یادداشت</button>
          ${m.is_admin ? '' : `<button type="button" class="button ghost-dark" id="adm-block">${m.status === 'blocked' ? 'رفع مسدودی' : 'مسدود کردن'}</button>
          <button type="button" class="button ghost-dark adm-danger" id="adm-del">حذف عضو</button>`}
        </div>
        <h4>فرم‌های این عضو (${fa(submissions.length)})</h4>
        ${submissions.map(subHtml).join('') || '<p>هنوز فرمی نفرستاده است.</p>'}`;
      box.querySelector('#adm-save').addEventListener('click', async () => {
        try { await SafiranAuth.account('admin_update', { id, admin_note: box.querySelector('#adm-note').value }); alert('ذخیره شد.'); } catch (err) { fail(err); }
      });
      box.querySelector('#adm-block')?.addEventListener('click', async () => {
        const status = m.status === 'blocked' ? 'active' : 'blocked';
        try { await SafiranAuth.account('admin_update', { id, status }); await list(); await open(id); } catch (err) { fail(err); }
      });
      box.querySelector('#adm-del')?.addEventListener('click', async () => {
        if (!confirm(`حساب «${m.full_name}» و همه‌ی فرم‌هایش برای همیشه حذف شود؟ این کار برگشت‌پذیر نیست.`)) return;
        try { await SafiranAuth.account('admin_delete', { id }); box.hidden = true; await list(); } catch (err) { fail(err); }
      });
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) { fail(err); }
  }

  async function recent() {
    const box = root.querySelector('#adm-detail');
    try {
      const { submissions } = await SafiranAuth.account('admin_recent');
      box.hidden = false;
      box.innerHTML = `<h3>آخرین فرم‌ها</h3>` + (submissions.map(s => `
        <article class="adm-sub" data-member="${esc(s.member_id)}" tabindex="0">
          <header><b>${esc(s.title)}</b><span>${esc(date(s.created_at))} | ${esc(STATUS[s.status] || '')}</span></header>
          <p>${esc(s.members?.full_name)} <span dir="ltr">${esc(s.members?.phone)}</span></p>
        </article>`).join('') || '<p>هنوز فرمی ثبت نشده است.</p>');
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) { fail(err); }
  }

  // خروجی برای اکسل؛ خانه‌هایی که شبیه فرمول‌اند خنثی می‌شوند
  async function csv() {
    try {
      const d = await SafiranAuth.account('admin_list', { limit: 5000 });
      const cell = v => {
        let s = String(v ?? '');
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return `"${s.replace(/"/g, '""')}"`;
      };
      const rows = [['نام', 'موبایل', 'ایمیل', 'تاریخ عضویت', 'تعداد فرم', 'وضعیت', 'یادداشت']]
        .concat(d.members.map(m => [m.full_name, m.phone, m.email, date(m.created_at), m.submissions?.[0]?.count ?? 0, m.status === 'blocked' ? 'مسدود' : 'فعال', m.admin_note]));
      const blob = new Blob(['﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'safiran-members.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) { fail(err); }
  }

  root.addEventListener('click', e => {
    const row = e.target.closest('tr[data-id]');
    if (row) return open(row.dataset.id);
    const sub = e.target.closest('[data-member]');
    if (sub) return open(sub.dataset.member);
    const p = e.target.closest('[data-p]');
    if (p) { offset = Math.max(0, offset + PAGE * +p.dataset.p); list(); }
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('tr[data-id]')) open(e.target.dataset.id);
  });
  root.addEventListener('change', async e => {
    if (!e.target.matches('[data-status]')) return;
    try { await SafiranAuth.account('admin_submission', { id: +e.target.closest('[data-sub]').dataset.sub, status: e.target.value }); } catch (err) { fail(err); }
  });

  (async () => {
    if (!SafiranAuth.signedIn()) { location.replace('login.html?next=admin.html'); return; }
    try {
      const m = await SafiranAuth.refreshMember();
      if (!m.is_admin) { root.innerHTML = '<p class="form__note">این صفحه فقط برای مدیر سایت است.</p>'; return; }
      shell();
      list();
    } catch (err) { fail(err); }
  })();
})();
