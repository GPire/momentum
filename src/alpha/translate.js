// Traduzione automatica di contenuti REALI (mai testo inventato) — MyMemory
// Translation API, gratuita, CORS verificato dal browser il 2026-07-27,
// nessuna chiave. Usata SOLO per portare in italiano un riassunto/notizia
// che arriva in inglese dalle fonti (Alpha Vantage/CoinGecko non hanno
// contenuti in italiano reali — verificato: il campo `description.it` di
// CoinGecko esiste nello schema ma è vuoto per le cripto principali).
// Onestà: ogni traduzione va mostrata etichettata come "traduzione
// automatica" — è un servizio best-effort, non sempre perfetto, mai
// spacciato per il testo originale della fonte.
'use strict';

export function isItalianDevice(navigatorLike = (typeof navigator !== 'undefined' ? navigator : null)) {
  const langs = navigatorLike?.languages?.length ? navigatorLike.languages : [navigatorLike?.language].filter(Boolean);
  return langs.some((l) => String(l).toLowerCase().startsWith('it'));
}

export async function translateText(text, { from = 'en', to = 'it', fetchImpl = fetch } = {}) {
  const clean = (text || '').trim();
  if (!clean) return '';
  // MyMemory limita ~500 caratteri per richiesta sul tier gratuito.
  const chunk = clean.slice(0, 480);
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${from}|${to}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Traduzione: HTTP ${res.status}`);
  const json = await res.json();
  const translated = json?.responseData?.translatedText;
  if (!translated || json?.responseStatus !== 200) throw new Error('Traduzione non disponibile.');
  return translated;
}
