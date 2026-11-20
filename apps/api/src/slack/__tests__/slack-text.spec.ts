import { describe, expect, it } from 'vitest';
import { slackPlainText, slackTsPosition } from '../domain/slack-inbound.policy';
import {
  SLACK_MESSAGE_MAX,
  slackMessages,
  slackMrkdwn,
  slackThreadOf,
} from '../domain/slack-text.policy';

/**
 * The words that cross between Slack and a bot: what the owner wrote reaches
 * the bot as plain text, the bot's answer reaches Slack as Slack reads it and
 * within its length, and a thread's timestamp orders its channel. A
 * regression here sends a bot `<@U0JUNO>` noise, posts raw `**` and broken
 * links, or loses the end of a long answer.
 */
describe('Slack text', () => {
  it('reads a message as plain words: the app’s mention dropped, others readable, escapes undone', () => {
    expect(
      slackPlainText(
        '<@U0JUNO> ask <@U0ANA> in <#C1|ops> about <https://x.dev|this> &amp; &lt;that&gt; <!here>',
        'U0JUNO',
      ),
    ).toBe('ask @U0ANA in #ops about this (https://x.dev) & <that> @here');
  });

  it('writes the bot’s markdown as Slack’s, escaping what Slack would read as markup', () => {
    expect(slackMrkdwn('## Done\n**2 PRs** <merged> ~~old~~ [run](https://ci.dev/1) & `x`')).toBe(
      '*Done*\n*2 PRs* &lt;merged&gt; ~old~ <https://ci.dev/1|run> &amp; `x`',
    );
  });

  // What breaks this: emphasis read as bold, or a quote shown as `> text`.
  it('keeps italics italic and quotes quoted', () => {
    expect(slackMrkdwn('an *aside* and **bold**\n> quoted 1 > 0')).toBe(
      'an _aside_ and *bold*\n> quoted 1 &gt; 0',
    );
  });

  // What breaks this: code the owner is meant to run arrives changed.
  it('leaves code as written, restyling only the prose around it', () => {
    const answer =
      '**Run** this:\n```python\n# square\nprint(2 ** 3 ** 2)\n```\nor `x ** 2 if a < b`';
    expect(slackMrkdwn(answer)).toBe(
      '*Run* this:\n```python\n# square\nprint(2 ** 3 ** 2)\n```\nor `x ** 2 if a &lt; b`',
    );
  });

  it('cuts a long answer at a paragraph, losing nothing', () => {
    const paragraph = `${'word '.repeat(500).trim()}\n\n`;
    const text = paragraph.repeat(4).trim();
    const parts = slackMessages(text);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => part.length <= SLACK_MESSAGE_MAX)).toBe(true);
    expect(parts.join(' ').replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' '));
  });

  it('orders a channel by its timestamps, and reads a thread back from its chat id', () => {
    expect(slackTsPosition('1700000000.000200')).toBe('1700000000000200');
    expect(BigInt(slackTsPosition('1700000001.000001') ?? 0)).toBeGreaterThan(
      BigInt(slackTsPosition('1700000000.999999') ?? 0),
    );
    expect(slackTsPosition('not-a-ts')).toBeNull();
    expect(slackThreadOf('C1:1700000000.000200')).toEqual({
      channel: 'C1',
      threadTs: '1700000000.000200',
    });
    expect(slackThreadOf('C1')).toBeNull();
  });
});
