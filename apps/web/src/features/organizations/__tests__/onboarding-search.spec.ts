import { describe, expect, it } from 'vitest';
import {
  githubStepSearchSchema,
  hostStepSearchSchema,
  readySearchSchema,
} from '../lib/onboarding-search';

/**
 * The onboarding steps' searches. `github-step-search.spec.ts` pins GitHub's
 * callback on its own; these pin what each step's route reads, walk included:
 * the walk is what keeps a first-run reader moving from step to step, and on
 * Connect GitHub it arrives as the prefix of the one value GitHub echoes.
 */

const NONCE = 'kX9_mZq-4vR2tY7wB1nC3dE5fG8hJ0kLpQ6sU2xV4yA';

describe('githubStepSearchSchema', () => {
  it('reads the walk off the state and keeps the bare nonce for the connect call', () => {
    expect(
      githubStepSearchSchema.parse({
        installation_id: '42',
        code: 'abc',
        setup_action: 'install',
        state: `first-run.${NONCE}`,
      }),
    ).toEqual({
      installation_id: 42,
      code: 'abc',
      setup_action: 'install',
      state: NONCE,
      walk: true,
    });
  });

  it('keeps an explicit walk on a search that carries no install state yet', () => {
    const search = githubStepSearchSchema.parse({ walk: true });
    expect(search.walk).toBe(true);
    expect(search.state).toBeUndefined();
    expect(search.installation_id).toBeUndefined();
  });

  it('reads no walk off a bare nonce', () => {
    const search = githubStepSearchSchema.parse({ installation_id: '42', state: NONCE });
    expect(search.walk).toBeUndefined();
    expect(search.state).toBe(NONCE);
  });

  it('reads an installation id that is not a positive whole number as absent', () => {
    for (const installation_id of ['abc', '-1', '0', '1.5']) {
      expect(githubStepSearchSchema.parse({ installation_id }).installation_id).toBeUndefined();
    }
  });
});

describe('hostStepSearchSchema', () => {
  it('keeps the installation GitHub wrote and the walk', () => {
    expect(hostStepSearchSchema.parse({ installation: 'inst-1', walk: 'true' })).toEqual({
      installation: 'inst-1',
      walk: true,
    });
  });

  it('reads a skipped step as absent', () => {
    expect(hostStepSearchSchema.parse({ installation: '' })).toEqual({
      installation: undefined,
      walk: undefined,
    });
  });
});

describe('readySearchSchema', () => {
  it('keeps what each step produced and the walk, and drops anything else', () => {
    expect(
      readySearchSchema.parse({ installation: 'inst-1', host: 'host-1', walk: true, other: 'x' }),
    ).toEqual({ installation: 'inst-1', host: 'host-1', walk: true });
  });
});
