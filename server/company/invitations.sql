CREATE TABLE IF NOT EXISTS invitations (
  token_hash TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('employee','reviewer','auditor','policy_admin')),
  invited_by TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)),
  accepted_by TEXT,
  accepted_at INTEGER
);
CREATE INDEX IF NOT EXISTS invitations_company ON invitations(company_id);
CREATE TRIGGER IF NOT EXISTS invitation_membership AFTER UPDATE OF accepted_by ON invitations
WHEN OLD.accepted_by IS NULL AND NEW.accepted_by IS NOT NULL
BEGIN
  INSERT INTO memberships(company_id,subject,role,active)
    VALUES(NEW.company_id,NEW.accepted_by,NEW.role,1);
END;
