CREATE TABLE IF NOT EXISTS api_keys (
	id           text        PRIMARY KEY,
	name         text        NOT NULL,
	prefix       text        NOT NULL,
	hash         text        NOT NULL,
	scopes       text[]      NOT NULL,
	created_by   text        NOT NULL,
	created_at   timestamptz NOT NULL,
	expires_at   timestamptz,
	revoked_at   timestamptz,
	last_used_at timestamptz
);

-- Verification looks a key up by the hash of the presented token.
CREATE INDEX IF NOT EXISTS api_keys_hash ON api_keys (hash);
