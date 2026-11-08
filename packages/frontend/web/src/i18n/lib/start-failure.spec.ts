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

describe('failureReason’s detail', () => {
  const readableDetail = (detail: string) =>
    failureReason({ code: null, detail }, () => undefined, 'f')?.detail;

  it('reads a CLI refusal as its words, one line per line, without the terminal’s escapes', () => {
    // What a runner before the fix sent for a host signed out of claude.ai:
    // cursor saves, a character-set choice and the runner's ` · ` between lines.
    expect(
      readableDetail(
        '\x1b7\x1b8Error:\x1b[1CCloud\x1b[1Csessions\x1b[1Cneed\x1b[1Ca\x1b[1Cclaude.ai\x1b[1Csign-in. · Run `claude auth login`, then try again. · \x1b(B\x1b7\x1b8\x1b(B\x1b7\x1b8',
      ),
    ).toBe(
      'Error: Cloud sessions need a claude.ai sign-in.\nRun `claude auth login`, then try again.',
    );
  });

  it('keeps a plain detail as it is, and has nothing to show for escapes alone', () => {
    expect(readableDetail('clone refused')).toBe('clone refused');
    expect(readableDetail('\x1b(B\x1b7\x1b8\r\n')).toBeNull();
  });

  it('reads a raw transcript and the runner’s cleaned lastWords of it alike', () => {
    // A return, cursor moves, a title and the echoed end of input; the second
    // string is what cloud.go's lastWords gives for the first. Old runners sent
    // the raw kind, current ones the cleaned: a drift from clean() breaks this.
    const raw = '^D\x1b[2Cstarting\rfailed:\x1b[3Cexit 1\r\n\x1b]0;claude\x07done';
    const cleaned = 'starting · failed:   exit 1 · done';
    expect(readableDetail(raw)).toBe('starting\nfailed:   exit 1\ndone');
    expect(readableDetail(cleaned)).toBe(readableDetail(raw));
  });
});
