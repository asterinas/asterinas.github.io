window.addEventListener('DOMContentLoaded', function () {
  const nav = document.querySelector('.site-nav');
  if (!nav) {
    return;
  }

  const toggle = nav.querySelector('.site-nav-toggle');
  const menu = nav.querySelector('.site-nav-menu');
  if (!toggle || !menu) {
    return;
  }

  const closeMenu = function () {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', function (event) {
    event.stopPropagation();
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  menu.addEventListener('click', function (event) {
    if (event.target.closest('a')) {
      closeMenu();
    }
  });

  document.addEventListener('click', function (event) {
    if (!nav.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });
});
