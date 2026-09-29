import { afterEach, describe, expect, it } from 'vitest';
import { apiTokensConfig } from '../api-tokens.config';
import { relayConfig } from '../relay.config';
import { retentionConfig } from '../retention.config';
import { throttlingConfig } from '../throttling.config';

/**
 * The tuning sections: every key has the product's number as its default, an
 * env var replaces it, and a value that is not a positive integer fails boot
 * naming the variable rather than running on a nonsense limit.
 */

const touched = new Set<string>();

function setEnv(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    touched.add(key);
    process.env[key] = value;
  }
}

afterEach(() => {
  for (const key of touched) delete process.env[key];
  touched.clear();
});

describe('tuning config sections', () => {
  it('default to the product numbers when nothing is set', () => {
    expect(retentionConfig()).toEqual({
      hostNetworkDays: 90,
      hostTimelineDays: 180,
      automationRunDays: 180,
      inboundEventDays: 30,
      outboxDays: 7,
      batchSize: 5_000,
      maxBatches: 200,
    });
    expect(relayConfig()).toEqual({
      helloTimeoutMs: 10_000,
      linkMaxBufferedBytes: 8 * 1024 * 1024,
      browserMaxBufferedBytes: 4 * 1024 * 1024,
    });
    expect(throttlingConfig()).toEqual({
      defaultLimit: 100,
      defaultWindowSeconds: 60,
      authFailureLimit: 30,
      authFailureWindowSeconds: 60,
      authFailureBlockSeconds: 60,
    });
    expect(apiTokensConfig()).toEqual({ maxActivePerUser: 50 });
  });

  it('takes a value from its env var, and treats a blank one as unset', () => {
    setEnv({
      RETENTION_OUTBOX_DAYS: '14',
      RATE_LIMIT_DEFAULT_LIMIT: '250',
      RELAY_HELLO_TIMEOUT_MS: '',
    });
    expect(retentionConfig().outboxDays).toBe(14);
    expect(throttlingConfig().defaultLimit).toBe(250);
    expect(relayConfig().helloTimeoutMs).toBe(10_000);
  });

  it('fails naming the variable when a value is not a positive integer', () => {
    setEnv({ RETENTION_BATCH_SIZE: '0' });
    expect(() => retentionConfig()).toThrow(/RETENTION_BATCH_SIZE/);
    setEnv({ API_TOKENS_MAX_ACTIVE_PER_USER: 'many' });
    expect(() => apiTokensConfig()).toThrow(/API_TOKENS_MAX_ACTIVE_PER_USER/);
  });
});
