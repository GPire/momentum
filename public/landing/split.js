const toggle = document.getElementById('demo-toggle');
const taxi = document.getElementById('taxi-row');
const taxiStatus = document.getElementById('taxi-status');
const total = document.getElementById('demo-total');

toggle?.addEventListener('click', () => {
  const clarified = toggle.getAttribute('aria-pressed') !== 'true';
  toggle.setAttribute('aria-pressed', String(clarified));
  toggle.firstChild.textContent = clarified ? 'Rimetti in verifica il taxi ' : 'Chiarisci il taxi ';
  taxi.classList.toggle('disputed', !clarified);
  taxiStatus.textContent = clarified ? 'chiarito · nel saldo' : 'contestato · fuori dal saldo';
  total.textContent = clarified ? '60 €' : '48 €';
});

if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const reveals = document.querySelectorAll('[data-reveal]');
  const revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
  reveals.forEach(element => revealObserver.observe(element));
  document.documentElement.classList.add('split-motion');

  const scenes = [...document.querySelectorAll('[data-scene]')];
  let pending = false;
  function paintScenes() {
    pending = false;
    const height = innerHeight;
    const values = scenes.map(element => {
      const rect = element.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (height - rect.top) / (height + rect.height)));
      return { element, progress };
    });
    for (const { element, progress } of values) {
      element.style.setProperty('--scene-turn', `${((progress - 0.5) * 9).toFixed(2)}deg`);
      element.style.setProperty('--scene-lift', `${((0.5 - progress) * 16).toFixed(2)}px`);
      element.style.setProperty('--scene-progress', progress.toFixed(3));
    }
  }
  function schedulePaint() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(paintScenes);
  }
  addEventListener('scroll', schedulePaint, { passive: true });
  addEventListener('resize', schedulePaint, { passive: true });
  schedulePaint();
}
