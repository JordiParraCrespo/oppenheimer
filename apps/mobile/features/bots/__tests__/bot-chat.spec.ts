import {
  BotConversationEntity,
  BotMessageEntity,
  BotTurnEntity,
} from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { approvalDetail } from '../lib/approval-detail';
import { previewLine } from '../lib/preview-line';
import { transcriptRows } from '../lib/transcript-rows';

/**
 * The phone's reading of a bot's chat. What breaks if it drifts: a run of
 * tool calls drawn as a dozen lines, the words a turn is writing never shown
 * (or shown twice), Markdown marks in a row's preview, and an approval with
 * nothing to say about what it runs.
 */
describe('a bot’s chat on the phone', () => {
  const at = (s: number) => new Date(Date.UTC(2026, 10, 15, 9, 0, s));
  const step = {
    callId: 's',
    name: 'Bash',
    input: {},
    output: null,
    isError: false,
    sessionId: null,
    subagents: null,
    allowedBy: null,
    mailDraft: null,
    rateLimit: null,
  };
  const message = (
    id: string,
    role: 'user' | 'assistant' | 'activity' | 'event',
    content: string,
    steps = 0,
    turnId: string | null = 't1',
  ) =>
    new BotMessageEntity(
      id,
      turnId,
      role,
      content,
      Array.from({ length: steps }, () => step),
      at(0),
    );
  const turn = (status: 'running' | 'completed') =>
    new BotTurnEntity(
      't1',
      status,
      'anthropic' as never,
      'model',
      null,
      0,
      0,
      false,
      at(0),
      at(0),
      status === 'completed' ? at(73) : null,
    );

  it('folds a turn’s tool calls into one line with its time, between what you said and its words', () => {
    const conversation = new BotConversationEntity(
      [
        message('m1', 'user', 'Wire cancel through'),
        message('m2', 'activity', '', 3),
        message('m3', 'activity', '', 5),
        message('m4', 'assistant', 'The stop path now reaches the tool layer.'),
      ],
      [turn('completed')],
      4,
    );
    expect(transcriptRows(conversation, {})).toEqual([
      { kind: 'you', key: 'm1', text: 'Wire cancel through' },
      { kind: 'work', key: 't1:m2', steps: 8, ms: 73_000, working: false },
      { kind: 'reply', key: 'm4', text: 'The stop path now reaches the tool layer.', live: false },
    ]);
  });

  it('adds the words a running turn is writing after what is stored of it', () => {
    const conversation = new BotConversationEntity(
      [message('m1', 'user', 'Go')],
      [turn('running')],
      1,
    );
    const rows = transcriptRows(conversation, { t1: 'Half a sen' });
    expect(rows.at(-1)).toEqual({ kind: 'reply', key: 'live:t1', text: 'Half a sen', live: true });
  });

  it('reads a preview’s Markdown rather than showing it', () => {
    expect(previewLine('Merged **#118** after `checks`.\n\n- Opened [issue](https://x)')).toBe(
      'Merged #118 after checks. Opened issue',
    );
  });

  it('names what an approval runs: its command, else its target', () => {
    expect(approvalDetail({ command: 'git push -u origin synara/cancel-path' })).toBe(
      'git push -u origin synara/cancel-path',
    );
    expect(approvalDetail({ path: 'src/a.ts' })).toBe('src/a.ts');
    expect(approvalDetail({ body: 'hi' })).toBeNull();
  });
});
