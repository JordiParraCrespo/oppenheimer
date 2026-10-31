import { BotPermissionRuleEntity } from '../domain/bot-permission-rule.entity';
import { BotToolPermissionEntity } from '../domain/bot-tool-permission.entity';
import {
  decisionsFor,
  grantFor,
  NO_PERMISSIONS,
  permissionsOf,
  reachesFor,
  toolDecision,
} from '../domain/bot-tool-permission.policy';

/**
 * How a bot's tool settings decide a call (`25-bots.md` §5). What breaks
 * this: a tool the owner turned Off still offered; a setting that does not
 * win over the preset; a grant for one repository covering another, or
 * another tool; a per-call tool (merging) made standing by any route.
 */
const base = { organizationId: 'org-1', botId: 'bot-1', userId: 'user-1' };
const merge = { name: 'merge_pull_request', asks: true, perCallOnly: true };
const comment = { name: 'comment_on_pull_request', asks: true, perCallOnly: false };
const recall = { name: 'recall', asks: false, perCallOnly: false };
const repo = (key: string) => ({ kind: 'repository', key, label: key });

const settings = (
  ...rows: Array<
    { tool: string; decision: 'allow' | 'ask' | 'off' } | { tool: string; grant: string }
  >
) =>
  permissionsOf(
    rows.map((row) =>
      'grant' in row
        ? BotToolPermissionEntity.grant({ ...base, tool: row.tool, subject: repo(row.grant) })
        : BotToolPermissionEntity.decide({ ...base, tool: row.tool, decision: row.decision }),
    ),
    [],
  );

describe('toolDecision', () => {
  it('follows the preset where nothing is set: an outside tool asks under Approve for me, runs under Full access', () => {
    expect(toolDecision(NO_PERMISSIONS, comment, 'auto')).toBe('ask');
    expect(toolDecision(NO_PERMISSIONS, comment, 'full')).toBe('allow');
    expect(toolDecision(NO_PERMISSIONS, recall, 'auto')).toBe('allow');
  });

  it('lets the owner’s setting win over the preset, either way', () => {
    expect(toolDecision(settings({ tool: comment.name, decision: 'allow' }), comment, 'auto')).toBe(
      'allow',
    );
    expect(toolDecision(settings({ tool: comment.name, decision: 'ask' }), comment, 'full')).toBe(
      'ask',
    );
    expect(toolDecision(settings({ tool: recall.name, decision: 'off' }), recall, 'full')).toBe(
      'off',
    );
  });

  it('never makes a per-call tool standing, even with an Allow set', () => {
    expect(toolDecision(settings({ tool: merge.name, decision: 'allow' }), merge, 'auto')).toBe(
      'ask',
    );
  });
});

describe('grantFor', () => {
  it('covers a call on the very thing granted, and nothing else', () => {
    const granted = settings({ tool: comment.name, grant: 'acme/docs' });
    expect(grantFor(granted, comment, repo('acme/docs'))).toEqual(repo('acme/docs'));
    expect(grantFor(granted, comment, repo('acme/api'))).toBeNull();
    expect(grantFor(granted, comment, { ...repo('acme/docs'), kind: 'session' })).toBeNull();
    expect(grantFor(granted, comment, null)).toBeNull();
    expect(
      grantFor(granted, { ...comment, name: 'review_pull_request' }, repo('acme/docs')),
    ).toBeNull();
  });

  it('gives a per-call tool no grant', () => {
    expect(
      grantFor(settings({ tool: merge.name, grant: 'acme/docs' }), merge, repo('acme/docs')),
    ).toBeNull();
  });
});

describe('decisionsFor', () => {
  // The card draws exactly what it is offered: an "Always allow for …" with no subject would name nothing.
  it('offers a yes for the subject only when the call names one, and never for a per-call tool', () => {
    expect(decisionsFor(reachesFor(comment, repo('acme/docs')))).toEqual([
      'approve',
      'approve_for_subject',
      'approve_always',
      'deny',
      'stop',
    ]);
    expect(decisionsFor(reachesFor(comment, null))).toEqual([
      'approve',
      'approve_always',
      'deny',
      'stop',
    ]);
    expect(decisionsFor(reachesFor(merge, repo('acme/docs')))).toEqual(['approve', 'deny', 'stop']);
  });
});

describe('reachesFor', () => {
  it('offers this call, this thing and the tool, but only this call for a per-call tool', () => {
    expect(reachesFor(comment, repo('acme/docs'))).toEqual(['once', 'subject', 'tool']);
    expect(reachesFor(comment, null)).toEqual(['once', 'tool']);
    expect(reachesFor(merge, repo('acme/docs'))).toEqual(['once']);
  });
});

describe('permissionsOf', () => {
  it('reads decisions, grants and rules apart', () => {
    const permissions = permissionsOf(
      [
        BotToolPermissionEntity.decide({ ...base, tool: 'recall', decision: 'off' }),
        BotToolPermissionEntity.grant({ ...base, tool: comment.name, subject: repo('acme/docs') }),
      ],
      [BotPermissionRuleEntity.write({ ...base, effect: 'ask', text: '  Ask before   payments ' })],
    );
    expect([...permissions.decisions]).toEqual([['recall', 'off']]);
    expect(permissions.grants).toEqual([{ tool: comment.name, subject: repo('acme/docs') }]);
    expect(permissions.rules.map((rule) => [rule.effect, rule.text])).toEqual([
      ['ask', 'Ask before payments'],
    ]);
  });

  it('refuses a grant that is not an allow, and a rule with no words', () => {
    expect(() =>
      BotToolPermissionEntity.create({
        id: 'x',
        props: {
          ...base,
          tool: comment.name,
          decision: 'ask',
          subject: repo('acme/docs'),
          createdByUserId: null,
        },
      }).validate(),
    ).toThrow();
    expect(() =>
      BotPermissionRuleEntity.write({ ...base, effect: 'allow', text: '   ' }),
    ).toThrow();
  });
});
