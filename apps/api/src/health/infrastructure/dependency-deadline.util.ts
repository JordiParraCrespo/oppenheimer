/** A readiness dependency did not answer inside its configured deadline. */
export class DependencyTimeoutError extends Error {
  constructor(
    readonly dependency: string,
    readonly timeoutMs: number,
  ) {
    super(`${dependency} did not answer within ${timeoutMs}ms`);
    this.name = 'DependencyTimeoutError';
  }
}

/**
 * Bounds how long a readiness check may wait on its dependency.
 *
 * Enforced here rather than left to the client library: a Redis `PING` has no
 * timeout of its own and waits for the socket to give up, and a query waits
 * for a pooled connection before it starts. Trusting a dependency to enforce
 * its own deadline is the same mistake as trusting it to fail loudly.
 *
 * The losing operation cannot be cancelled (neither a driver query nor a
 * socket write takes a signal here), so it is left to settle, but it stays
 * observed: `Promise.race` subscribes to every input, so a rejection after
 * the deadline is handled by the race rather than surfacing as an
 * `unhandledRejection`, which would end the process on a slow dependency.
 * Keep it that way if this changes (`dependency-deadline.util.spec.ts`). The
 * timer is cleared, so a check that answers in time holds nothing open.
 *
 * @throws DependencyTimeoutError when the deadline passes first.
 */
export async function withDeadline<T>(
  dependency: string,
  timeoutMs: number,
  operation: () => Promise<T>,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new DependencyTimeoutError(dependency, timeoutMs)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
