ALTER TABLE company_attachment_lifecycle ADD COLUMN cleanup_id TEXT;
CREATE TABLE company_attachment_journal (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_id TEXT NOT NULL,
 object_key TEXT NOT NULL,
 attempt TEXT NOT NULL,
 actor TEXT NOT NULL,
 event TEXT NOT NULL CHECK(event IN ('requested','confirmed','uncertain','retained','observed_present','observed_missing','observed_unavailable')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX attachment_journal_attempt ON company_attachment_journal(company_id,attempt,event);
CREATE TRIGGER attachment_journal_no_update BEFORE UPDATE ON company_attachment_journal BEGIN SELECT RAISE(ABORT,'Immutable attachment journal'); END;
CREATE TRIGGER attachment_journal_no_delete BEFORE DELETE ON company_attachment_journal BEGIN SELECT RAISE(ABORT,'Immutable attachment journal'); END;
-- Quota release and reopening the key commit together, only for confirmed deletion.
CREATE TRIGGER attachment_cleanup_finalized AFTER UPDATE ON company_attachment_lifecycle
 WHEN OLD.state='deleting' AND NEW.state='active' AND OLD.cleanup_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM company_attachment_journal WHERE company_id=OLD.company_id AND attempt=OLD.cleanup_id AND object_key=OLD.object_key AND event='confirmed')
 BEGIN DELETE FROM company_attachment_reservations WHERE company_id=OLD.company_id AND object_key=OLD.object_key; END;
