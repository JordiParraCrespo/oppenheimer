import { AppError } from '@oppenheimer/frontend-core';
import { describe, expect, it } from 'vitest';
import { cloudLaunchFailure } from '../lib/cloud-launch-failure';

/**
 * A cloud launch's failure decides the alert's one action: a refused key
 * sends the reader to reconnect it rather than showing a reference to quote,
 * and a vendor's refusal keeps the vendor's own sentence. A mapping that
 * drifted would show "reconnect" for an outage, or lose why Cursor refused.
 */
function failed(code: string, detail?: string) {
  return new AppError(
    { code, message: '' },
    {
      status: 422,
      problem: {
        type: 'about:blank',
        title: 't',
        status: 422,
        code,
        detail,
        correlationId: 'ref-1',
      },
    },
  );
}

describe('cloudLaunchFailure', () => {
  it('sends a refused or missing key to settings, with no reference', () => {
    expect(cloudLaunchFailure(failed('CLOUD_AGENTS_005'))).toEqual({
      kind: 'reconnect',
      vendorSays: null,
      correlationId: undefined,
    });
    expect(cloudLaunchFailure(failed('CLOUD_AGENTS_004'))).toEqual({
      kind: 'connect',
      vendorSays: null,
      correlationId: undefined,
    });
  });

  it('offers a retry for an outage, keeping its reference, and for a rate limit', () => {
    expect(cloudLaunchFailure(failed('CLOUD_AGENTS_006'))).toEqual({
      kind: 'unavailable',
      vendorSays: null,
      correlationId: 'ref-1',
    });
    expect(cloudLaunchFailure(failed('CLOUD_AGENTS_007'))).toEqual({
      kind: 'limited',
      vendorSays: null,
      correlationId: undefined,
    });
  });

  it("keeps the vendor's sentence from a refusal, and none from a bare status", () => {
    expect(
      cloudLaunchFailure(failed('CLOUD_AGENTS_010', 'Cursor: Usage limit exceeded')),
    ).toMatchObject({ kind: 'refused', vendorSays: 'Usage limit exceeded' });
    expect(cloudLaunchFailure(failed('CLOUD_AGENTS_010', 'Cursor answered 402'))).toMatchObject({
      kind: 'refused',
      vendorSays: null,
    });
  });

  it('leaves any other failure to the generic alert', () => {
    expect(cloudLaunchFailure(failed('SESSIONS_039'))).toBeNull();
    expect(cloudLaunchFailure(new Error('boom'))).toBeNull();
  });
});
