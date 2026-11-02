import { describe, expect, it } from 'vitest';
import { formatApprovalInput } from '../lib/approval-input';

/**
 * The approval card shows what a bot wants to run before anyone says yes, so
 * the call's input reads whole where it is short and visibly cut where it is
 * not: a value that silently ended, or a seventh field dropped with no mark,
 * would let someone approve a call they did not see.
 */
describe('formatApprovalInput', () => {
  it('writes one key: value line per field, strings as written, the rest as JSON', () => {
    expect(
      formatApprovalInput({
        repository: 'acme/xrp-mobile',
        prompt: 'Fix the flaky sign-in test',
        draft: false,
        labels: ['ci', 'flaky'],
        options: { squash: true },
        count: 3,
      }),
    ).toBe(
      [
        'repository: acme/xrp-mobile',
        'prompt: Fix the flaky sign-in test',
        'draft: false',
        'labels: ["ci","flaky"]',
        'options: {"squash":true}',
        'count: 3',
      ].join('\n'),
    );
  });

  it('cuts a long value at 200 characters with an ellipsis', () => {
    const line = formatApprovalInput({ prompt: 'x'.repeat(500) });
    expect(line).toBe(`prompt: ${'x'.repeat(199)}…`);
  });

  it('shows six fields and marks the rest as cut', () => {
    const input = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`f${i}`, i]));
    expect(formatApprovalInput(input).split('\n')).toEqual([
      'f0: 0',
      'f1: 1',
      'f2: 2',
      'f3: 3',
      'f4: 4',
      'f5: 5',
      '…',
    ]);
  });

  it('is empty for a call that takes no input', () => {
    expect(formatApprovalInput({})).toBe('');
  });

  it('writes null and a missing value rather than dropping the field', () => {
    expect(formatApprovalInput({ branch: null, base: undefined })).toBe(
      'branch: null\nbase: undefined',
    );
  });
});
