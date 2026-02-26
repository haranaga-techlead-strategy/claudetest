/**
 * main.js - ナビゲーション、スクロール、メニュー、フォームバリデーション
 */

document.addEventListener('DOMContentLoaded', () => {
  initStickyHeader();
  initMobileMenu();
  initSmoothScroll();
  initContactForm();
  initLucideIcons();
});

/* ----- Sticky Header ----- */
function initStickyHeader() {
  const header = document.getElementById('header');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    if (currentScroll > 50) {
      header.classList.add('header--scrolled');
    } else {
      header.classList.remove('header--scrolled');
    }
    lastScroll = currentScroll;
  }, { passive: true });
}

/* ----- Mobile Menu ----- */
function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');

  hamburger.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    hamburger.classList.toggle('active');
    hamburger.setAttribute('aria-expanded', isOpen);
  });

  // Close menu when a nav link is clicked
  nav.querySelectorAll('.header__nav-link').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ----- Smooth Scroll ----- */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      e.preventDefault();
      const target = document.querySelector(targetId);
      if (!target) return;

      const headerHeight = 64;
      const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    });
  });
}

/* ----- Contact Form (Azure Functions API) ----- */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let isValid = true;

    // Name validation
    const name = form.querySelector('#name');
    const nameError = form.querySelector('#nameError');
    if (!name.value.trim()) {
      showError(name, nameError, 'お名前を入力してください');
      isValid = false;
    } else {
      clearError(name, nameError);
    }

    // Email validation
    const email = form.querySelector('#email');
    const emailError = form.querySelector('#emailError');
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.value.trim()) {
      showError(email, emailError, 'メールアドレスを入力してください');
      isValid = false;
    } else if (!emailPattern.test(email.value.trim())) {
      showError(email, emailError, '正しいメールアドレスを入力してください');
      isValid = false;
    } else {
      clearError(email, emailError);
    }

    // Message validation
    const message = form.querySelector('#message');
    const messageError = form.querySelector('#messageError');
    if (!message.value.trim()) {
      showError(message, messageError, 'メッセージを入力してください');
      isValid = false;
    } else {
      clearError(message, messageError);
    }

    if (!isValid) return;

    // Azure Functions API へ送信
    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '送信中...';

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.value.trim(),
          email: email.value.trim(),
          subject: (form.querySelector('#subject') || {}).value || '',
          message: message.value.trim()
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showFormSuccess(form, data.message || 'お問い合わせを受け付けました。');
      } else {
        // サーバー側バリデーションエラーを反映
        if (data.errors) {
          if (data.errors.name)    showError(name, nameError, data.errors.name);
          if (data.errors.email)   showError(email, emailError, data.errors.email);
          if (data.errors.message) showError(message, messageError, data.errors.message);
        } else {
          showFormError(form, data.error || '送信に失敗しました。しばらくしてから再度お試しください。');
        }
      }
    } catch (err) {
      showFormError(form, 'ネットワークエラーが発生しました。接続を確認してください。');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '送信する';
    }
  });

  // Clear error on input
  form.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('input', () => {
      const errorEl = input.parentElement.querySelector('.form-error');
      clearError(input, errorEl);
    });
  });
}

function showFormSuccess(form, message) {
  let notice = form.querySelector('.form-notice');
  if (!notice) {
    notice = document.createElement('p');
    notice.className = 'form-notice';
    form.appendChild(notice);
  }
  notice.textContent = message;
  notice.style.color = '#16a34a';
  notice.style.marginTop = '12px';
  notice.style.fontWeight = '600';
  form.reset();
}

function showFormError(form, message) {
  let notice = form.querySelector('.form-notice');
  if (!notice) {
    notice = document.createElement('p');
    notice.className = 'form-notice';
    form.appendChild(notice);
  }
  notice.textContent = message;
  notice.style.color = '#dc2626';
  notice.style.marginTop = '12px';
  notice.style.fontWeight = '600';
}

function showError(input, errorEl, message) {
  input.classList.add('error');
  if (errorEl) errorEl.textContent = message;
}

function clearError(input, errorEl) {
  input.classList.remove('error');
  if (errorEl) errorEl.textContent = '';
}

/* ----- Lucide Icons Init ----- */
function initLucideIcons() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  } else {
    // Retry after CDN loads (defer script)
    window.addEventListener('load', () => {
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    });
  }
}
