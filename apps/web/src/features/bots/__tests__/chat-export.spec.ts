import { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { chatExportFilename, chatExportMarkdown } from '../lib/chat-export';

/**
 * The Markdown an export downloads: who said what and when, the bot's tool
 * calls one line each in the chat's words, an event as Oppenheimer's line,
 * and the file named after the bot and the day. A `t` that echoes its key
 * and values stands in for the catalog, so the spec reads which words were
 * asked for.
 */
const t = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key}(${Object.values(values).join(',')})` : key) as unknown as TFunction;
const at = (minute: number) => new Date(2026, 9, 15, 10, minute);
const formatTime = (date: Date) => `10:${String(date.getMinutes()).padStart(2, '0')}`;

function message(
  role: BotMessageEntity['role'],
  content: string,
  minute: number,
  extra: Partial<Pick<BotMessageEntity, 'steps' | 'event'>> = {},
): BotMessageEntity {
  return new BotMessageEntity(
    `m-${minute}`,
    't-1',
    role,
    content,
    extra.steps ?? [],
    at(minute),
    extra.event ?? null,
  );
}

describe('chatExportMarkdown', () => {
  it('opens on the bot’s name and gives each message its author and time', () => {
    const markdown = chatExportMarkdown({
      botName: 'Release Bot',
      exportedAt: at(30),
      formatTime,
      t,
      messages: [
        message('user', 'What is staging?', 1),
        message('assistant', 'Staging is devbox.\n', 2),
      ],
    });
    expect(markdown).toBe(
      [
        '# Release Bot',
        '',
        '_bots.settings.profile.exportedAt(10:30)_',
        '',
        '**bots.settings.profile.you** · 10:01',
        '',
        'What is staging?',
        '',
        '**Release Bot** · 10:02',
        '',
        'Staging is devbox.',
        '',
      ].join('\n'),
    );
  });

  it('condenses a run of tool calls to one line each, a failed one marked', () => {
    const markdown = chatExportMarkdown({
      botName: 'Release Bot',
      exportedAt: at(30),
      formatTime,
      t,
      messages: [
        message('activity', '', 3, {
          steps: [
            {
              callId: 'a',
              name: 'WebSearch',
              input: { query: 'bun vs node' },
              output: '',
              isError: false,
            },
            { callId: 'b', name: 'TodoWrite', input: {}, output: '', isError: false },
            {
              callId: 'c',
              name: 'read_document',
              input: { name: 'soul' },
              output: 'no',
              isError: true,
            },
          ],
        }),
      ],
    });
    expect(markdown).toContain(
      [
        '**Release Bot** · 10:03',
        '',
        '- bots.chat.activity.searchedFor(bun vs node)',
        '- bots.chat.activity.planned',
        '- Read document soul (bots.chat.activity.stepFailed)',
      ].join('\n'),
    );
  });

  it('writes an event as Oppenheimer’s line, from its fields rather than its words to the bot', () => {
    const markdown = chatExportMarkdown({
      botName: 'Release Bot',
      exportedAt: at(30),
      formatTime,
      t,
      messages: [
        message('event', 'The owner approved start_session.', 4, {
          event: {
            kind: 'approval',
            outcome: 'denied',
            tool: 'start_session',
            summary: 'Start it',
          },
        }),
      ],
    });
    expect(markdown).toContain(
      '**bots.settings.profile.oppenheimer** · 10:04\n\nbots.chat.event.denied(Start it)',
    );
    expect(markdown).not.toContain('The owner approved');
  });

  it('leaves out a message with nothing to say', () => {
    const markdown = chatExportMarkdown({
      botName: 'Release Bot',
      exportedAt: at(30),
      formatTime,
      t,
      messages: [message('assistant', '  ', 5)],
    });
    expect(markdown).not.toContain('10:05');
  });
});

describe('chatExportFilename', () => {
  it('names the file after the bot as a slug and the local day', () => {
    expect(chatExportFilename('Release Bot', new Date(2026, 9, 5, 23, 59))).toBe(
      'release-bot-chat-2026-10-05.md',
    );
    expect(chatExportFilename('  Árbol / Ñu!  ', new Date(2026, 0, 1))).toBe(
      'arbol-nu-chat-2026-01-01.md',
    );
    expect(chatExportFilename('🤖', new Date(2026, 0, 1))).toBe('bot-chat-2026-01-01.md');
  });
});
