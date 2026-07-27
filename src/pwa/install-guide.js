// Guida di installazione PWA: rileva piattaforma/browser REALI (mai un
// suggerimento generico uguale per tutti) e restituisce i passi corretti in
// linguaggio semplice ("comprensibile anche a un bambino"). Funzione pura,
// testabile: prende userAgent come parametro invece di leggere
// navigator.userAgent direttamente, mai un side-effect nascosto.
'use strict';

function detectOS(ua) {
  if (/iPad|iPhone|iPod/.test(ua) && !/Windows Phone/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)) return 'mac';
  if (/Windows/.test(ua)) return 'windows';
  return 'altro';
}

function detectBrowser(ua) {
  if (/EdgiOS|EdgA|Edg\//.test(ua)) return 'edge';
  if (/CriOS|Chrome\//.test(ua) && !/Edg|OPR|SamsungBrowser/.test(ua)) return 'chrome';
  if (/FxiOS|Firefox\//.test(ua)) return 'firefox';
  if (/SamsungBrowser/.test(ua)) return 'samsung';
  if (/Safari\//.test(ua) && !/Chrome|CriOS|Firefox|FxiOS/.test(ua)) return 'safari';
  return 'altro';
}

// `standalone` = l'app gira già installata (display-mode:standalone o
// navigator.standalone su iOS) — se true non ha senso mostrare una guida.
export function detectPlatform(userAgent = '', { standalone = false } = {}) {
  const os = detectOS(userAgent);
  const browser = detectBrowser(userAgent);
  // beforeinstallprompt (installazione con un tap) esiste SOLO su Chrome/
  // Edge/Samsung Internet su Android e desktop — mai su iOS/Safari (Apple
  // non lo supporta, richiede sempre i passi manuali) — dichiarato onestamente,
  // mai un pulsante "Installa" che poi non fa nulla su iOS.
  const supportsNativePrompt = (os === 'android' || os === 'windows' || os === 'mac')
    && ['chrome', 'edge', 'samsung'].includes(browser);
  return { os, browser, standalone, supportsNativePrompt };
}

// Passi in linguaggio semplice, un'azione per riga. `icon` è una chiave
// testuale (share/menu/plus/home) che la UI traduce in un'icona reale — mai
// testo tecnico ("tocca l'ellissi"), sempre concreto ("tocca i tre puntini").
export function installSteps(platform) {
  const { os, browser, standalone } = platform;
  if (standalone) return { title: 'App già installata', steps: [] };

  if (os === 'ios') {
    if (browser === 'safari') {
      return {
        title: 'Installa su iPhone/iPad (Safari)',
        steps: [
          { icon: 'share', text: 'Tocca l\'icona Condividi (il quadrato con la freccia verso l\'alto), in basso al centro' },
          { icon: 'plus', text: 'Scorri e tocca "Aggiungi a Home"' },
          { icon: 'home', text: 'Tocca "Aggiungi": l\'icona di Momentum apparirà sulla schermata Home' },
        ],
      };
    }
    // Chrome/Firefox su iOS: stesso motore Safari sotto, stesso percorso di
    // condivisione — Apple obbliga tutti i browser iOS a usare WebKit.
    return {
      title: 'Installa su iPhone/iPad',
      steps: [
        { icon: 'info', text: 'Su iPhone/iPad solo Safari può installare le app — apri questa pagina in Safari' },
        { icon: 'share', text: 'Poi tocca Condividi → "Aggiungi a Home"' },
      ],
    };
  }

  if (os === 'android') {
    if (['chrome', 'edge', 'samsung'].includes(browser)) {
      return {
        title: 'Installa su Android',
        steps: [
          { icon: 'install', text: 'Tocca il pulsante "Installa" qui sotto' },
          { icon: 'home', text: 'Conferma: Momentum apparirà come un\'app vera, con la sua icona' },
        ],
      };
    }
    return {
      title: 'Installa su Android',
      steps: [
        { icon: 'menu', text: 'Tocca i tre puntini in alto a destra' },
        { icon: 'plus', text: 'Tocca "Aggiungi a schermata Home" o "Installa app"' },
      ],
    };
  }

  // Desktop (Windows/Mac/altro)
  if (['chrome', 'edge'].includes(browser)) {
    return {
      title: 'Installa sul computer',
      steps: [
        { icon: 'install', text: 'Tocca il pulsante "Installa" qui sotto, oppure l\'icona ⊕ nella barra degli indirizzi' },
        { icon: 'home', text: 'Momentum si aprirà in una sua finestra, come un programma vero' },
      ],
    };
  }
  if (browser === 'firefox') {
    return {
      title: 'Installa sul computer',
      steps: [
        { icon: 'info', text: 'Firefox desktop non supporta ancora l\'installazione delle app web' },
        { icon: 'menu', text: 'Puoi comunque creare un segnalibro o aprire Momentum in un altro browser (Chrome/Edge) per installarla' },
      ],
    };
  }
  return {
    title: 'Installa Momentum',
    steps: [
      { icon: 'menu', text: 'Cerca "Installa app" o "Aggiungi a schermata Home" nel menu del tuo browser' },
    ],
  };
}
