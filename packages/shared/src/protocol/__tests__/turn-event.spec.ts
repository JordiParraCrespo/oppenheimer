import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { turnEndedPayloadSchema } from '../turn-event.js';

const require = createRequire(import.meta.url);

/**
 * `turn.ended` grows by optional fields only, so a runner and a control plane
 * of different ages still agree: what one side does not send, the other reads
 * as unknown.
 */
describe('turn.ended', () => {
  it('parses what an older runner sends: the exit code and nothing else', () => {
    expect(turnEndedPayloadSchema.parse({ exitCode: 0 })).toEqual({ exitCode: 0 });
  });

  it('parses a Claude Code turn with its model and usage', () => {
    const payload = {
      exitCode: 0,
      agentSessionId: 's-1',
      result: 'Done.',
      costUsd: 0.42,
      permissionDenials: 0,
      model: 'claude-sonnet-4-5-20250929',
      inputTokens: 10,
      outputTokens: 40,
      cacheReadTokens: 30,
      cacheWriteTokens: 20,
    };
    expect(turnEndedPayloadSchema.parse(payload)).toEqual(payload);
  });

  it('refuses a negative or fractional token count, and a model id the column cannot hold', () => {
    expect(turnEndedPayloadSchema.safeParse({ exitCode: 0, inputTokens: -1 }).success).toBe(false);
    expect(turnEndedPayloadSchema.safeParse({ exitCode: 0, outputTokens: 1.5 }).success).toBe(
      false,
    );
    expect(turnEndedPayloadSchema.safeParse({ exitCode: 0, model: 'm'.repeat(65) }).success).toBe(
      false,
    );
  });
});

describe('the runner turn.ended payload', () => {
  const emitter = require('../../../scripts/emit-turn-event.cjs') as {
    outputPath: string;
    render: () => string;
    FIELDS: [string, string][];
  };

  it('names every key of the schema, optional ones as pointers', () => {
    const shape = turnEndedPayloadSchema.shape;
    expect(emitter.FIELDS.map(([name]) => name)).toEqual(Object.keys(shape));
    for (const [name, goType] of emitter.FIELDS) {
      const optional = shape[name as keyof typeof shape].safeParse(undefined).success;
      expect({ name, pointer: goType.startsWith('*') }).toEqual({ name, pointer: optional });
    }
  });

  it('is the committed generation of this schema, so the host cannot drift from the API', () => {
    expect(readFileSync(emitter.outputPath, 'utf8')).toBe(emitter.render());
  });
});
