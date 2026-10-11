import { describe, expect, it } from 'vitest';
import { EchoLatency } from '../lib/echo-latency';

describe('EchoLatency', () => {
  it('times a key sent on a quiet stream to the next output', () => {
    const latency = new EchoLatency();
    latency.sent(1000);
    latency.received(1080);
    expect(latency.quantile(0.5)).toBe(80);
  });

  it('takes no sample while the agent is printing (the next chunk is not the echo)', () => {
    const latency = new EchoLatency(200);
    latency.received(1000);
    latency.sent(1050);
    latency.received(1052);
    expect(latency.count).toBe(0);
  });

  it('drops a key the program never answered rather than recording minutes', () => {
    const latency = new EchoLatency(200, 3000);
    latency.sent(1000);
    latency.received(9000);
    expect(latency.count).toBe(0);
  });

  it('reads quantiles over the recent window only', () => {
    const latency = new EchoLatency(200, 3000, 3);
    for (const sample of [500, 10, 20, 30]) latency.add(sample);
    expect(latency.count).toBe(3);
    expect(latency.quantile(0.95)).toBe(30);
  });
});
