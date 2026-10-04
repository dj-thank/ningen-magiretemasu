CREATE TABLE generated_fingerprints (kind TEXT NOT NULL, hash TEXT NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(kind,hash));
--> statement-breakpoint
CREATE INDEX generated_fingerprints_expiry ON generated_fingerprints(expires_at);
