(() => {
  const forms = [...document.querySelectorAll('[data-inquiry-form]')];
  if (!forms.length) return;

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const cartInquiryKey = 'himawari-cart-inquiry';

  function readCartInquiry() {
    if (new URLSearchParams(location.search).get('from') !== 'cart') return null;
    try {
      const value = JSON.parse(sessionStorage.getItem(cartInquiryKey));
      const fresh = value && value.version === 1 && Date.now() - Number(value.createdAt) < 30 * 60 * 1000;
      return fresh && typeof value.text === 'string' && value.text.trim() ? value : null;
    } catch {
      return null;
    }
  }

  const cartInquiry = readCartInquiry();

  function createRequestId() {
    const inverseTime = String(9_999_999_999_999 - Date.now()).padStart(13, '0');
    const randomId = crypto.randomUUID?.() || (() => {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    })();
    return `${inverseTime}-${randomId}`;
  }

  forms.forEach((form) => {
    const controls = {
      name: form.elements.namedItem('name'),
      email: form.elements.namedItem('email'),
      subject: form.elements.namedItem('subject'),
      message: form.elements.namedItem('message'),
      consent: form.elements.namedItem('consent'),
      website: form.elements.namedItem('website'),
    };
    const submitButton = form.querySelector('button[type="submit"]');
    const submitLabel = form.querySelector('[data-submit-label]');
    const status = form.querySelector('.form-status');
    let requestId = createRequestId();
    let pending = false;

    if (cartInquiry) {
      if (!controls.subject.value) controls.subject.value = '장바구니 주문 문의';
      if (!controls.message.value) {
        controls.message.value = `다음 제품의 주문을 문의합니다.\n\n${cartInquiry.text}\n\n배송 및 구매 방법을 안내해 주세요.`;
      }
      status.textContent = '장바구니 내용을 불러왔습니다. 답변받을 정보를 입력해 주세요.';
    }

    function errorNode(control) {
      const describedBy = control?.getAttribute('aria-describedby');
      return describedBy ? form.querySelector(`#${CSS.escape(describedBy)}`) : null;
    }

    function setError(control, message) {
      if (!control) return;
      const error = errorNode(control);
      if (error) error.textContent = message;
      control.setAttribute('aria-invalid', message ? 'true' : 'false');
    }

    function validate(name) {
      const control = controls[name];
      if (!control) return true;
      const value = control.type === 'checkbox' ? control.checked : control.value.trim();
      let message = '';

      if (name === 'name' && !value) message = '이름을 입력해 주세요.';
      if (name === 'name' && typeof value === 'string' && value.length > 60) message = '이름은 60자 이내로 입력해 주세요.';
      if (name === 'email' && !value) message = '답변을 받을 이메일을 입력해 주세요.';
      if (name === 'email' && value && !emailPattern.test(value)) message = '이메일 주소 형식을 확인해 주세요.';
      if (name === 'subject' && !value) message = '문의 제목을 입력해 주세요.';
      if (name === 'subject' && typeof value === 'string' && value.length > 120) message = '문의 제목은 120자 이내로 입력해 주세요.';
      if (name === 'message' && !value) message = '문의 내용을 입력해 주세요.';
      if (name === 'message' && typeof value === 'string' && value.length < 10) message = '문의 내용을 10자 이상 입력해 주세요.';
      if (name === 'message' && typeof value === 'string' && value.length > 4000) message = '문의 내용은 4,000자 이내로 입력해 주세요.';
      if (name === 'consent' && !value) message = '문의 접수를 위해 보관 안내에 동의해 주세요.';

      setError(control, message);
      return !message;
    }

    Object.entries(controls).forEach(([name, control]) => {
      if (!control || name === 'website') return;
      control.addEventListener('blur', () => validate(name));
      control.addEventListener('input', () => {
        if (control.getAttribute('aria-invalid') === 'true') validate(name);
      });
      if (control.type === 'checkbox') {
        control.addEventListener('change', () => validate(name));
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (pending) return;

      const fieldNames = ['name', 'email', 'subject', 'message', 'consent'];
      const valid = fieldNames.map(validate).every(Boolean);
      if (!valid) {
        status.textContent = '입력 내용을 확인해 주세요.';
        fieldNames.map((name) => controls[name]).find((control) => control?.getAttribute('aria-invalid') === 'true')?.focus();
        return;
      }

      pending = true;
      submitButton.disabled = true;
      submitButton.setAttribute('aria-busy', 'true');
      submitLabel.textContent = '안전하게 접수하는 중';
      status.textContent = '비공개 문의를 저장하고 있습니다.';

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20_000);

      try {
        const response = await fetch('/api/inquiries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId,
            name: controls.name.value,
            email: controls.email.value,
            subject: controls.subject.value,
            message: controls.message.value,
            consent: controls.consent.checked,
            website: controls.website?.value || '',
          }),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (payload.fieldErrors) {
            Object.entries(payload.fieldErrors).forEach(([name, message]) => setError(controls[name], message));
            fieldNames.map((name) => controls[name]).find((control) => control?.getAttribute('aria-invalid') === 'true')?.focus();
          }
          throw new Error(payload.message || '문의 접수에 실패했습니다.');
        }

        form.reset();
        if (cartInquiry) sessionStorage.removeItem(cartInquiryKey);
        fieldNames.forEach((name) => setError(controls[name], ''));
        requestId = createRequestId();
        status.textContent = '비공개 문의가 접수되었습니다. 확인 후 입력하신 이메일로 답변드리겠습니다.';
      } catch (error) {
        status.textContent = error.name === 'AbortError'
          ? '접수 확인이 지연되고 있습니다. 잠시 후 다시 눌러 확인해 주세요. 같은 문의는 중복 저장되지 않습니다.'
          : error.message || '문의 접수에 실패했습니다. 입력 내용은 유지되므로 잠시 후 다시 시도해 주세요.';
      } finally {
        window.clearTimeout(timeout);
        pending = false;
        submitButton.disabled = false;
        submitButton.removeAttribute('aria-busy');
        submitLabel.textContent = '비공개 문의 접수';
      }
    });
  });
})();
