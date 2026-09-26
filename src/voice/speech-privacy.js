// Dove viene trascritta la voce. Prima scelta: sul dispositivo (Web Speech
// API con processLocally, Chrome 139+): audio e testo non lasciano mai il
// telefono. Se il pacchetto lingua si può scaricare, si scarica. Solo se il
// browser non lo permette si usa il suo servizio online, e solo dopo che la
// persona lo ha saputo e accettato una volta.
'use strict';

const OPZIONI = (lang) => ({ langs: [lang], processLocally: true });

export async function prepareSpeech(SpeechRec, lang, { cloudAllowed = false, askCloud = async () => false, onInstalling = () => {} } = {}) {
  if (typeof SpeechRec?.available === 'function') {
    let stato = 'unavailable';
    try { stato = await SpeechRec.available(OPZIONI(lang)); } catch { stato = 'unavailable'; }
    if (stato === 'available') return { proceed: true, local: true };
    if ((stato === 'downloadable' || stato === 'downloading') && typeof SpeechRec.install === 'function') {
      onInstalling();
      try { if (await SpeechRec.install(OPZIONI(lang))) return { proceed: true, local: true }; } catch { /* si ripiega */ }
    }
  }
  if (cloudAllowed) return { proceed: true, local: false };
  const ok = await askCloud();
  return { proceed: !!ok, local: false, remember: !!ok };
}
