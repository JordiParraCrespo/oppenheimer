import { describe, expect, it } from 'vitest';
import { recordCloudEventsSchema } from '../session-cloud-chat.schema.js';

/**
 * What `POST /sessions/cloud-events` takes from the browser extension. The
 * body is the boundary: a batch the API appended without its place in the log
 * scrambled a copy for good, since a place or an id held is never moved.
 */
describe('a batch of claude.ai events', () => {
  const batch = {
    cloudSessionId: 'session_01ChatBridge00',
    events: [{ id: 'e1', line: '{"type":"user","uuid":"e1"}' }],
  };

  it('is taken with the place of its first event in the log', () => {
    expect(recordCloudEventsSchema.safeParse({ ...batch, from: 0 }).success).toBe(true);
    expect(recordCloudEventsSchema.safeParse({ ...batch, from: 2484 }).success).toBe(true);
  });

  it('is refused without a place, as an extension built before places sends it', () => {
    // Regression: such a batch was appended after the lines held, so a
    // session's newest event sat near the start of its copy.
    expect(recordCloudEventsSchema.safeParse(batch).success).toBe(false);
    expect(recordCloudEventsSchema.safeParse({ ...batch, placement: 'older' }).success).toBe(false);
  });

  it('is refused with a field it does not know, even beside a place', () => {
    expect(
      recordCloudEventsSchema.safeParse({ ...batch, from: 0, placement: 'older' }).success,
    ).toBe(false);
    expect(recordCloudEventsSchema.safeParse({ ...batch, from: -1 }).success).toBe(false);
  });
});
