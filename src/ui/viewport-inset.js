// Pinch zoom also shrinks the visual viewport; it is not a keyboard.
export function keyboardViewportInset(layoutHeight, visualHeight, scale = 1) {
  if (![layoutHeight, visualHeight, scale].every(Number.isFinite) || layoutHeight <= 0 || visualHeight <= 0 || Math.abs(scale - 1) > .01) return 0;
  return Math.max(0, layoutHeight - visualHeight);
}

// Use the visible rectangle itself, not two independent keyboard subtractions.
export function modalViewport(layoutHeight, visualHeight, offsetTop = 0, scale = 1) {
  const zoomed = !Number.isFinite(scale) || Math.abs(scale - 1) > .01;
  const height = !zoomed && Number.isFinite(visualHeight) && visualHeight > 0 ? visualHeight : layoutHeight;
  return { height: Math.max(0, height || 0), top: zoomed ? 0 : Math.max(0, Number.isFinite(offsetTop) ? offsetTop : 0) };
}
