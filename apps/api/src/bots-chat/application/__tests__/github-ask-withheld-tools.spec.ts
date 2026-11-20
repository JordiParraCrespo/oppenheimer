import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { BotPeerToolsFactory } from '../bot-bots-tools.factory';
import { BotIssueToolsFactory } from '../bot-issue-tools.factory';
import { BotPullRequestToolsFactory } from '../bot-pull-request-tools.factory';
import type { BotSessionWatchResolver } from '../bot-session-watch.resolver';

/**
 * What a turn an ask on GitHub opened is not offered: every tool that writes
 * on GitHub in the owner's name, and asking another bot for an answer. Its
 * answer is the App's one comment, and an owner's comment that named a bot
 * would ask that bot again with no chain to bound it. That the toolbox drops
 * a tool whose `notOn` names the turn's origin is `bot-toolbox.factory.spec.ts`.
 */
const bus = { execute: vi.fn() };
const definitions = [
  ...new BotIssueToolsFactory(
    bus as unknown as QueryBus,
    bus as unknown as CommandBus,
  ).definitions(),
  ...new BotPullRequestToolsFactory(
    bus as unknown as QueryBus,
    bus as unknown as CommandBus,
    {} as BotSessionWatchResolver,
  ).definitions(),
  ...new BotPeerToolsFactory(
    bus as unknown as QueryBus,
    bus as unknown as CommandBus,
  ).definitions(),
];

describe('the tools a GitHub ask is not offered', () => {
  // Breaks if a GitHub turn can comment in the owner's name (a second answer,
  // and a loop when it names a bot), or wait on an answer GitHub never sees.
  it('withholds the GitHub writes and ask_bot from a GitHub ask, and only from it', () => {
    const withheld = [
      'create_issue',
      'comment_on_issue',
      'comment_on_pull_request',
      'review_pull_request',
      'ask_bot',
    ];
    for (const name of withheld) {
      const definition = definitions.find((candidate) => candidate.name === name);
      expect(definition?.notOn, name).toContain('github');
      expect(definition?.notOn, name).not.toContain('message');
    }
    const reads = definitions.filter((definition) => !withheld.includes(definition.name));
    expect(reads.some((definition) => definition.name === 'record_ci_findings')).toBe(true);
    for (const definition of reads)
      expect(definition.notOn, definition.name).not.toContain('github');
  });
});
