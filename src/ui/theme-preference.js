export function themePreference(state = {}) {
  if (['system', 'light', 'dark'].includes(state.themePreference)) return state.themePreference;
  // Preserve explicit legacy preferences; fresh profiles default to the device.
  if (typeof state.themeDark === 'boolean') return state.themeDark ? 'dark' : 'light';
  return 'system';
}
export function themeIsDark(preference, systemDark) {
  return preference === 'system' ? !!systemDark : preference === 'dark';
}
