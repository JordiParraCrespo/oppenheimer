import { describe, expect, it } from 'vitest';
import type { SessionTranscriptPage } from '../lib/api-types';
import { describeTranscript, printable } from '../lib/output';

/**
 * What `opp sessions transcript` prints of a page: the conversation, how
 * complete it is and how to read on; and never a byte that drives the
 * reader's terminal, since every word of it is the agent's or its tools'.
 */

const page = (over: Partial<SessionTranscriptPage> = {}): SessionTranscriptPage => ({
  status: 'complete',
  reason: null,
  detail: null,
  vendorUrl: null,
  entries: [],
  nextCursor: null,
  atEnd: true,
  restarted: false,
  dropped: 0,
  redactions: 0,
  ...over,
});

describe('describeTranscript', () => {
  // The regression: a tool result carrying `\e]0;…\a` or a clear-screen
  // sequence rewriting the reader's terminal when they read a transcript.
  it('strips escape and control sequences from the agent’s words, keeping newlines', () => {
    expect(printable('ok\u001b[2J\u001b]0;pwned\u0007\nnext\tcol')).toBe(
      'ok[2J]0;pwned\nnext\tcol',
    );
    const out = describeTranscript(
      's-1',
      page({
        entries: [
          {
            id: 'a',
            at: null,
            role: 'assistant',
            parts: [
              { kind: 'text', text: 'hi\u001b[31m', tool: null, isError: false, truncated: false },
            ],
          },
        ],
      }),
    );
    expect(out).not.toContain('\u001b[31m');
  });

  it('says where a cloud session’s conversation is instead of printing an empty page', () => {
    const out = describeTranscript(
      's-1',
      page({
        status: 'unsupported',
        reason: 'cloud_vendor',
        vendorUrl: 'https://claude.ai/code/x',
      }),
    );
    expect(out).toContain('vendor’s cloud');
    expect(out).toContain('https://claude.ai/code/x');
  });

  it('prints the command that reads on, and says when the page is partial', () => {
    const out = describeTranscript(
      's-1',
      page({ status: 'partial', dropped: 2, atEnd: false, nextCursor: 'abc' }),
    );
    expect(out).toContain('opp sessions transcript s-1 --cursor abc');
    expect(out).toContain('2 entries left out');
  });
});
