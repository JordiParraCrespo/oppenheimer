import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SessionTranscriptPartKind } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import {
  cleanModelTitle,
  conversationTitleRequest,
  promptsOf,
  SESSION_NAME_MAX_LENGTH,
  sessionTitleRequest,
  titleFromPrompt,
  typedText,
} from '../domain/session-name.policy';

/**
 * The fallback title: what a session is called when no model answered in time.
 * It has to read like a title, fit a sidebar row, and never need the network.
 */
describe('titleFromPrompt', () => {
  it('keeps the first six words, capitalised', () => {
    expect(titleFromPrompt('fix the wallet list empty state on mobile and web')).toBe(
      'Fix the wallet list empty state',
    );
  });

  it('starts at the task rather than the pleasantries', () => {
    expect(titleFromPrompt('Hey Claude, can you please add dark mode to settings')).toBe(
      'Add dark mode to settings',
    );
    expect(titleFromPrompt("ok so I'd like you to rename the billing module")).toBe(
      'Rename the billing module',
    );
    expect(titleFromPrompt('I want you to migrate auth to Better Auth')).toBe(
      'Migrate auth to Better Auth',
    );
  });

  it('takes the first sentence of the first line that says something', () => {
    expect(
      titleFromPrompt('\n\n## Bug\nLogin fails on Safari. It started after the last deploy.'),
    ).toBe('Bug');
    expect(titleFromPrompt('Login fails on Safari. It started after the deploy.')).toBe(
      'Login fails on Safari',
    );
  });

  it('skips pasted code and links', () => {
    expect(
      titleFromPrompt(
        '```\nTypeError: x is undefined\n```\nsee https://example.com/x fix this crash',
      ),
    ).toBe('See fix this crash');
  });

  it('never runs past what a sidebar row shows', () => {
    const title = titleFromPrompt(
      'internationalisation localisation containerisation orchestration',
    );
    expect(title?.length).toBeLessThanOrEqual(SESSION_NAME_MAX_LENGTH);
    expect(titleFromPrompt('x'.repeat(100))).toHaveLength(SESSION_NAME_MAX_LENGTH);
  });

  it('keeps a pleasantry when it is all the prompt has', () => {
    expect(titleFromPrompt('hello')).toBe('Hello');
  });

  it('has nothing to say about a prompt with no words', () => {
    expect(titleFromPrompt('   ')).toBeNull();
    expect(titleFromPrompt('```\nconst x = 1;\n```')).toBeNull();
    expect(titleFromPrompt('https://example.com/issue/1')).toBeNull();
  });
});

describe('cleanModelTitle', () => {
  it('drops a list number the model echoed from the numbered conversation', () => {
    expect(cleanModelTitle('1. Caducidad del refresh token')).toBe('Caducidad del refresh token');
    expect(cleanModelTitle('- Invoice CSV export')).toBe('Invoice CSV export');
  });

  it('takes the first line, without quotes or a trailing period', () => {
    expect(cleanModelTitle('"Fix wallet empty state."\nThis title describes…')).toBe(
      'Fix wallet empty state',
    );
    expect(cleanModelTitle('Title: **Dark mode settings**')).toBe('Dark mode settings');
  });

  it('drops a reasoning block rather than naming the session after it', () => {
    expect(cleanModelTitle('<think>\nThe user wants…\n</think>\n\nAdd dark mode')).toBe(
      'Add dark mode',
    );
  });

  it('cuts a long answer at a word boundary', () => {
    const title = cleanModelTitle('Refactor the session relay so it uses the transactional outbox');
    expect(title).toBe('Refactor the session relay so it uses');
    expect(title?.length).toBeLessThanOrEqual(SESSION_NAME_MAX_LENGTH);
  });

  it('reads an empty answer as no title', () => {
    expect(cleanModelTitle('')).toBeNull();
    expect(cleanModelTitle('<think>hmm</think>')).toBeNull();
    expect(cleanModelTitle('""')).toBeNull();
  });
});

describe('sessionTitleRequest', () => {
  it('asks for a short title on a small, deterministic budget', () => {
    const request = sessionTitleRequest('x'.repeat(10_000));
    expect(request.maxTokens).toBe(32);
    expect(request.temperature).toBe(0);
    // Only what is worth sending of a long prompt goes to the model, framed
    // as a request to name rather than one to carry out.
    expect(request.messages[0].content).toBe(`<request>\n${'x'.repeat(2_000)}\n</request>`);
  });
});

/**
 * The instructions are Markdown with slots for the bounds; a model sent a
 * literal `{{maxChars}}` would answer with titles of any length.
 */
describe('title requests', () => {
  it.each([
    ['the first prompt', sessionTitleRequest('fix the bug')],
    ['the conversation', conversationTitleRequest(['fix the bug', 'the wallet one'])],
  ])('tell the model the bounds for %s', (_which, request) => {
    expect(request.system).not.toContain('{{');
    // Asked for shorter than the row's hard cut, so a name that runs long is not cut mid-word.
    expect(request.system).toContain('3 or 4 words, never more than 5, and at most 32 characters');
    expect(32).toBeLessThan(SESSION_NAME_MAX_LENGTH);
  });

  it('numbers the person’s prompts in order and cuts each long one', () => {
    const request = conversationTitleRequest(['fix the bug', 'x'.repeat(2_000)]);
    const content = request.messages[0]?.content ?? '';
    expect(content.startsWith('<request>\n1. fix the bug\n\n2. ')).toBe(true);
    expect(content.length).toBeLessThan(720);
  });
});

/**
 * What the person typed, read the way the runner reads the first prompt that
 * names the session. The cases are one file both suites run, so the two
 * readings cannot drift: a case added there holds the runner too.
 */
describe('typedText', () => {
  const shared = JSON.parse(
    readFileSync(
      join(
        __dirname,
        '../../../../runner/internal/sessions/adapters/transcript/testdata/typed-prompts.json',
      ),
      'utf8',
    ),
  ) as { cases: { case: string; text: string; typed: string }[] };

  it.each(shared.cases.map((each) => [each.case, each.text, each.typed]))(
    '%s',
    (_case, text, typed) => {
      expect(typedText(text)).toBe(typed);
    },
  );
});

describe('promptsOf', () => {
  const part = (
    text: string,
    {
      truncated = false,
      kind = 'text',
    }: { truncated?: boolean; kind?: SessionTranscriptPartKind } = {},
  ) => ({
    kind,
    text,
    tool: null,
    isError: false,
    truncated,
  });
  const user = (...parts: ReturnType<typeof part>[]) => ({
    id: null,
    at: null,
    role: 'user' as const,
    parts,
  });

  // The chat page cuts a block at its bound, so a long reminder arrives
  // without its closing tag; the person's words beside it still count.
  it('reads the words beside a reminder the page cut', () => {
    const cut = part('<system-reminder>\n# CLAUDE.md\n…', { truncated: true });
    expect(promptsOf([user(cut, part('Fix the picker'))])).toEqual(['Fix the picker']);
  });

  it('leaves out a reminder the page cut after the person’s words', () => {
    const cut = part('Fix the wallet bug\n<system-reminder>\n# CLAUDE.md\nrepository context…', {
      truncated: true,
    });
    expect(promptsOf([user(cut)])).toEqual(['Fix the wallet bug']);
  });

  it('keeps a long prompt the page cut behind a whole reminder', () => {
    const cut = part(
      '<system-reminder>Today is Thursday.</system-reminder>\nFix the wallet bug …',
      {
        truncated: true,
      },
    );
    expect(promptsOf([user(cut)])).toEqual(['Fix the wallet bug …']);
  });

  it('counts no message that carries a tool’s result', () => {
    expect(promptsOf([user(part('ok', { kind: 'tool_result' }), part('and the next'))])).toEqual(
      [],
    );
  });
});
