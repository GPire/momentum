CREATE TABLE IF NOT EXISTS request_rate_limits (
  subject TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
