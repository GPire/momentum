-- Additive, rerunnable indexes. No archive or decision changes.
CREATE INDEX IF NOT EXISTS reports_company_recent ON reports(company_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS reports_employee_recent ON reports(company_id,submitter,created_at DESC,id DESC);
