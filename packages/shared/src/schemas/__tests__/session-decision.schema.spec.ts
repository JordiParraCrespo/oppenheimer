import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  agentDecisionPayloadSchema,
  answerSessionDecisionSchema,
  sessionDecisionQuestionOptionSchema,
  sessionDecisionQuestionSchema,
  sessionPermissionDecisionSchema,
  sessionQuestionDecisionSchema,
} from '../session-decision.schema.js';

const require = createRequire(import.meta.url);

/**
 * The decision a runner reports and the control plane folds onto the session.
 * The runner leaves out a nullable text it did not see, so absent must read as
 * null; a payload either side cannot parse is a question the Inbox never shows.
 */
describe('agent.decision', () => {
  it('reads a question the runner sent without headers or descriptions, as nulls', () => {
    const parsed = agentDecisionPayloadSchema.parse({
      decision: {
        kind: 'question',
        id: 'toolu_01',
        questions: [{ question: 'Which?', multiSelect: false, options: [{ label: 'A' }] }],
      },
    });
    expect(parsed.decision).toEqual({
      kind: 'question',
      id: 'toolu_01',
      questions: [
        {
          header: null,
          question: 'Which?',
          multiSelect: false,
          options: [{ label: 'A', description: null }],
        },
      ],
    });
  });

  it('reads a permission dialog, and refuses one with a single option', () => {
    const dialog = {
      kind: 'permission',
      id: 'p-1',
      title: 'Do you want to proceed?',
      options: [{ label: 'Yes' }, { label: 'No' }],
    };
    expect(agentDecisionPayloadSchema.parse({ decision: dialog }).decision).toMatchObject({
      detail: null,
    });
    expect(
      agentDecisionPayloadSchema.safeParse({ decision: { ...dialog, options: [{ label: 'Yes' }] } })
        .success,
    ).toBe(false);
  });

  it('reads a cleared decision as null', () => {
    expect(agentDecisionPayloadSchema.parse({ decision: null })).toEqual({ decision: null });
  });
});

describe('the answer body', () => {
  it('takes answers for a question and an option for a permission', () => {
    expect(
      answerSessionDecisionSchema.parse({ id: 'q', answers: [{ picks: [1], other: null }] }),
    ).toEqual({ id: 'q', answers: [{ picks: [1], other: null }] });
    expect(answerSessionDecisionSchema.parse({ id: 'p', option: 2 })).toEqual({
      id: 'p',
      option: 2,
    });
  });

  it('refuses a negative option, and an answer with neither or both', () => {
    expect(answerSessionDecisionSchema.safeParse({ id: 'p', option: -1 }).success).toBe(false);
    expect(answerSessionDecisionSchema.safeParse({ id: 'p' }).success).toBe(false);
    expect(
      answerSessionDecisionSchema.safeParse({
        id: 'p',
        option: 0,
        answers: [{ picks: [0], other: null }],
      }).success,
    ).toBe(false);
  });
});

describe('the runner agent.decision payload', () => {
  const emitter = require('../../../scripts/emit-session-decision.cjs') as {
    outputPath: string;
    render: () => string;
    STRUCTS: [string, string, [string, string, string, boolean][]][];
  };
  const keys = (name: string) =>
    emitter.STRUCTS.find(([struct]) => struct === name)?.[2].map(([json]) => json);

  it('names every key of the schema, in both kinds of decision', () => {
    expect(keys('DecisionQuestionOption')).toEqual(
      Object.keys(sessionDecisionQuestionOptionSchema.shape),
    );
    expect(keys('DecisionQuestion')).toEqual(Object.keys(sessionDecisionQuestionSchema.shape));
    const decision = new Set([
      ...Object.keys(sessionQuestionDecisionSchema.shape),
      ...Object.keys(sessionPermissionDecisionSchema.shape),
    ]);
    expect(new Set(keys('Decision'))).toEqual(decision);
  });

  it('is the committed generation of this schema, so the host cannot drift from the API', () => {
    expect(readFileSync(emitter.outputPath, 'utf8')).toBe(emitter.render());
  });
});
