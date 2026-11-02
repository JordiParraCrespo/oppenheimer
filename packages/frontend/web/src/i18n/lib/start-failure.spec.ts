import { describe, expect, it } from 'vitest';
import { failureReason } from './start-failure';

describe('failureReason', () => {
  const translateCode = (code: string) =>
    code === 'GIT_004' ? 'Git refused the token' : undefined;
  const fallback = 'the caller’s fallback';

  it('says a code it knows in the reader’s words, with the host’s detail beside it', () => {
    expect(
      failureReason({ code: 'GIT_004', detail: 'auth failed' }, translateCode, fallback),
    ).toEqual({ reason: 'Git refused the token', detail: 'auth failed', help: null });
  });

  it('never makes the host’s English the reason, only its detail', () => {
    expect(
      failureReason({ code: 'RUNNER_012', detail: 'clone refused' }, translateCode, fallback),
    ).toEqual({ reason: fallback, detail: 'clone refused', help: null });
    expect(failureReason({ code: null, detail: 'boom' }, translateCode, fallback)?.reason).toBe(
      fallback,
    );
    expect(failureReason(null, translateCode, fallback)).toBeNull();
  });

  it('attaches a help note only to a code that has a page and words for it', () => {
    const describeHelp = (code: string) =>
      code === 'SESS_010'
        ? { body: 'Not reachable by the CLI.', link: 'Open settings' }
        : undefined;
    expect(
      failureReason({ code: 'SESS_010', detail: 'x' }, translateCode, fallback, describeHelp)?.help,
    ).toEqual({
      body: 'Not reachable by the CLI.',
      link: 'Open settings',
      href: 'https://chatgpt.com/settings/codex-cloud',
    });
    // Words with no page, a page with no words, and no code at all: no note.
    expect(
      failureReason({ code: 'GIT_004', detail: 'x' }, translateCode, fallback, () => ({
        body: 'b',
        link: 'l',
      }))?.help,
    ).toBeNull();
    expect(
      failureReason({ code: 'SESS_010', detail: 'x' }, translateCode, fallback)?.help,
    ).toBeNull();
    expect(
      failureReason({ code: null, detail: 'x' }, translateCode, fallback, describeHelp)?.help,
    ).toBeNull();
  });
});
