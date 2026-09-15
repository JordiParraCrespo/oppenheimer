import type { z } from 'zod';

/**
 * Normalizes unset AND blank (`FOO=`, or whitespace-only) env vars to
 * `undefined`, so optional schema keys (`z.string().optional()`,
 * `.url().optional()`) treat both the same and absence stays representable in
 * the parsed config.
 *
 * Whitespace decides *blankness only* — a value that survives is returned
 * verbatim, never trimmed. A credential may legitimately carry leading or
 * trailing whitespace (`DB_PASSWORD`, `S3_SECRET_ACCESS_KEY`, `RESEND_API_KEY`),
 * and silently altering it would hand different credentials to different
 * consumers: TypeORM reads the parsed config while Better Auth's pool reads
 * `process.env` directly, so a trim here would let one connect and the other
 * fail with no visible cause.
 */
export const orUndefined = (value: string | undefined): string | undefined =>
  value?.trim() ? value : undefined;

/**
 * Reads a config section from the environment and validates it, failing with a
 * message a human can act on.
 *
 * The reason this exists rather than a bare `schema.parse()`: a `ZodError` is
 * not safely printable. Nest logs a failed boot through `util.inspect`, and on
 * Node >= 23 inspecting a `ZodError` throws `Cannot read properties of
 * undefined (reading 'value')`. That secondary throw becomes the initialization
 * error, `NestFactory` calls `process.abort()`, and the process core-dumps with
 * no message at all — so "BETTER_AUTH_SECRET is missing" surfaced as an
 * `Aborted (core dumped)` with a native stack trace.
 *
 * Collapsing the issues into a plain `Error` keeps the failure loud, as
 * `api-config.md` requires, and legible on every Node version.
 *
 * Taking the env var names here (rather than reading `process.env` at the call
 * site) is what lets the message name the variable to set: config keys are
 * camelCase and their variables are not derivable from them (`host` is
 * `DB_HOST`, not `HOST`).
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
