import { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import {
  type ChatExportWords,
  chatExportChunk,
  chatExportFilename,
  chatExportHeader,
} from '../lib/chat-export';

/**
 * The Markdown an export downloads, one piece per message as the export
 * streams in: who said what and when, the bot's tool calls one line each in
 * the chat's words, an event as Oppenheimer's line, and the file named after
 * the bot and the day. A `t` that echoes its key and values stands in for the
 * catalog, so the spec reads which words were asked for.
 */
const t = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key}(${Object.values(values).join(',')})` : key) as unknown as TFunction;
const at = (minute: number) => new Date(2026, 9, 15, 10, minute);
const words: ChatExportWords = {
  botName: 'Release Bot',
  formatTime: (date) => `10:${String(date.getMinutes()).padStart(2, '0')}`,
  t,
};

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

describe('chatExportHeader and chatExportChunk', () => {
  it('open on the bot’s name, then give each message its author and time', () => {
    const file =
      chatExportHeader(words, at(30)) +
      chatExportChunk(message('user', 'What is staging?', 1), words) +
      chatExportChunk(message('assistant', 'Staging is devbox.\n', 2), words);
    expect(file).toBe(
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

  it('condense a run of tool calls to one line each, a failed one marked', () => {
    const chunk = chatExportChunk(
      message('activity', '', 3, {
        steps: [
          {
            callId: 'a',
            name: 'WebSearch',
            input: { query: 'bun vs node' },
            output: '',
            isError: false,
            sessionId: null,
          },
          {
            callId: 'b',
            name: 'TodoWrite',
            input: {},
            output: '',
            isError: false,
            sessionId: null,
          },
          {
            callId: 'c',
            name: 'read_document',
            input: { name: 'soul' },
            output: 'no',
            isError: true,
            sessionId: null,
          },
        ],
      }),
      words,
    );
    expect(chunk).toBe(
      [
        '',
        '**Release Bot** · 10:03',
        '',
        '- bots.chat.activity.searchedFor(bun vs node)',
        '- bots.chat.activity.planned',
        '- Read document soul (bots.chat.activity.stepFailed)',
        '',
      ].join('\n'),
    );
  });

  it('write an event as Oppenheimer’s line, from its fields rather than its words to the bot', () => {
    const chunk = chatExportChunk(
      message('event', 'The owner approved start_session.', 4, {
        event: {
          kind: 'approval',
          outcome: 'denied',
          tool: 'start_session',
          summary: 'Start it',
          sessionId: null,
        },
      }),
      words,
    );
    expect(chunk).toContain(
      '**bots.settings.profile.oppenheimer** · 10:04\n\nbots.chat.event.denied(Start it)',
    );
    expect(chunk).not.toContain('The owner approved');
  });

  it('leave out a message with nothing to say', () => {
    expect(chatExportChunk(message('assistant', '  ', 5), words)).toBe('');
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
