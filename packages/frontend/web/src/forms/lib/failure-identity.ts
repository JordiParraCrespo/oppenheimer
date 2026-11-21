/**
 * What makes two failures on one alert the same failure: the same raw error
 * object, or the same resolved sentence with the same reference. A failure the
 * reader dismissed stays hidden only while it is the same one.
 */
export type FailureIdentity =
  | { kind: 'error'; error: unknown }
  | { kind: 'message'; message: string; correlationId: string | undefined };

export function sameFailure(a: FailureIdentity | null, b: FailureIdentity | null): boolean {
  if (a === null || b === null) return false;
  if (a.kind === 'error' && b.kind === 'error') return Object.is(a.error, b.error);
  if (a.kind === 'message' && b.kind === 'message') {
    return a.message === b.message && a.correlationId === b.correlationId;
  }
  return false;
}

/** The identity of what an alert was handed; `null` when it shows nothing. */
export function failureIdentity(
  source:
    | { message: string | null | undefined; correlationId?: string; error?: never }
    | { error: unknown; message?: never },
): FailureIdentity | null {
  if (source.message !== undefined) {
    return source.message
      ? { kind: 'message', message: source.message, correlationId: source.correlationId }
      : null;
  }
  return source.error === null || source.error === undefined
    ? null
    : { kind: 'error', error: source.error };
}
