import type { OppenheimerApp } from '@oppenheimer/frontend-core';
import { TOKENS } from '../../di/tokens';
import { LiveService } from '../../modules/live';

/**
 * A kernel whose container answers with the given services and nothing else.
 * The product's `*App.for()` wrapper resolves its services through the
 * container, so a spec binds the fakes under the tokens it exercises. The live
 * stream is there unless a spec binds its own: idle, so every poll polls.
 */
export function fakeKernel(services: Record<symbol, unknown>): OppenheimerApp {
  const bound: Record<symbol, unknown> = {
    [TOKENS.LiveService]: new LiveService('', () => {
      throw new Error('this spec did not expect the live stream to open');
    }),
    ...services,
  };
  return {
    container: { get: (token: symbol) => bound[token] },
  } as unknown as OppenheimerApp;
}
