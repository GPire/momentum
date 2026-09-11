// Pinch zoom also shrinks the visual viewport; it is not a keyboard.
export function keyboardViewportInset(layoutHeight, visualHeight, scale = 1) {
  if (![layoutHeight, visualHeight, scale].every(Number.isFinite) || layoutHeight <= 0 || visualHeight <= 0 || Math.abs(scale - 1) > .01) return 0;
  return Math.max(0, layoutHeight - visualHeight);
}
