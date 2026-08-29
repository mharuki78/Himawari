const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('.site-nav');
const menuLabel = menuButton.querySelector('.sr-only');

function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  menuLabel.textContent = '메뉴 열기';
  navigation.classList.remove('is-open');
  document.body.style.overflow = '';
}

menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  menuLabel.textContent = isOpen ? '메뉴 열기' : '메뉴 닫기';
  navigation.classList.toggle('is-open', !isOpen);
  document.body.style.overflow = isOpen ? '' : 'hidden';
});

navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navigation.classList.contains('is-open')) {
    closeMenu();
    menuButton.focus();
  }
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reducedMotion || !('IntersectionObserver' in window)) {
  document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
}

const form = document.querySelector('.contact-form');
const status = form.querySelector('.form-status');
const fields = [...form.querySelectorAll('input, textarea')];

function validate(field) {
  const error = document.querySelector(`#${field.id}-error`);
  let message = '';
  if (!field.value.trim()) message = `${field.labels[0].textContent}을(를) 입력해 주세요.`;
  if (field.type === 'email' && field.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) message = '올바른 이메일 주소를 입력해 주세요.';
  error.textContent = message;
  field.setAttribute('aria-invalid', String(Boolean(message)));
  field.setAttribute('aria-describedby', error.id);
  return !message;
}

fields.forEach((field) => field.addEventListener('blur', () => validate(field)));
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const valid = fields.map(validate).every(Boolean);
  if (!valid) {
    fields.find((field) => field.getAttribute('aria-invalid') === 'true')?.focus();
    status.textContent = '입력 내용을 확인해 주세요.';
    return;
  }
  status.textContent = '문의가 접수된 예시 상태입니다. 실제 발송 기능은 이후 연결할 수 있어요.';
  form.reset();
  fields.forEach((field) => field.removeAttribute('aria-invalid'));
});

document.querySelector('#year').textContent = new Date().getFullYear();
