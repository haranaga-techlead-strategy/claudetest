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

/* ----- Contact Form Validation ----- */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
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

    if (isValid) {
      alert('送信機能は現在未設定です。フォーム送信先を設定してください。');
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
