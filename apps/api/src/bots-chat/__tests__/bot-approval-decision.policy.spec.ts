import type { BotPermission } from '@oppenheimer/shared';
import {
  approvalPlan,
  type BotApprovalPlan,
  type BotApprovalVerdict,
  decideApproval,
} from '../domain/bot-approval-decision.policy';
import { type BotPermissions, NO_PERMISSIONS } from '../domain/bot-tool-permission.policy';

/**
 * The order an asking call's checks run in, as one decision table: escalate,
 * then a grant, then the owner's rules, then Approve for me's reviewer, then
 * the card; and what each level and setting does to it. A regression here is
 * a call run that should have asked (a reviewer read before an ask rule, a
 * Full access escalation still carded the other way round) or a card nobody
 * needed. How the factory runs the plan is `bot-tool.factory.spec.ts`.
 */
const tool = { name: 'merge_pull_request', asks: true, perCallOnly: false };
const askRule = { id: 'r1', effect: 'ask' as const, text: 'Ask before prod' };
const allowRule = { id: 'r2', effect: 'allow' as const, text: 'Docs are fine' };
const withRules = (...rules: BotPermissions['rules']): BotPermissions => ({
  ...NO_PERMISSIONS,
  rules,
});

function plan(
  overrides: Partial<Parameters<typeof approvalPlan>[0]> & { preset?: BotPermission } = {},
) {
  return approvalPlan({
    preset: 'auto',
    permissions: NO_PERMISSIONS,
    traits: tool,
    asks: true,
    escalates: false,
    granted: null,
    reviewers: { rules: true, auto: true },
    ...overrides,
  });
}

describe('approvalPlan', () => {
  it('escalates under Ask for approval and Approve for me, never under Full access', () => {
    expect(plan({ preset: 'ask', escalates: true })).toEqual({ kind: 'escalate' });
    expect(plan({ preset: 'auto', escalates: true })).toEqual({ kind: 'escalate' });
    expect(plan({ preset: 'full', escalates: true, asks: false })).toEqual({
      kind: 'run',
      line: null,
    });
  });

  it('runs a call a standing grant covers, before any review, saying so', () => {
    expect(plan({ granted: { label: 'acme/docs' } })).toEqual({
      kind: 'run',
      line: 'Always allowed for acme/docs',
    });
  });

  it('under Approve for me, reads every rule first and then the reviewer', () => {
    expect(plan({ permissions: withRules(askRule) })).toMatchObject({
      kind: 'review',
      reviews: ['rules', 'auto'],
      rules: [askRule],
      otherwise: 'ask',
    });
  });

  it('under Ask for approval, reads only what could let the call run, and no reviewer', () => {
    expect(plan({ preset: 'ask', permissions: withRules(askRule) })).toMatchObject({
      kind: 'review',
      reviews: [],
      otherwise: 'ask',
    });
    expect(plan({ preset: 'ask', permissions: withRules(allowRule) })).toMatchObject({
      reviews: ['rules'],
    });
  });

  it('keeps the card of a tool the owner set to Ask, or one that always asks: no reviewer', () => {
    const setAsk = { ...NO_PERMISSIONS, decisions: new Map([[tool.name, 'ask' as const]]) };
    expect(plan({ permissions: setAsk })).toMatchObject({ reviews: [], otherwise: 'ask' });
    expect(plan({ traits: { ...tool, always: true } })).toMatchObject({ reviews: [] });
  });

  it('reads a call that would run only against the ask rules, and runs it otherwise', () => {
    expect(plan({ preset: 'full', asks: false })).toEqual({ kind: 'run', line: null });
    expect(plan({ preset: 'full', asks: false, permissions: withRules(askRule) })).toMatchObject({
      kind: 'review',
      reviews: ['rules'],
      otherwise: 'run',
    });
  });

  it('reads no review the turn has no reviewer for', () => {
    expect(
      plan({ permissions: withRules(askRule), reviewers: { rules: false, auto: false } }),
    ).toMatchObject({ reviews: [], otherwise: 'ask' });
  });
});

describe('decideApproval', () => {
  const review = (
    reviews: ('rules' | 'auto')[],
    otherwise: 'run' | 'ask',
  ): Extract<BotApprovalPlan, { kind: 'review' }> => ({
    kind: 'review',
    reviews,
    rules: [],
    otherwise,
  });
  const answering = (verdicts: Record<string, BotApprovalVerdict>) =>
    vi.fn(async (kind: string) => verdicts[kind]);

  it('stops at the first verdict that settles, never asking the reviewer after an ask rule', async () => {
    const said = answering({
      rules: { effect: 'ask', note: 'Paused by your rule' },
      auto: { effect: 'allow', line: 'Auto-approved: x' },
    });
    expect(await decideApproval(review(['rules', 'auto'], 'ask'), said)).toEqual({
      kind: 'ask',
      note: 'Paused by your rule',
    });
    expect(said).toHaveBeenCalledTimes(1);
  });

  it('goes on to the reviewer when no rule matched, and runs what it clears with its line', async () => {
    const said = answering({
      rules: { effect: 'none' },
      auto: { effect: 'allow', line: 'Auto-approved: you asked' },
    });
    expect(await decideApproval(review(['rules', 'auto'], 'ask'), said)).toEqual({
      kind: 'run',
      line: 'Auto-approved: you asked',
    });
  });

  it('asks when nothing settles a call that would ask, and runs one that would run, with no line', async () => {
    const none = answering({ rules: { effect: 'none' } });
    expect(await decideApproval(review(['rules'], 'ask'), none)).toEqual({
      kind: 'ask',
      note: null,
    });
    expect(await decideApproval(review(['rules'], 'run'), none)).toEqual({
      kind: 'run',
      line: null,
    });
    const allowed = answering({ rules: { effect: 'allow', line: 'Auto-approved by your rule' } });
    expect(await decideApproval(review(['rules'], 'run'), allowed)).toEqual({
      kind: 'run',
      line: null,
    });
  });
});
