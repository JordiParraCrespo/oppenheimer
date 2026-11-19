import { describe, expect, it } from 'vitest';
import {
  cleanModelTitle,
  conversationTitleRequest,
  SESSION_NAME_MAX_LENGTH,
  sessionTitleRequest,
  titleFromPrompt,
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
    expect(request.system).toContain(`At most ${SESSION_NAME_MAX_LENGTH} characters`);
    // Only what is worth sending of a long prompt goes to the model.
    expect(request.messages[0].content).toHaveLength(2_000);
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
    expect(request.system).toContain(`At most ${SESSION_NAME_MAX_LENGTH} characters`);
    expect(request.system).toContain('at most 6 words');
  });

  it('numbers the person’s prompts in order and cuts each long one', () => {
    const request = conversationTitleRequest(['fix the bug', 'x'.repeat(2_000)]);
    const content = request.messages[0]?.content ?? '';
    expect(content.startsWith('1. fix the bug\n\n2. ')).toBe(true);
    expect(content.length).toBeLessThan(700);
  });
});
