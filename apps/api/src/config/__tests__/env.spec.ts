import { inspect } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { orUndefined, parseEnv } from '../env';

const OWNED = ['TEST_SECRET', 'TEST_URL', 'TEST_PASSWORD', 'TEST_G_ID', 'TEST_G_SECRET'];

afterEach(() => {
  for (const key of OWNED) delete process.env[key];
});

describe('orUndefined', () => {
  it('treats unset and blank alike', () => {
    expect(orUndefined(undefined)).toBeUndefined();
    expect(orUndefined('')).toBeUndefined();
    expect(orUndefined('   \t\n ')).toBeUndefined();
  });

  it('returns a nonblank value verbatim, whitespace and all', () => {
    // A credential may legitimately carry surrounding whitespace. Trimming it
    // here would hand a different password to TypeORM than the one Better
    // Auth's pool reads straight off `process.env`.
    expect(orUndefined('  s3cr3t  ')).toBe('  s3cr3t  ');
    expect(orUndefined('\tpa ss\n')).toBe('\tpa ss\n');
  });
});

describe('parseEnv', () => {
  const schema = z.object({
    secret: z.string().min(8),
    url: z.string().url().default('http://localhost:3000'),
    password: z.string().default('oppenheimer'),
  });
  const envKeys = {
    secret: 'TEST_SECRET',
    url: 'TEST_URL',
    password: 'TEST_PASSWORD',
  };

  it('reads each key from the env var it names', () => {
    process.env.TEST_SECRET = 'long-enough';
    process.env.TEST_URL = 'https://example.com';

    expect(parseEnv('test', schema, envKeys)).toEqual({
      secret: 'long-enough',
      url: 'https://example.com',
      password: 'oppenheimer',
    });
  });

  it('passes a whitespace-padded value through untouched', () => {
    process.env.TEST_SECRET = 'long-enough';
    process.env.TEST_PASSWORD = ' pa ss ';

    expect(parseEnv('test', schema, envKeys).password).toBe(' pa ss ');
  });

  it('falls back to the default when a var is set but blank', () => {
    process.env.TEST_SECRET = 'long-enough';
    process.env.TEST_PASSWORD = '   ';

    expect(parseEnv('test', schema, envKeys).password).toBe('oppenheimer');
  });

  it('names the env var to set, not the config key', () => {
    expect(() => parseEnv('app', schema, envKeys)).toThrow(/TEST_SECRET:/);
  });

  it('reports every problem at once', () => {
    process.env.TEST_SECRET = 'short';
    process.env.TEST_URL = 'not-a-url';

    expect(() => parseEnv('app', schema, envKeys)).toThrow(/TEST_SECRET:[\s\S]*TEST_URL:/);
  });

  it('throws a plain Error, so logging it cannot crash the logger', () => {
    // A ZodError is not safely printable: on Node >= 23 `util.inspect` throws
    // on one, and that secondary throw is what turned a missing env var into
    // an `Aborted (core dumped)` with no message. See the note in env.ts.
    let thrown: unknown;
    try {
      parseEnv('app', schema, envKeys);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(z.ZodError);
    expect(() => inspect(thrown)).not.toThrow();
  });

  it('nests dotted keys into the shape the schema expects', () => {
    process.env.TEST_G_ID = 'client-id';
    const nested = z.object({
      google: z.object({
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
      }),
    });

    expect(
      parseEnv('oauth', nested, {
        'google.clientId': 'TEST_G_ID',
        'google.clientSecret': 'TEST_G_SECRET',
      }),
    ).toEqual({ google: { clientId: 'client-id', clientSecret: undefined } });
  });
});
