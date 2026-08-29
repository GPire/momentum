// Guida di installazione PWA: rileva piattaforma/browser REALI (mai un
// suggerimento generico uguale per tutti) e restituisce i passi corretti in
// linguaggio semplice ("comprensibile anche a un bambino"). Funzione pura,
// testabile: prende userAgent come parametro invece di leggere
// navigator.userAgent direttamente, mai un side-effect nascosto.
//
// Multilingua (2026-08-29): installSteps() accetta ora `lang` (default
// 'it', stesso comportamento di sempre — tutti i test esistenti, che non
// passano una lingua, continuano a leggere l'italiano originale byte per
// byte). detectPlatform()/detectOS()/detectBrowser()/detectInAppBrowser()
// restano invariate: rilevano fatti sul dispositivo, non producono testo.
'use strict';

import { t as tInst } from '../i18n/ui-strings.js';

function detectOS(ua) {
  if (/iPad|iPhone|iPod/.test(ua) && !/Windows Phone/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)) return 'mac';
  if (/Windows/.test(ua)) return 'windows';
  return 'altro';
}

// Browser "in-app" (WebView di un'altra app: Instagram/Facebook/TikTok/
// WhatsApp/LinkedIn) — motivo REALE e frequente per cui "non riesco a
// installarla" da un link condiviso: quella finestra non è un vero
// Safari/Chrome, è una vista integrata SENZA la funzione di installazione,
// qualunque sia il sistema operativo sotto. Va detto subito e chiaramente,
// mai lasciato scoprire dopo passi che non funzionano.
function detectInAppBrowser(ua) {
  if (/Instagram/.test(ua)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return 'Facebook';
  if (/BytedanceWebview|musical_ly|TikTok/.test(ua)) return 'TikTok';
  if (/\bLine\//.test(ua)) return 'LINE';
  if (/LinkedInApp/.test(ua)) return 'LinkedIn';
  if (/Twitter/.test(ua)) return 'X/Twitter';
  if (/WhatsApp/.test(ua)) return 'WhatsApp';
  return null;
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
  const inAppBrowser = detectInAppBrowser(userAgent);
  // beforeinstallprompt (installazione con un tap) esiste SOLO su Chrome/
  // Edge/Samsung Internet su Android e desktop — mai su iOS/Safari (Apple
  // non lo supporta, richiede sempre i passi manuali) — dichiarato onestamente,
  // mai un pulsante "Installa" che poi non fa nulla su iOS. Un browser
  // in-app non lo supporta MAI, qualunque sia l'OS sotto.
  const supportsNativePrompt = !inAppBrowser && (os === 'android' || os === 'windows' || os === 'mac')
    && ['chrome', 'edge', 'samsung'].includes(browser);
  return { os, browser, inAppBrowser, standalone, supportsNativePrompt };
}

// Passo aggiuntivo SOLO per iOS con dati già presenti (2026-08-28, bug reale
// segnalato da utenti: dopo "Aggiungi a Home" su iPhone, ogni transazione
// andava reinserita a mano). Causa verificata (non ipotizzata — vedi
// ricerca): WebKit isola completamente localStorage/IndexedDB/cookie tra
// Safari e l'istanza standalone, ANCHE per la stessa identica origine —
// limite di iOS, non un bug di Momentum, e non capita su Android (lì lo
// storage È condiviso, verificato). Nessun bypass tecnico esiste senza un
// server (che il progetto rifiuta): l'unico ponte reale che attraversa il
// confine è il FILE SYSTEM (Download/File di iOS, non storage web) — da qui
// il backup in chiaro un-tap (`exportPlainBackup`, già esistente) PRIMA di
// installare, poi importato nella PWA appena aperta.
const iosBackupStep = (lang) => ({ icon: 'info', text: tInst('instIosBackupWarning', lang), action: 'exportPlainBackup' });

// Passi in linguaggio semplice, un'azione per riga. `icon` è una chiave
// testuale (share/menu/plus/home) che la UI traduce in un'icona reale — mai
// testo tecnico ("tocca l'ellissi"), sempre concreto ("tocca i tre puntini").
// `hasData` (default false): questo dispositivo ha già transazioni vere —
// SOLO allora ha senso avvisare del salvataggio pre-installazione (mai
// rumore per chi sta ancora guardando l'app vuota, nulla da perdere).
export function installSteps(platform, { hasData = false, lang = 'it' } = {}) {
  const { os, browser, standalone, inAppBrowser } = platform;
  if (standalone) return { title: tInst('instAlreadyInstalledTitle', lang), steps: [] };

  // PRIORITÀ ASSOLUTA: un browser in-app (aperto da un link dentro
  // Instagram/Facebook/TikTok/WhatsApp/LinkedIn/X) non può installare NULLA,
  // su nessun sistema operativo — è la causa REALE più comune di "non ci
  // riesco" segnalata dagli utenti. Va detto PRIMA di qualunque altro passo,
  // mai lasciato scoprire dopo passi che falliscono silenziosamente.
  if (inAppBrowser) {
    return {
      title: tInst('instInAppTitle', lang, inAppBrowser),
      steps: [
        { icon: 'info', text: tInst('instInAppWarning', lang, inAppBrowser) },
        { icon: 'menu', text: os === 'ios' ? tInst('instInAppOpenSafari', lang) : tInst('instInAppOpenChrome', lang) },
        { icon: 'home', text: tInst('instInAppThenWorks', lang) },
      ],
    };
  }

  if (os === 'ios') {
    if (browser === 'safari') {
      return {
        title: tInst('instIosSafariTitle', lang),
        steps: [
          ...(hasData ? [iosBackupStep(lang)] : []),
          { icon: 'share', text: tInst('instIosShareIcon', lang) },
          { icon: 'plus', text: tInst('instIosAddToHome', lang) },
          { icon: 'home', text: tInst('instIosConfirmAdd', lang) },
          ...(hasData ? [{ icon: 'info', text: tInst('instIosEmptyAfterInstall', lang) }] : []),
        ],
      };
    }
    // Chrome/Firefox su iOS: stesso motore Safari sotto, stesso percorso di
    // condivisione — Apple obbliga tutti i browser iOS a usare WebKit.
    return {
      title: tInst('instIosOtherTitle', lang),
      steps: [
        ...(hasData ? [iosBackupStep(lang)] : []),
        { icon: 'info', text: tInst('instIosOnlySafari', lang) },
        { icon: 'share', text: tInst('instIosShareThenHome', lang) },
        ...(hasData ? [{ icon: 'info', text: tInst('instIosEmptyAfterInstall', lang) }] : []),
      ],
    };
  }

  if (os === 'android') {
    if (['chrome', 'edge', 'samsung'].includes(browser)) {
      return {
        title: tInst('instAndroidTitle', lang),
        steps: [
          { icon: 'install', text: tInst('instAndroidTapInstall', lang) },
          { icon: 'home', text: tInst('instAndroidConfirm', lang) },
        ],
      };
    }
    return {
      title: tInst('instAndroidTitle', lang),
      steps: [
        { icon: 'menu', text: tInst('instAndroidMenuDots', lang) },
        { icon: 'plus', text: tInst('instAndroidAddHome', lang) },
      ],
    };
  }

  // Desktop (Windows/Mac/altro)
  if (['chrome', 'edge'].includes(browser)) {
    return {
      title: tInst('instDesktopTitle', lang),
      steps: [
        { icon: 'install', text: tInst('instDesktopTapInstall', lang) },
        { icon: 'home', text: tInst('instDesktopOpensWindow', lang) },
      ],
    };
  }
  if (browser === 'firefox') {
    return {
      title: tInst('instDesktopTitle', lang),
      steps: [
        { icon: 'info', text: tInst('instFirefoxNotSupported', lang) },
        { icon: 'menu', text: tInst('instFirefoxAlternative', lang) },
      ],
    };
  }
  return {
    title: tInst('instFallbackTitle', lang),
    steps: [
      { icon: 'menu', text: tInst('instFallbackStep', lang) },
    ],
  };
}
