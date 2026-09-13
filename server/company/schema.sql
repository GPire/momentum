PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
  company_id TEXT NOT NULL REFERENCES companies(id),
  subject TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('employee','reviewer','auditor','policy_admin','owner')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  PRIMARY KEY(company_id, subject)
);
CREATE TABLE IF NOT EXISTS policies (
  company_id TEXT NOT NULL REFERENCES companies(id),
  version INTEGER NOT NULL CHECK(version > 0),
  rules TEXT NOT NULL CHECK(json_valid(rules)),
  author TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(company_id, version)
);
CREATE TRIGGER IF NOT EXISTS immutable_policy_update BEFORE UPDATE ON policies
BEGIN SELECT RAISE(ABORT, 'Policy versions are immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_policy_delete BEFORE DELETE ON policies
BEGIN SELECT RAISE(ABORT, 'Policy versions are immutable'); END;
