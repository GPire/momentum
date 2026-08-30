import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// BUG DI SETTORE, non solo nostro (verificato via ricerca web 2026-08-30):
// su iOS Safari in modalità standalone (PWA installata), WebKit può
// smettere di controllare aggiornamenti del service worker per lunghi
// periodi, o azzerarne lo stato dopo inattività — un limite della
// piattaforma, non risolvibile lato codice agendo SOLO sul ciclo di vita
// del service worker (già solido: updateViaCache:'none', skipWaiting,
// controlli su focus/visibilitychange/30min, vedi main.js). Questo
// timestamp, generato una volta per build e scritto sia nel bundle che in
// version.json (public/_headers forza no-store su tutto), dà all'app un
// SECONDO canale di rilevamento aggiornamenti che non dipende AFFATTO dal
// ciclo di vita del service worker — un semplice fetch, confrontato ad
// ogni apertura/focus, funziona anche quando WebKit ignora il SW.
const BUILD_VERSION = String(Date.now());

function versionJsonPlugin() {
  return {
    name: 'momentum-version-json',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: BUILD_VERSION }) });
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  build: {
    outDir: mode === 'singlefile' ? 'dist-singlefile' : 'dist',
    target: 'es2020',
  },
  plugins: [versionJsonPlugin(), ...(mode === 'singlefile' ? [viteSingleFile()] : [])],
}));
