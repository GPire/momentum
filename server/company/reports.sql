CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  submitter TEXT NOT NULL,
  trip_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  policy_version INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  archive TEXT NOT NULL CHECK(json_valid(archive)),
  created_at TEXT NOT NULL,
  UNIQUE(company_id,submitter,trip_id,revision)
);
CREATE TABLE IF NOT EXISTS report_decisions (
  report_id TEXT PRIMARY KEY REFERENCES reports(id),
  reviewer TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('approved','changes_requested')),
  note TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS reports_no_update BEFORE UPDATE ON reports BEGIN SELECT RAISE(ABORT,'Immutable report'); END;
CREATE TRIGGER IF NOT EXISTS reports_no_delete BEFORE DELETE ON reports BEGIN SELECT RAISE(ABORT,'Immutable report'); END;
CREATE TRIGGER IF NOT EXISTS decisions_no_update BEFORE UPDATE ON report_decisions BEGIN SELECT RAISE(ABORT,'Immutable decision'); END;
CREATE TRIGGER IF NOT EXISTS decisions_no_delete BEFORE DELETE ON report_decisions BEGIN SELECT RAISE(ABORT,'Immutable decision'); END;
