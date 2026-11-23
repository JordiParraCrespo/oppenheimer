// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFeedbackDraft } from '../feedback-draft';

const RULE = '─'.repeat(80);
const ESC = '\u001b';

/** Claude Code's foot with its drafted-feedback card over the input box, `card` its rows. */
function screen(card: string[], prompt = '❯ '): string[] {
  return [
    '  Still unknown: the mainnet validator count.',
    '',
    ...card,
    '',
    RULE,
    prompt,
    RULE,
    '  ⏵⏵ bypass permissions on (shift+tab to cycle) · 1 feedback …',
  ];
}

const HEAD = '✻ Bug report drafted: Took write actions after user said "View only"';
const PREVIEW = [
  '│ - What happened: The user said "View only" mid-turn. Later they asked to',
  '│   "create this new version" and then get an explanation.',
];

describe('readFeedbackDraft', () => {
  // What breaks this: the card read as nothing, so the chat never offers the
  // keys and the draft can only be answered from the terminal.
  it('reads the draft and the keys its card takes, so the chat can answer it', () => {
    expect(
      readFeedbackDraft(screen([HEAD, ...PREVIEW, '1 to review · 2 to send · 0 to dismiss'])),
    ).toEqual({
      kind: 'Bug report',
      title: 'Took write actions after user said "View only"',
      details: [
        '- What happened: The user said "View only" mid-turn. Later they asked to',
        '"create this new version" and then get an explanation.',
      ],
      note: null,
      actions: [
        { action: 'review', kind: 'review', key: '1', opensTerminal: true },
        { action: 'send', kind: 'send', key: '2', opensTerminal: false },
        { action: 'dismiss', kind: 'dismiss', key: '0', opensTerminal: false },
      ],
      promptHoldsText: false,
      more: 0,
    });
  });

  it('reads the question a send asks first, with Escape as the way back', () => {
    const draft = readFeedbackDraft(
      screen([
        HEAD,
        ...PREVIEW,
        'Send without reviewing (full draft + env, no transcript)? 2 to send · Esc to back',
      ]),
    );
    expect(draft?.note).toBe('Send without reviewing (full draft + env, no transcript)?');
    expect(draft?.actions).toEqual([
      { action: 'send', kind: 'send', key: '2', opensTerminal: false },
      { action: 'back', kind: 'back', key: ESC, opensTerminal: false },
    ]);
  });

  // What breaks this: a pane narrower than the line wraps it, its last row
  // alone names no key, and the card leaves the chat just as it asks.
  it('reads a line of keys the pane wrapped onto several rows', () => {
    const confirm = readFeedbackDraft(
      screen([
        HEAD,
        ...PREVIEW,
        'Send without reviewing (full draft + env, no transcript)? 2 to send · Esc to',
        'back',
      ]),
    );
    expect(confirm?.note).toBe('Send without reviewing (full draft + env, no transcript)?');
    expect(confirm?.actions.map((action) => action.action)).toEqual(['send', 'back']);
    expect(confirm?.details).toHaveLength(2);

    const keys = readFeedbackDraft(
      screen([HEAD, ...PREVIEW, '1 to review · 2 to send ·', '0 to dismiss']),
    );
    expect(keys?.actions.map((action) => action.key)).toEqual(['1', '2', '0']);
    expect(keys?.details).toHaveLength(2);
  });

  // What breaks this: a row of the report that reads like a key taken into
  // the line of keys, a pill labelled with report text typing its digit.
  it('keeps a row of the report that reads like a key in the report', () => {
    for (const row of [
      '│   3 to 5 times, then failed.',
      '│   Enter to send; nothing happens.',
      '│ ✓ unit suite passed',
    ]) {
      const draft = readFeedbackDraft(
        screen([HEAD, PREVIEW[0] ?? '', row, '1 to review · 2 to send · 0 to dismiss']),
      );
      expect(draft?.actions.map((action) => action.action)).toEqual(['review', 'send', 'dismiss']);
      expect(draft?.details).toHaveLength(2);
      expect(draft?.note).toBeNull();
    }
  });

  it('reads a wrapped failure whole', () => {
    const draft = readFeedbackDraft(
      screen([HEAD, "✗ Couldn't send feedback. 1 to review &", 'retry · Esc to dismiss']),
    );
    expect(draft?.note).toBe("Couldn't send feedback.");
    expect(draft?.actions.map((action) => action.action)).toEqual(['review & retry', 'dismiss']);
  });

  it('reads where a send stands and how many drafts wait behind this one', () => {
    expect(readFeedbackDraft(screen([HEAD, 'Sending…']))?.note).toBe('Sending…');
    expect(readFeedbackDraft(screen([HEAD, '✓ Sent']))?.note).toBe('Sent');
    expect(
      readFeedbackDraft(screen([HEAD, '1 to review · 2 to send · 0 to dismiss · +2 more queued']))
        ?.more,
    ).toBe(2);
  });

  // What breaks this: an error whose words hold " to " read as a key, and the
  // retry the card offers lost with it.
  it('keeps an error as its note and still reads the keys after it', () => {
    const draft = readFeedbackDraft(
      screen([HEAD, '✗ Failed to reach the server. 1 to review & retry · Esc to dismiss']),
    );
    expect(draft?.note).toBe('Failed to reach the server.');
    expect(draft?.actions).toEqual([
      { action: 'review & retry', kind: 'retry', key: '1', opensTerminal: true },
      { action: 'dismiss', kind: 'dismiss', key: ESC, opensTerminal: false },
    ]);
  });

  it('reads the question a dismiss asks, which has no draft over it', () => {
    expect(
      readFeedbackDraft(screen(['Turn off Claude-drafted feedback? 0 to turn off · Esc to keep'])),
    ).toMatchObject({
      kind: null,
      note: 'Turn off Claude-drafted feedback?',
      actions: [
        { action: 'turn off', kind: 'turnOff', key: '0', opensTerminal: false },
        { action: 'keep', kind: 'keep', key: ESC, opensTerminal: false },
      ],
    });
  });

  it('reads the question a dismiss asks when a narrow pane wraps it', () => {
    expect(
      readFeedbackDraft(
        screen(['Turn off Claude-drafted feedback? 0 to turn off ·', 'Esc to keep']),
      ),
    ).toMatchObject({
      note: 'Turn off Claude-drafted feedback?',
      actions: [
        { action: 'turn off', kind: 'turnOff', key: '0', opensTerminal: false },
        { action: 'keep', kind: 'keep', key: ESC, opensTerminal: false },
      ],
    });
  });

  // What breaks this: a digit typed from the chat while the terminal's prompt
  // holds text lands in that text instead of answering the card.
  it('offers no key while the terminal prompt holds text, and says so', () => {
    const draft = readFeedbackDraft(
      screen([HEAD, ...PREVIEW, 'clear text to review, send, or dismiss'], '❯ /fee'),
    );
    expect(draft?.actions).toEqual([]);
    expect(draft?.promptHoldsText).toBe(true);
  });

  // What breaks this: a reply that quotes the card taken for one, with keys
  // that would type into the prompt.
  it('never takes a card the input box does not follow', () => {
    const rows = screen(['  The card said:']);
    rows.splice(1, 0, HEAD, '1 to review · 2 to send · 0 to dismiss', '  and more text.');
    expect(readFeedbackDraft(rows)).toBeNull();
    expect(readFeedbackDraft(screen(['  All done.']))).toBeNull();
  });
});
