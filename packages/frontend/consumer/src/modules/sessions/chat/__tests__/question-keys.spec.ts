import { describe, expect, it } from 'vitest';
import { questionKeys } from '../question-keys';
import type { ChatQuestion } from '../session-chat';

/**
 * The keys that answer Claude Code's question picker. Each case is one that
 * was played into Claude Code 2.1 in tmux and answered what it says here; a
 * change that breaks one sends the person's answer to the wrong option, or
 * leaves the agent waiting on a picker nobody sees.
 */
const DOWN = '\u001b[B';

const scope: ChatQuestion = {
  header: 'Scope',
  question: 'What should the design system cover?',
  multiSelect: false,
  options: [
    { label: 'Tokens only', description: null },
    { label: 'Tokens and components', description: null },
    { label: 'Everything', description: null },
  ],
};
const platforms: ChatQuestion = {
  header: 'Platforms',
  question: 'Which platforms should it target?',
  multiSelect: true,
  options: [
    { label: 'Web', description: null },
    { label: 'iOS', description: null },
    { label: 'Android', description: null },
  ],
};

describe('questionKeys', () => {
  it('answers a lone choice with its number, which sends it', () => {
    expect(questionKeys([scope], [{ picks: [2], other: null }])).toEqual(['3']);
  });

  it('answers a lone choice in words on the row after the options', () => {
    expect(questionKeys([scope], [{ picks: [], other: 'Only icons' }])).toEqual([
      '4',
      'Only icons',
      '\r',
    ]);
  });

  it('ticks several, walks to the question’s Submit and sends the review', () => {
    expect(questionKeys([platforms], [{ picks: [0, 2], other: null }])).toEqual([
      '1',
      '3',
      DOWN,
      DOWN,
      DOWN,
      DOWN,
      '\r',
      '1',
    ]);
  });

  it('types an own answer beside the picks on its row, then leaves it for Submit', () => {
    expect(questionKeys([platforms], [{ picks: [1], other: 'Linux\nand BSD' }])).toEqual([
      '2',
      DOWN,
      DOWN,
      DOWN,
      'Linux and BSD',
      DOWN,
      '\r',
      '1',
    ]);
  });

  it('answers each tab in turn, then submits the review', () => {
    expect(
      questionKeys(
        [scope, platforms],
        [
          { picks: [1], other: null },
          { picks: [0], other: null },
        ],
      ),
    ).toEqual(['2', '1', DOWN, DOWN, DOWN, DOWN, '\r', '1']);
  });
});
