// منوی موبایل و تیره شدن نوار بالا هنگام اسکرول
{
  const head = document.querySelector('.site-head');
  const toggle = head.querySelector('.nav-toggle');
  const icon = toggle.querySelector('.icon');
  const setOpen = open => {
    document.body.classList.toggle('is-navPanel-visible', open);
    toggle.setAttribute('aria-expanded', open);
    icon.classList.toggle('fa-bars', !open);
    icon.classList.toggle('fa-times', open);
  };
  const onScroll = () => head.classList.toggle('is-stuck', scrollY > 24);

  toggle.addEventListener('click', () => setOpen(!document.body.classList.contains('is-navPanel-visible')));
  head.querySelectorAll('.site-links a').forEach(a => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
