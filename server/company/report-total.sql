-- Additive migration. Existing reports get total=NULL (pre-esistenti, mai
-- ricalcolati a posteriori dall'archivio JSON: se in futuro serve backfill,
-- farlo con uno script dedicato che dichiara la fonte, non qui).
ALTER TABLE reports ADD COLUMN total REAL;
CREATE INDEX IF NOT EXISTS reports_company_total ON reports(company_id,total) WHERE total IS NOT NULL;
