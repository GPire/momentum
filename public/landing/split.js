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

const motionMedia = matchMedia('(prefers-reduced-motion: reduce)');
const motionControl = document.getElementById('split-motion-control');
let motionChoice = 'auto';
try {
  const saved = sessionStorage.getItem('momentum_landing_motion');
  if (saved === 'on' || saved === 'off') motionChoice = saved;
} catch {}
const scenes = [...document.querySelectorAll('[data-scene]')];
const reveals = [...document.querySelectorAll('[data-reveal]')];
const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add('is-visible');
    revealObserver.unobserve(entry.target);
  }
}, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 }) : null;
let pending = false;
function paintScenes() {
  pending = false;
  if (!document.documentElement.classList.contains('split-motion')) return;
  const height = innerHeight;
  for (const element of scenes) {
    const rect = element.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (height - rect.top) / (height + rect.height)));
    element.style.setProperty('--scene-turn', `${((progress - 0.5) * 9).toFixed(2)}deg`);
    element.style.setProperty('--scene-lift', `${((0.5 - progress) * 16).toFixed(2)}px`);
    element.style.setProperty('--scene-progress', progress.toFixed(3));
  }
}
function schedulePaint() {
  if (pending || !document.documentElement.classList.contains('split-motion')) return;
  pending = true;
  requestAnimationFrame(paintScenes);
}
addEventListener('scroll', schedulePaint, { passive: true });
addEventListener('resize', schedulePaint, { passive: true });
function applyMotion() {
  const enabled = motionChoice === 'on' || (motionChoice === 'auto' && !motionMedia.matches);
  document.documentElement.classList.toggle('motion-override', motionChoice === 'on');
  document.documentElement.classList.toggle('split-motion', enabled);
  motionControl.hidden = !motionMedia.matches && motionChoice === 'auto';
  motionControl.setAttribute('aria-pressed', String(enabled));
  document.getElementById('split-motion-label').textContent = enabled ? 'Riduci animazioni' : 'Attiva animazioni';
  if (enabled) {
    if (revealObserver) reveals.forEach(element => {
      if (!element.classList.contains('is-visible')) revealObserver.observe(element);
    });
    else reveals.forEach(element => element.classList.add('is-visible'));
    schedulePaint();
  }
}
motionControl.addEventListener('click', () => {
  motionChoice = motionControl.getAttribute('aria-pressed') === 'true' ? 'off' : 'on';
  try { sessionStorage.setItem('momentum_landing_motion', motionChoice); } catch {}
  applyMotion();
});
motionMedia.addEventListener?.('change', applyMotion);
applyMotion();
