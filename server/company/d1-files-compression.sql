-- Apply once after d1-files.sql, before deploying the compression-aware reader.
-- Existing chunks retain their exact bytes.
ALTER TABLE company_file_chunks ADD COLUMN encoding TEXT NOT NULL DEFAULT 'identity' CHECK(encoding IN ('identity','gzip'));
