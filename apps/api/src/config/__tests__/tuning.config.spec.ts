import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hostsConfig } from '../hosts.config';
import { retentionConfig } from '../retention.config';
import { throttlingConfig } from '../throttling.config';

/**
 * The tuning sections: every key has the product's number as its default, an
 * env var replaces it, and a value that is not a positive integer fails boot
 * naming the variable rather than running on a nonsense limit.
 */

/** What each variable held before a test touched it, restored after. */
const touched = new Map<string, string | undefined>();

function setEnv(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    if (!touched.has(key)) touched.set(key, process.env[key]);
    process.env[key] = value;
  }
}

beforeEach(() => {
  // `hosts` requires the API's own URL; everything else in it is optional.
  setEnv({ BETTER_AUTH_URL: 'https://api.example.com' });
  for (const key of ['HOSTS_PAIRING_TOKEN_TTL_SECONDS', 'HOSTS_MAX_UNSPENT_PAIRING_TOKENS']) {
    if (!touched.has(key)) touched.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(() => {
  for (const [key, value] of touched) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
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
    expect(throttlingConfig()).toEqual({
      defaultLimit: 100,
      defaultWindowSeconds: 60,
      authFailureLimit: 30,
      authFailureWindowSeconds: 60,
      authFailureBlockSeconds: 60,
    });
    expect(hostsConfig()).toMatchObject({
      pairingTokenTtlSeconds: 3_600,
      maxUnspentPairingTokens: 5,
    });
  });

  it('takes a value from its env var, and treats a blank one as unset', () => {
    setEnv({
      RETENTION_OUTBOX_DAYS: '14',
      RATE_LIMIT_DEFAULT_LIMIT: '250',
      RATE_LIMIT_AUTH_FAILURES: '',
      HOSTS_PAIRING_TOKEN_TTL_SECONDS: '900',
      HOSTS_MAX_UNSPENT_PAIRING_TOKENS: ' ',
    });
    expect(retentionConfig().outboxDays).toBe(14);
    expect(throttlingConfig().defaultLimit).toBe(250);
    expect(throttlingConfig().authFailureLimit).toBe(30);
    expect(hostsConfig()).toMatchObject({
      pairingTokenTtlSeconds: 900,
      maxUnspentPairingTokens: 5,
    });
  });

  it('fails naming the variable when a value is not a positive integer', () => {
    setEnv({ RETENTION_BATCH_SIZE: '0' });
    expect(() => retentionConfig()).toThrow(/RETENTION_BATCH_SIZE/);
    setEnv({ RATE_LIMIT_AUTH_FAILURE_BLOCK_SECONDS: '1.5' });
    expect(() => throttlingConfig()).toThrow(/RATE_LIMIT_AUTH_FAILURE_BLOCK_SECONDS/);
    setEnv({ HOSTS_PAIRING_TOKEN_TTL_SECONDS: '-60' });
    expect(() => hostsConfig()).toThrow(/HOSTS_PAIRING_TOKEN_TTL_SECONDS/);
    setEnv({ HOSTS_PAIRING_TOKEN_TTL_SECONDS: '900', HOSTS_MAX_UNSPENT_PAIRING_TOKENS: 'many' });
    expect(() => hostsConfig()).toThrow(/HOSTS_MAX_UNSPENT_PAIRING_TOKENS/);
  });
});
