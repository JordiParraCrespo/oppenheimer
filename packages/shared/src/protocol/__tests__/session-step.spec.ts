import { describe, expect, it } from 'vitest';
import {
  SESSION_START_STEPS,
  sessionFailedPayloadSchema,
  sessionStepPayloadSchema,
} from '../session-step';

/**
 * One vocabulary for the steps of a start, on both sides of the log: the runner
 * writes it in generated Go, the console parses it with this schema. A step
 * name the schema does not know is refused here rather than drawn as a row that
 * stays pending forever.
 */
describe('session.step', () => {
  it('names the steps in the order the host runs them', () => {
    expect(SESSION_START_STEPS).toEqual(['host', 'clone', 'worktree', 'agent']);
  });

  it('parses what the runner writes, with and without a duration', () => {
    expect(sessionStepPayloadSchema.parse({ step: 'clone', status: 'running' })).toEqual({
      step: 'clone',
      status: 'running',
    });
    expect(
      sessionStepPayloadSchema.parse({ step: 'clone', status: 'done', durationMs: 1340 }),
    ).toEqual({ step: 'clone', status: 'done', durationMs: 1340 });
  });

  it('refuses a step or a status it does not know', () => {
    expect(sessionStepPayloadSchema.safeParse({ step: 'worktrees', status: 'done' }).success).toBe(
      false,
    );
    expect(sessionStepPayloadSchema.safeParse({ step: 'clone', status: 'failed' }).success).toBe(
      false,
    );
  });

  it('reads a failure with or without a reason', () => {
    expect(sessionFailedPayloadSchema.parse({ detail: 'clone refused', code: 'SESS_004' })).toEqual(
      {
        detail: 'clone refused',
        code: 'SESS_004',
      },
    );
    expect(sessionFailedPayloadSchema.parse({})).toEqual({});
  });
});

describe('the runner session.step vocabulary', () => {
  it('is the committed generation of this schema, so the host cannot drift from the console', async () => {
    const { readFileSync } = await import('node:fs');
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const { outputPath, render } = require('../../../scripts/emit-session-step.cjs');
    expect(readFileSync(outputPath, 'utf8')).toBe(render());
  });
});
