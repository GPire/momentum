CREATE TABLE IF NOT EXISTS company_attachment_lifecycle (
 company_id TEXT NOT NULL,
 object_key TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','deleting')),
 PRIMARY KEY(company_id,object_key)
);
CREATE TABLE IF NOT EXISTS company_attachment_operations (
 token TEXT PRIMARY KEY,
 company_id TEXT NOT NULL,
 object_key TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS attachment_operations_object ON company_attachment_operations(company_id,object_key);
-- Operation insertion is atomic with the deletion-state check.
CREATE TRIGGER IF NOT EXISTS attachment_operation_guard BEFORE INSERT ON company_attachment_operations
 WHEN NOT EXISTS(SELECT 1 FROM company_attachment_lifecycle WHERE company_id=NEW.company_id AND object_key=NEW.object_key AND state='active')
 BEGIN SELECT RAISE(ABORT,'Attachment busy'); END;
