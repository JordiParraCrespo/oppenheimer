import { z } from 'zod';

/**
 * Normalizes unset and blank (`FOO=`, whitespace-only) env vars to `undefined`, so
 * optional schema keys treat both the same.
 *
 * Whitespace decides blankness only: a surviving value is returned verbatim, never
 * trimmed, because a credential may legitimately carry leading or trailing whitespace
 * (`DB_PASSWORD`, `S3_SECRET_ACCESS_KEY`, `RESEND_API_KEY`). Both Postgres pools
 * (TypeORM's and Better Auth's) read the same parsed `database` config, so neither may
 * rewrite it on the way.
 */
export const orUndefined = (value: string | undefined): string | undefined =>
  value?.trim() ? value : undefined;

/**
 * A positive integer with a default: the shape of every tuning knob (a limit, a
 * window, a retention period). Blank counts as unset (see `orUndefined`), so
 * the default applies; anything else must coerce to a positive integer.
 */
export const positiveInt = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);

/**
 * Reads a config section from the environment and validates it, failing with a
 * message a human can act on.
 *
 * Not a bare `schema.parse()`, because a `ZodError` is not safely printable: Nest logs
 * a failed boot through `util.inspect`, which on Node >= 23 throws on a `ZodError`
 * (`Cannot read properties of undefined (reading 'value')`); `NestFactory` then calls
 * `process.abort()` and a missing `BETTER_AUTH_SECRET` surfaces as a bare
 * `Aborted (core dumped)`. A plain `Error` stays loud (`api-config.md`) and legible.
 *
 * The env var names are passed in so the message can name the variable to set: they
 * are not derivable from the camelCase config keys (`host` is `DB_HOST`).
 */
export function parseEnv<T extends z.ZodTypeAny>(
  section: string,
  schema: T,
  envKeys: Record<string, string>,
): z.infer<T> {
  // Keys may be dotted (`google.clientId`) for sections whose schema nests.
  const input: Record<string, unknown> = {};
  for (const [key, envVar] of Object.entries(envKeys)) {
    const path = key.split('.');
    const leaf = path.pop() as string;
    let target = input;
    for (const segment of path) {
      target[segment] ??= {};
      target = target[segment] as Record<string, unknown>;
    }
    target[leaf] = orUndefined(process.env[envVar]);
  }

  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const problems = result.error.issues
    .map((issue) => {
      const key = issue.path.join('.');
      return `  ${envKeys[key] ?? key}: ${issue.message}`;
    })
    .join('\n');

  throw new Error(
    `Invalid "${section}" configuration — the API cannot start.\n${problems}\n` +
      'Set these in the .env at the repo root; see .env.example for what each one does.',
  );
}
