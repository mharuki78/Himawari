import { SPEC_FIELDS, normalizeSpecs, normalizeRelatedIds } from '../assets/product-specs.js';

export function createSpecEditor(form) {
  const panel = document.createElement('fieldset');
  panel.className = 'admin-spec-editor';
  const legend = document.createElement('legend'); legend.textContent = '실측·소재·관리 안내'; panel.append(legend);
  const help = document.createElement('p'); help.textContent = '실제 확인한 값만 입력해 주세요. 빈 항목은 고객에게 미확인으로 안내합니다. 색상·크기 옵션별로 각각 저장됩니다.'; panel.append(help);
  for (const [key, label] of [...SPEC_FIELDS, ['relatedProductIds', '호환 구성품 상품 ID (쉼표로 구분)']]) {
    const row = document.createElement('div'); row.className = 'form-field';
    const title = document.createElement('label'); title.htmlFor = `spec-${key}`; title.textContent = label;
    const input = document.createElement('input'); input.type = 'text'; input.id = `spec-${key}`; input.name = `spec-${key}`; input.maxLength = 600;
    row.append(title, input); panel.append(row);
  }
  form.insertBefore(panel, form.querySelector('.product-form-actions'));
  return {
    read: () => ({ specs: normalizeSpecs(Object.fromEntries(SPEC_FIELDS.map(([key]) => [key, form.elements.namedItem(`spec-${key}`).value]))), relatedProductIds: normalizeRelatedIds(form.elements.namedItem('spec-relatedProductIds').value.split(',').map(x => x.trim())) }),
    fill(product) { for (const [key] of SPEC_FIELDS) form.elements.namedItem(`spec-${key}`).value = product.specs?.[key] || ''; form.elements.namedItem('spec-relatedProductIds').value = (product.relatedProductIds || []).join(', '); },
  };
}
