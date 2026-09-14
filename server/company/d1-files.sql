-- Optional pilot storage. Private SQL tables; never exposed as public URLs.
CREATE TABLE IF NOT EXISTS company_file_objects (
 object_key TEXT PRIMARY KEY,
 size INTEGER NOT NULL CHECK(size > 0 AND size <= 8388608),
 chunks INTEGER NOT NULL CHECK(chunks BETWEEN 1 AND 9)
);
CREATE TABLE IF NOT EXISTS company_file_chunks (
 object_key TEXT NOT NULL REFERENCES company_file_objects(object_key) ON DELETE CASCADE,
 part INTEGER NOT NULL CHECK(part >= 0 AND part < 9),
 bytes BLOB NOT NULL CHECK(length(bytes) BETWEEN 1 AND 1000000),
 PRIMARY KEY(object_key,part)
);
