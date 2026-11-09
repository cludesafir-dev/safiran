// پلیر صوتی مشترک سایت؛ هر صفحه‌ای که ol.audio-list داشته باشد همین نوار را می‌گیرد
// برای افزودن صدا: فایل را در پوشه‌ی فهرست بگذار و یک خط به items اضافه کن (dur = مدت به ثانیه)
const AUDIO_LISTS = {
  recitations: {
    album: 'تلاوت‌های نوستالژی دکتر جواد فروغی',
    folder: 'audio/recitations/',
    items: [
      { title: 'تلاوت شماره‌ی ۱', file: 'REC001L.mp3', dur: 1467 },
      { title: 'تلاوت شماره‌ی ۲', file: 'REC001L-1.mp3', dur: 1814 },
      { title: 'تلاوت شماره‌ی ۳', file: 'REC001L-2.mp3', dur: 1851 },
      { title: 'تلاوت شماره‌ی ۴', file: 'REC001L-3.mp3', dur: 1858 },
      { title: 'تلاوت شماره‌ی ۵', file: 'REC002L.mp3', dur: 1235 },
      { title: 'تلاوت شماره‌ی ۶', file: 'REC002L-1.mp3', dur: 1815 },
      { title: 'تلاوت شماره‌ی ۷', file: 'REC002L-2.mp3', dur: 1807 },
      { title: 'تلاوت شماره‌ی ۸', file: 'REC002L-3.mp3', dur: 1791 },
      { title: 'تلاوت شماره‌ی ۹', file: 'REC002L-4.mp3', dur: 1869 },
      { title: 'تلاوت شماره‌ی ۱۰', file: 'REC003L.mp3', dur: 1846 },
      { title: 'تلاوت شماره‌ی ۱۱', file: 'REC004L.mp3', dur: 1854 },
      { title: 'تلاوت شماره‌ی ۱۲', file: 'REC005L.mp3', dur: 1816 },
      { title: 'تلاوت شماره‌ی ۱۳', file: 'REC005L-1.mp3', dur: 1877 },
      { title: 'تلاوت شماره‌ی ۱۴', file: 'REC007L.mp3', dur: 1843 },
    ],
  },
  podcasts: {
    album: 'پادکست‌های صوتی',
    folder: 'audio/podcasts/',
    items: [],
  },
};

(() => {
  const listEls = [...document.querySelectorAll('.audio-list[data-list]')];
  if (!listEls.length) return;

  const KEY = 'safiran-player';
  const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const two = n => String(n).padStart(2, '0');
  const clock = s => {
    const t = Math.max(0, Math.floor(s)), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60;
    return fa(h ? `${h}:${two(m)}:${two(t % 60)}` : `${m}:${two(t % 60)}`);
  };
  const icon = name => `<span class="icon solid ${name}" aria-hidden="true"></span>`;

  // ساخت ردیف‌های فهرست
  const rows = [];
  listEls.forEach(el => {
    const key = el.dataset.list, { items } = AUDIO_LISTS[key];
    if (!items.length) {
      el.innerHTML = '<li class="audio-empty">به‌زودی قسمت‌های تازه همین‌جا اضافه می‌شود.</li>';
      return;
    }
    items.forEach((item, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<button type="button" class="audio-row">${icon('fa-play')}<span class="audio-row__title">${item.title}</span><span class="audio-row__dur">${clock(item.dur)}</span></button>`;
      li.firstChild.addEventListener('click', () => pick(key, i));
      el.append(li);
      rows.push({ key, i, li, btn: li.firstChild, ico: li.querySelector('.icon') });
    });
  });
  if (!rows.length) return;

  // نوار پایین صفحه
  const bar = document.createElement('div');
  bar.className = 'player';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'پخش صدا');
  bar.innerHTML = `
    <div class="player__info"><strong class="player__title"></strong><span class="player__status"></span></div>
    <div class="player__btns" dir="ltr">
      <button type="button" class="player__btn" aria-label="قبلی">${icon('fa-step-backward')}</button>
      <button type="button" class="player__btn player__btn--main" aria-label="پخش">${icon('fa-play')}</button>
      <button type="button" class="player__btn" aria-label="بعدی">${icon('fa-step-forward')}</button>
    </div>
    <div class="player__seek" dir="ltr">
      <span class="player__now"></span>
      <input type="range" min="0" step="1" value="0" aria-label="جای پخش">
      <span class="player__total"></span>
    </div>`;
  document.body.append(bar);
  document.body.classList.add('has-player');

  const $ = s => bar.querySelector(s);
  const titleEl = $('.player__title'), statusEl = $('.player__status'), nowEl = $('.player__now'), totalEl = $('.player__total'), seek = $('input');
  const [prevBtn, playBtn, nextBtn] = bar.querySelectorAll('button');
  const playIco = playBtn.querySelector('.icon');

  const audio = new Audio();
  audio.preload = 'none';
  let cur = null, startAt = 0, dragging = false, lastSave = 0;

  const track = () => AUDIO_LISTS[cur.key].items[cur.i];
  const say = (text, err) => {
    statusEl.textContent = text || AUDIO_LISTS[cur.key].album;
    statusEl.classList.toggle('err', !!err);
  };
  const show = t => {
    seek.value = t;
    seek.style.setProperty('--p', `${t / (+seek.max || 1) * 100}%`);
    seek.setAttribute('aria-valuetext', clock(t));
    nowEl.textContent = clock(t);
  };
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify({ key: cur.key, file: track().file, t: Math.floor(+seek.value) })); } catch {}
  };
  const paint = () => {
    const on = !audio.paused;
    playIco.classList.toggle('fa-play', !on);
    playIco.classList.toggle('fa-pause', on);
    playBtn.setAttribute('aria-label', on ? 'توقف' : 'پخش');
    prevBtn.disabled = cur.i === 0;
    nextBtn.disabled = cur.i === AUDIO_LISTS[cur.key].items.length - 1;
    rows.forEach(r => {
      const here = r.key === cur.key && r.i === cur.i;
      r.btn.classList.toggle('is-current', here);
      if (here) r.btn.setAttribute('aria-current', 'true'); else r.btn.removeAttribute('aria-current');
      r.ico.classList.toggle('fa-pause', here && on);
      r.ico.classList.toggle('fa-play', !(here && on));
    });
  };
  const load = (key, i, at = 0) => {
    cur = { key, i };
    const item = track(), list = AUDIO_LISTS[key];
    audio.src = list.folder + item.file;
    startAt = at;
    seek.max = item.dur;
    totalEl.textContent = clock(item.dur);
    titleEl.textContent = item.title;
    say();
    show(at);
    paint();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item.title,
        artist: 'دکتر جواد فروغی',
        album: list.album,
        artwork: [{ src: new URL('img/logo-safiran.png', location.href).href, type: 'image/png' }],
      });
    }
  };
  const play = () => audio.play().catch(() => {});
  const toggle = () => { if (audio.paused) play(); else audio.pause(); };
  function pick(key, i) {
    if (cur.key === key && cur.i === i) return toggle();
    load(key, i);
    play();
    save();
  }
  const step = d => {
    const i = cur.i + d;
    if (i >= 0 && i < AUDIO_LISTS[cur.key].items.length) pick(cur.key, i);
  };
  const jump = t => {
    if (audio.readyState >= 1) audio.currentTime = t; else startAt = t;
    show(t);
    save();
  };

  playBtn.addEventListener('click', toggle);
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  seek.addEventListener('input', () => { dragging = true; show(+seek.value); });
  seek.addEventListener('change', () => { dragging = false; jump(+seek.value); });

  audio.addEventListener('loadedmetadata', () => {
    if (startAt) audio.currentTime = startAt;
    startAt = 0;
  });
  audio.addEventListener('timeupdate', () => {
    if (dragging || startAt) return;
    show(audio.currentTime);
    if (Date.now() - lastSave > 5000) { lastSave = Date.now(); save(); }
  });
  audio.addEventListener('play', paint);
  audio.addEventListener('pause', () => { paint(); save(); });
  audio.addEventListener('waiting', () => say('در حال بارگذاری…'));
  audio.addEventListener('playing', () => say());
  audio.addEventListener('error', () => { if (audio.getAttribute('src')) say('پخش این صدا انجام نشد. لطفاً دوباره امتحان کنید.', true); paint(); });
  audio.addEventListener('ended', () => {
    if (cur.i < AUDIO_LISTS[cur.key].items.length - 1) return step(1);
    load(cur.key, cur.i);
    save();
  });
  addEventListener('pagehide', save);

  // کنترل از صفحه‌ی قفل گوشی
  if ('mediaSession' in navigator) {
    Object.entries({
      play,
      pause: () => audio.pause(),
      previoustrack: () => step(-1),
      nexttrack: () => step(1),
      seekto: d => jump(d.seekTime),
    }).forEach(([action, fn]) => {
      try { navigator.mediaSession.setActionHandler(action, fn); } catch {}
    });
  }

  // برگشت به جای قبلی شنونده
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch {}
  const items = saved && AUDIO_LISTS[saved.key] && listEls.some(el => el.dataset.list === saved.key) ? AUDIO_LISTS[saved.key].items : [];
  const at = items.findIndex(x => x.file === saved?.file);
  if (at >= 0) load(saved.key, at, Math.min(saved.t || 0, items[at].dur - 1));
  else load(rows[0].key, rows[0].i);
})();
