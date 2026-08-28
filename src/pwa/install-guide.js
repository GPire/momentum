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
const IOS_BACKUP_STEP = { icon: 'info', text: 'Hai già delle spese salvate? Tocca "Salva le tue spese ora" qui sotto PRIMA di continuare: su iPhone i dati non passano da soli a Safari a un\'app installata.', action: 'exportPlainBackup' };

// Passi in linguaggio semplice, un'azione per riga. `icon` è una chiave
// testuale (share/menu/plus/home) che la UI traduce in un'icona reale — mai
// testo tecnico ("tocca l'ellissi"), sempre concreto ("tocca i tre puntini").
// `hasData` (default false): questo dispositivo ha già transazioni vere —
// SOLO allora ha senso avvisare del salvataggio pre-installazione (mai
// rumore per chi sta ancora guardando l'app vuota, nulla da perdere).
export function installSteps(platform, { hasData = false } = {}) {
  const { os, browser, standalone, inAppBrowser } = platform;
  if (standalone) return { title: 'App già installata', steps: [] };

  // PRIORITÀ ASSOLUTA: un browser in-app (aperto da un link dentro
  // Instagram/Facebook/TikTok/WhatsApp/LinkedIn/X) non può installare NULLA,
  // su nessun sistema operativo — è la causa REALE più comune di "non ci
  // riesco" segnalata dagli utenti. Va detto PRIMA di qualunque altro passo,
  // mai lasciato scoprire dopo passi che falliscono silenziosamente.
  if (inAppBrowser) {
    return {
      title: `Sei dentro ${inAppBrowser}, non in un browser vero`,
      steps: [
        { icon: 'info', text: `${inAppBrowser} apre i link in una finestra sua, senza la funzione "Installa": è la causa più comune di "non ci riesco"` },
        { icon: 'menu', text: os === 'ios' ? 'Tocca i tre puntini (o Condividi) in alto e scegli "Apri in Safari"' : 'Tocca i tre puntini in alto e scegli "Apri nel browser" (Chrome)' },
        { icon: 'home', text: 'Da lì la guida qui sotto funzionerà davvero' },
      ],
    };
  }

  if (os === 'ios') {
    if (browser === 'safari') {
      return {
        title: 'Installa su iPhone/iPad (Safari)',
        steps: [
          ...(hasData ? [IOS_BACKUP_STEP] : []),
          { icon: 'share', text: 'Tocca l\'icona Condividi (il quadrato con la freccia verso l\'alto), in basso al centro' },
          { icon: 'plus', text: 'Scorri l\'elenco (a volte serve scorrere parecchio) e tocca "Aggiungi a Home"' },
          { icon: 'home', text: 'Tocca "Aggiungi": l\'icona di Momentum apparirà sulla schermata Home' },
          ...(hasData ? [{ icon: 'info', text: 'Aprila dalla Home: se la vedi vuota, tocca "Ho un backup da importare" nella prima schermata — è il file che hai appena salvato' }] : []),
        ],
      };
    }
    // Chrome/Firefox su iOS: stesso motore Safari sotto, stesso percorso di
    // condivisione — Apple obbliga tutti i browser iOS a usare WebKit.
    return {
      title: 'Installa su iPhone/iPad',
      steps: [
        ...(hasData ? [IOS_BACKUP_STEP] : []),
        { icon: 'info', text: 'Su iPhone/iPad solo Safari può installare le app — apri questa pagina in Safari' },
        { icon: 'share', text: 'Poi tocca Condividi → "Aggiungi a Home"' },
        ...(hasData ? [{ icon: 'info', text: 'Aprila dalla Home: se la vedi vuota, tocca "Ho un backup da importare" nella prima schermata — è il file che hai appena salvato' }] : []),
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
