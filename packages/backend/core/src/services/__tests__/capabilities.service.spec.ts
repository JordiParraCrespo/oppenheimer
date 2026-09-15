import { describe, expect, it } from 'vitest';
import { CapabilitiesService } from '../capabilities.service';

describe('CapabilitiesService', () => {
  const service = new CapabilitiesService({
    google_oauth: true,
    github_oauth: false,
    stripe_billing: false,
  });

  it('answers has() per capability', () => {
    expect(service.has('google_oauth')).toBe(true);
    expect(service.has('github_oauth')).toBe(false);
  });

  it('splits enabled and disabled capabilities', () => {
    expect(service.enabled()).toEqual(['google_oauth']);
    expect(service.disabled()).toEqual(['github_oauth', 'stripe_billing']);
  });

  it('describes the whole set on one line for the startup log', () => {
    expect(service.describe()).toBe('google_oauth=on, github_oauth=off, stripe_billing=off');
  });

  it('pick() narrows the snapshot to the given capabilities only', () => {
    expect(service.pick(['google_oauth', 'stripe_billing'])).toEqual({
      google_oauth: true,
      stripe_billing: false,
    });
  });

  it('snapshot() returns a copy, not the internal map', () => {
    const snapshot = service.snapshot();
    snapshot.google_oauth = false;
    expect(service.has('google_oauth')).toBe(true);
  });

  it('is immutable after construction, even via the constructor argument', () => {
    const input = { stripe_billing: false };
    const fromInput = new CapabilitiesService(input);
    input.stripe_billing = true;
    expect(fromInput.has('stripe_billing')).toBe(false);
  });
});
