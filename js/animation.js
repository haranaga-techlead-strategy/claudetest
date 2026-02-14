/**
 * animation.js - カウントアップアニメーション + スクロール連動フェードイン
 */

document.addEventListener('DOMContentLoaded', () => {
  initScrollFadeIn();
  initCountUp();
});

/* ----- Scroll Fade-In (IntersectionObserver) ----- */
function initScrollFadeIn() {
  const elements = document.querySelectorAll('.fade-in');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -40px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

/* ----- Count-Up Animation ----- */
function initCountUp() {
  const statNumbers = document.querySelectorAll('.hero__stat-number');
  let hasAnimated = false;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasAnimated) {
        hasAnimated = true;
        statNumbers.forEach(el => animateNumber(el));
        observer.disconnect();
      }
    });
  }, { threshold: 0.5 });

  const heroStats = document.querySelector('.hero__stats');
  if (heroStats) {
    observer.observe(heroStats);
  }
}

function animateNumber(el) {
  const target = parseInt(el.dataset.target, 10);
  const suffix = el.dataset.suffix || '';
  const useComma = el.dataset.format === 'comma';
  const duration = 2000;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * target);

    const displayValue = useComma ? current.toLocaleString() : current;
    el.textContent = displayValue + suffix;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}
