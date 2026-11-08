import { describe, expect, it } from 'vitest';
import { CacheReadMetricsAdapter } from '../cache-metrics.adapter';

/**
 * `namespace` is whatever a key's first segment is. A key written without
 * one would make every key its own label value and grow Prometheus without
 * bound; the adapter is what stops that.
 */
function adapter() {
  const counted: Record<string, string>[] = [];
  const zeroed: Record<string, string>[] = [];
  const metrics = new CacheReadMetricsAdapter({
    inc: (labels, value = 1) => (value === 0 ? zeroed : counted).push(labels),
  });
  return { counted, zeroed, observe: metrics.observe };
}

describe('CacheReadMetricsAdapter', () => {
  it('labels a read with its namespace, operation and result', () => {
    const { counted, observe } = adapter();
    observe({ operation: 'getOrSet', namespace: 'github', result: 'hit' });
    expect(counted).toEqual([{ namespace: 'github', operation: 'getOrSet', result: 'hit' }]);
  });

  it('labels a namespace that is not a short identifier, or one past the cap, as other', () => {
    const { counted, observe } = adapter();
    observe({ operation: 'get', namespace: '5c1f9e2a-ticket', result: 'miss' });
    for (let index = 0; index < 25; index++) {
      observe({ operation: 'get', namespace: `ns${index}`, result: 'miss' });
    }
    const labels = new Set(counted.map((labels) => labels.namespace));
    expect(counted[0]?.namespace).toBe('other');
    expect(labels.size).toBe(21);
    expect(counted.at(-1)?.namespace).toBe('other');
  });

  // A namespace that only ever misses must read as 0%, not as no data.
  it('creates every result of a namespace at zero when it first gets a label', () => {
    const { zeroed, observe } = adapter();
    observe({ operation: 'get', namespace: 'repos', result: 'miss' });
    observe({ operation: 'get', namespace: 'repos', result: 'miss' });

    const repos = zeroed.filter((labels) => labels.namespace === 'repos');
    expect(repos).toContainEqual({ namespace: 'repos', operation: 'get', result: 'hit' });
    expect(repos).toHaveLength(16);
    expect(zeroed.some((labels) => labels.namespace === 'other')).toBe(true);
  });
});
