import { describe, expect, it } from 'vitest';
import { HELLO_CAPABILITIES_MAX, helloSchema, RUNNER_CAPABILITIES } from '../messages.js';

/**
 * A hello naming more capabilities than the control plane takes is refused
 * whole, and the host never links: 0.1.24 named 33 against a cap of 32.
 */
describe('the hello capabilities cap', () => {
  it('leaves room for a runner naming every capability twice over', () => {
    expect(RUNNER_CAPABILITIES.length * 2).toBeLessThanOrEqual(HELLO_CAPABILITIES_MAX);
  });

  it('takes a runner naming every capability there is', () => {
    const parsed = helloSchema.shape.capabilities.safeParse([...RUNNER_CAPABILITIES]);
    expect(parsed.success).toBe(true);
  });

  it('takes capabilities this control plane has never heard of, up to the cap', () => {
    const named = Array.from({ length: HELLO_CAPABILITIES_MAX }, (_, i) => `future.${i}`);
    expect(helloSchema.shape.capabilities.safeParse(named).success).toBe(true);
    expect(helloSchema.shape.capabilities.safeParse([...named, 'one.more']).success).toBe(false);
  });
});
