CREATE TABLE rooms (code TEXT PRIMARY KEY NOT NULL, state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX rooms_expiry ON rooms(expires_at);
--> statement-breakpoint
CREATE TABLE rate_limits (key TEXT PRIMARY KEY NOT NULL, count INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL);
