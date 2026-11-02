import { composeRuleReview, rulesToReview, ruleVerdict } from '../domain/bot-rule-review.policy';
import { NO_PERMISSIONS } from '../domain/bot-tool-permission.policy';

/**
 * How the owner's rules turn the reviewer's answer into a decision
 * (`25-bots.md` §5). What breaks this: an allow rule beating an ask rule
 * that also matched; an unreadable answer, or one naming a rule that is not
 * there, read as "no rule applies" (fail open); a review spent on a call no
 * rule could change.
 */
const rules = [
  { id: 'r-1', effect: 'allow' as const, text: 'Comments on acme/docs are fine' },
  { id: 'r-2', effect: 'ask' as const, text: 'Ask before anything mentioning payments' },
];

describe('ruleVerdict', () => {
  it('lets an ask rule win when both kinds match', () => {
    expect(ruleVerdict('{"matches": [1, 2]}', rules)).toEqual({
      effect: 'ask',
      rule: { id: 'r-2', text: 'Ask before anything mentioning payments' },
    });
  });

  it('names the allow rule when only it matches, and none when nothing does', () => {
    expect(ruleVerdict('Sure: {"matches":[1]}', rules)).toMatchObject({
      effect: 'allow',
      rule: { id: 'r-1' },
    });
    expect(ruleVerdict('{"matches": []}', rules)).toEqual({ effect: 'none' });
  });

  it('throws, so the call asks, on an answer it cannot read or a rule that is not there', () => {
    expect(() => ruleVerdict('rule 1 applies', rules)).toThrow();
    expect(() => ruleVerdict('{"match": 1}', rules)).toThrow();
    expect(() => ruleVerdict('{"matches": [3]}', rules)).toThrow();
    expect(() => ruleVerdict('{"matches": ["1"]}', rules)).toThrow();
  });
});

describe('rulesToReview', () => {
  const only = (effect: 'allow' | 'ask') => ({
    ...NO_PERMISSIONS,
    rules: rules.filter((rule) => rule.effect === effect),
  });

  it('reviews a call that would ask only when an allow rule could let it run', () => {
    expect(rulesToReview(only('ask'), 'ask')).toEqual([]);
    expect(rulesToReview(only('allow'), 'ask')).toHaveLength(1);
  });

  it('reviews a call that would run only when an ask rule could stop it, against every rule', () => {
    expect(rulesToReview(only('allow'), 'allow')).toEqual([]);
    expect(rulesToReview({ ...NO_PERMISSIONS, rules }, 'allow')).toHaveLength(2);
  });
});

describe('composeRuleReview', () => {
  it('numbers the rules and fences the call as data', () => {
    const message = composeRuleReview(
      { tool: 'comment_on_pull_request', summary: 'Comment on acme/docs#4', input: { body: 'hi' } },
      rules,
    );
    expect(message).toContain('1. ALLOW: Comments on acme/docs are fine');
    expect(message).toContain('2. ASK: Ask before anything mentioning payments');
    expect(message).toMatch(/<action>\ntool: comment_on_pull_request\n[\s\S]*<\/action>$/);
  });
});
