const demo = document.querySelector('[data-journey-demo]');
const toggle = demo?.querySelector('[data-demo-toggle]');
toggle?.addEventListener('click', () => {
  const active = toggle.getAttribute('aria-pressed') !== 'true';
  toggle.setAttribute('aria-pressed', String(active));
  toggle.textContent = active ? toggle.dataset.labelOn : toggle.dataset.labelOff;
  demo.classList.toggle('journey-demo-active', active);
  const status = demo.querySelector('[data-demo-status], [data-demo-row] span');
  if (status?.dataset.labelOn) status.textContent = active ? status.dataset.labelOn : status.dataset.labelOff;
  if (document.body.dataset.journey === 'trips') demo.querySelector('.journey-document strong').textContent = active ? '3 / 3' : '2 / 3';
  if (document.body.dataset.journey === 'tax') {
    demo.querySelector('[data-demo-paid]').textContent = active ? '500 €' : '200 €';
    demo.querySelector('[data-demo-remaining]').textContent = active ? '0 €' : '300 €';
  }
});

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
if (!reduceMotion.matches) {
  const elements = [...document.querySelectorAll('[data-reveal]')];
  if ('IntersectionObserver' in window) {
    document.documentElement.classList.add('journey-motion');
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.05 });
    elements.forEach(element => observer.observe(element));
  }
  let pending = false;
  const scene = document.querySelector('[data-scene]');
  const paint = () => {
    pending = false;
    if (!scene) return;
    const rect = scene.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (innerHeight - rect.top) / (innerHeight + rect.height)));
    scene.style.setProperty('--journey-turn', `${((progress - .5) * 9).toFixed(2)}deg`);
    scene.style.setProperty('--journey-lift', `${((.5 - progress) * 17).toFixed(2)}px`);
  };
  const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(paint); } };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  schedule();
}
