// ============================================================
// DOWNLOAD-PROGRESS — perché esiste
// ============================================================
// "Non si capisce lo stato di avanzamento dei download" (feedback diretto
// dell'utente, 2026-08-24): le card di Impostazioni per i modelli on-device
// (comprensione semantica, sentiment) mostravano solo "scaricamento in
// corso…" senza numeri, per tutta la durata — indistinguibile da un blocco,
// soprattutto ora che sappiamo (src/core/con-timeout.js) che un download
// PUÒ restare bloccato per davvero. Un contatore reale toglie l'ambiguità:
// o sale, o resta fermo — e se resta fermo, ora lo si VEDE, invece di
// doverlo dedurre dall'attesa.
// `@huggingface/transformers` chiama `progress_callback` con eventi per
// OGNI file (tokenizer.json, config.json, il .onnx dei pesi — quest'ultimo
// domina il totale, gli altri sono pochi KB): questo modulo li aggrega in
// UNA percentuale sola, condivisa fra src/ai/semantic-embed.js e src/ai/
// local-sentiment.js — un solo posto che sa leggere questi eventi, non due
// copie che potrebbero interpretarli in modo diverso.
'use strict';

export function creaTracciatoreProgresso() {
  const file = new Map(); // nome file -> {loaded, total}
  let fase = 'inattivo'; // 'inattivo' | 'scaricamento' | 'pronto'

  const callback = (evt) => {
    if (!evt) return;
    if (evt.status === 'initiate' || evt.status === 'download') fase = 'scaricamento';
    if (evt.status === 'progress' && evt.file) {
      file.set(evt.file, { loaded: Number(evt.loaded) || 0, total: Number(evt.total) || 0 });
    }
    if (evt.status === 'done' && evt.file) {
      // Un file può risultare "done" senza mai aver mandato un evento
      // 'progress' (es. letto dalla cache in un colpo solo, vedi il ramo
      // Firefox in transformers.js) — senza questo, quel file resterebbe
      // fermo a 0/0 per sempre nel totale aggregato.
      const precedente = file.get(evt.file) || { loaded: 0, total: 0 };
      file.set(evt.file, { loaded: precedente.total || precedente.loaded || 1, total: precedente.total || precedente.loaded || 1 });
    }
    if (evt.status === 'ready') fase = 'pronto';
  };

  const stato = () => {
    let loaded = 0, total = 0;
    for (const f of file.values()) { loaded += f.loaded; total += f.total; }
    // Senza un `total` noto (alcuni server non mandano content-length) non
    // si inventa una percentuale: si dichiara "in corso" senza numero,
    // onesto invece di un progresso finto che non avanza mai in modo
    // coerente con i byte veri.
    const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((loaded / total) * 100))) : null;
    return { fase, pct, loaded, total };
  };

  return { callback, stato };
}
