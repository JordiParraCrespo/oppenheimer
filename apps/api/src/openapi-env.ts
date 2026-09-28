import '@oppenheimer/env/load';

/**
 * The environment `generate-openapi.ts` boots the module graph in, imported
 * before anything else so it is in place when `AppModule` loads.
 *
 * The document is the routes and their DTOs; no secret changes it. Yet the
 * app config refuses to start without `BETTER_AUTH_SECRET`, so a fresh clone
 * with no `.env` could not regenerate the client. A value the root `.env` or
 * the shell sets still wins; this one only fills the gap, and the process that
 * sees it never listens, never signs and exits once the file is written.
 */
process.env.OPENAPI_GENERATION = 'true';
process.env.BETTER_AUTH_SECRET ??= 'openapi-generation-only';
