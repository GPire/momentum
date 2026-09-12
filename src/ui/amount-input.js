// Measure the actual field, including narrow sheets and enlarged system text.
export function fitAmountInput(input) {
  if (!input?.clientWidth) return;
  const style = getComputedStyle(input);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;
  context.font = `${style.fontWeight} 42px ${style.fontFamily}`;
  const width = context.measureText(input.value || '0').width;
  const available = input.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0) - 8;
  input.style.setProperty('--amount-size', `${Math.max(16, Math.min(42, 42 * available / Math.max(1, width)))}px`);
}

export function fitVisibleAmounts() {
  document.querySelectorAll('input.amount-display').forEach(fitAmountInput);
}
