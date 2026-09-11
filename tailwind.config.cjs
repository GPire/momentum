module.exports = {
  // DOM markup lives in main.js; exclude multi-megabyte model data and fixtures.
  content: ['./index.html', './src/main.js', './src/ui/**/*.js', './src/i18n/*.js', './src/import/**/*.js', '!./src/**/*.test.js'],
  darkMode: 'class',
  theme: { extend: { fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'], mono: ['"DM Mono"', 'monospace'] } } },
  // Existing runtime color choices in VAT and income cards.
  safelist: ['text-orange-300', 'text-emerald-300', 'text-emerald-400', 'text-amber-300'],
};
