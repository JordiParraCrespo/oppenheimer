import { describe, expect, it } from 'vitest';
import { PAYLOAD_EXCERPT_MAX, payloadExcerptOf } from '../routine-payload-excerpt.policy';

describe('payloadExcerptOf', () => {
  it('keeps a short body whole', () => {
    expect(payloadExcerptOf('{"a":1}')).toEqual({ text: '{"a":1}', truncated: false });
  });

  it('never splits an emoji at the cut', () => {
    const excerpt = payloadExcerptOf(`${'x'.repeat(PAYLOAD_EXCERPT_MAX - 1)}😀😀`);
    expect(excerpt.text.endsWith('😀')).toBe(true);
    expect(excerpt.truncated).toBe(true);
  });

  it('drops NUL, which Postgres refuses', () => {
    expect(payloadExcerptOf('a\u0000b').text).toBe('ab');
  });
});
