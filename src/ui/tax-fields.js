// Presentation only: retain the original controls, IDs, values and listeners.
export function enhanceTaxFields(container) {
  const root = container.querySelector('.tax-workspace-step');
  if (!root) return;
  for (const input of root.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="file"]):not([type="color"])')) {
    if (input.closest('label') || (input.id && root.querySelector(`label[for="${input.id}"]`))) continue;
    const title = input.getAttribute('aria-label') || input.getAttribute('placeholder');
    if (!title) continue;
    const label = document.createElement('label');
    label.className = 'tax-field';
    if (input.classList.contains('col-span-2')) label.classList.add('col-span-2');
    const caption = document.createElement('span');
    caption.className = 'tax-field-caption';
    caption.textContent = title;
    input.before(label);
    label.append(caption, input);
    // Long instructions remain visible above the field instead of clipping inside it.
    if (title.length > 32 || input.getAttribute('placeholder') === title) input.removeAttribute('placeholder');
  }
}
