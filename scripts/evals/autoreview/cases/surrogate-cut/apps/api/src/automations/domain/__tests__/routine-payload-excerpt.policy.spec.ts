import { describe, expect, it } from 'vitest';
import { PAYLOAD_EXCERPT_MAX, payloadExcerptOf } from '../routine-payload-excerpt.policy';

describe('payloadExcerptOf', () => {
  it('keeps a short body whole', () => {
    expect(payloadExcerptOf('{"a":1}')).toEqual({ text: '{"a":1}', truncated: false });
  });

  it('caps a long body', () => {
    const excerpt = payloadExcerptOf('x'.repeat(PAYLOAD_EXCERPT_MAX + 10));
    expect(excerpt.text).toHaveLength(PAYLOAD_EXCERPT_MAX);
    expect(excerpt.truncated).toBe(true);
  });
});
