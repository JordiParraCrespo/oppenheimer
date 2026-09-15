CREATE TABLE IF NOT EXISTS jobs (
	id          text        PRIMARY KEY,
	kind        text        NOT NULL,
	payload     jsonb       NOT NULL,
	status      text        NOT NULL,
	error       text        NOT NULL DEFAULT '',
	created_by  text        NOT NULL,
	created_at  timestamptz NOT NULL,
	started_at  timestamptz,
	finished_at timestamptz
);

-- List filters by status and orders by recency.
CREATE INDEX IF NOT EXISTS jobs_status_created_at ON jobs (status, created_at DESC);
