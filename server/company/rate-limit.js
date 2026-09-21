// Difesa in profondità: un SOGGETTO autenticato (una persona, un token) che
// manda troppe richieste — bug in un client, o abuso deliberato — non deve
// poter consumare la capacità D1 condivisa dai suoi colleghi della stessa
// azienda. Non sostituisce le regole di rate limiting a livello di EDGE
// Cloudflare (zona/dominio, contro un attacco distribuito da migliaia di IP
// diversi): quelle si configurano nel pannello Cloudflare, infrastruttura
// dichiarata non simulata qui — stesso principio già seguito per Access/OIDC
// in company-cloud-activation-2026-09-20.md. Questa è la difesa PER SOGGETTO,
// economica (una sola query, mai un log per richiesta) e utile anche prima
// che le regole edge siano configurate.
//
// Finestra fissa, non a scorrimento: un limite scelto per essere generoso
// (default 120/minuto) rende trascurabile la rincorsa al bordo della
// finestra che la finestra fissa introduce — scelta dichiarata, non un
// difetto nascosto.
const WINDOW_MS = 60000;

export async function checkRateLimit(db, subject, limit, now = Date.now()) {
  if (!db || !subject || !(limit > 0)) return { allowed: true };
  const row = await db.prepare(`INSERT INTO request_rate_limits(subject,window_start,count) VALUES(?,?,1)
    ON CONFLICT(subject) DO UPDATE SET
      count = CASE WHEN ? - window_start >= ${WINDOW_MS} THEN 1 ELSE count + 1 END,
      window_start = CASE WHEN ? - window_start >= ${WINDOW_MS} THEN ? ELSE window_start END
    RETURNING count, window_start`).bind(subject, now, now, now, now).first();
  const count = row?.count ?? 1;
  const windowStart = row?.window_start ?? now;
  return {
    allowed: count <= limit,
    retryAfterMs: count <= limit ? 0 : Math.max(1000, WINDOW_MS - (now - windowStart)),
  };
}
