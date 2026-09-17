import type { OppenheimerApp } from '@oppenheimer/frontend-core';

/**
 * A kernel whose container answers with the given services and nothing else.
 * The product's `*App.for()` wrapper resolves its services through the
 * container, so a spec binds the fakes under the tokens it exercises.
 */
export function fakeKernel(services: Record<symbol, unknown>): OppenheimerApp {
  return {
    container: { get: (token: symbol) => services[token] },
  } as unknown as OppenheimerApp;
}
