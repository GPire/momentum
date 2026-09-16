-- Configure a company explicitly before enabling detached uploads.
CREATE TABLE IF NOT EXISTS company_storage_limits (
  company_id TEXT PRIMARY KEY REFERENCES companies(id),
  limit_bytes INTEGER NOT NULL CHECK(limit_bytes >= 0)
);
-- Reservations survive ambiguous object-store failures: never undercount bytes.
CREATE TABLE IF NOT EXISTS company_attachment_reservations (
  company_id TEXT NOT NULL REFERENCES companies(id),
  object_key TEXT NOT NULL,
  size INTEGER NOT NULL CHECK(size > 0 AND size <= 8388608),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(company_id, object_key)
);
