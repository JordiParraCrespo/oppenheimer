import { describe, expect, it } from 'vitest';
import {
  cleanModelTitle,
  SESSION_NAME_MAX_LENGTH,
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

  it('names the same prompt the same way every time', () => {
    const prompt = 'please refactor the session relay to use the outbox';
    expect(titleFromPrompt(prompt)).toBe(titleFromPrompt(prompt));
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
