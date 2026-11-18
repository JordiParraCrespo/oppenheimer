// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { patchOfEdits } from '../lib/file-patch';

/**
 * The diff the chat's file viewer draws from a turn's edits. What breaks
 * it: hunks whose line ranges overlap or miscount, which the diff library
 * refuses or draws as one garbled hunk.
 */
describe('patchOfEdits', () => {
  it('reads a written file as one hunk of additions from line 1', () => {
    expect(patchOfEdits('/tmp/notes.md', [{ before: '', after: '# Notes\n\nOne\n' }])).toBe(
      [
        'diff --git a/tmp/notes.md b/tmp/notes.md',
        '--- a/tmp/notes.md',
        '+++ b/tmp/notes.md',
        '@@ -0,0 +1,3 @@',
        '+# Notes',
        '+',
        '+One',
        '',
      ].join('\n'),
    );
  });

  it('numbers each edit after the one before it, on both sides', () => {
    const patch = patchOfEdits('a.ts', [
      { before: 'a\nb', after: 'a\nb\nc' },
      { before: 'x', after: '' },
      { before: '', after: 'y' },
    ]);
    expect(patch.split('\n').filter((line) => line.startsWith('@@'))).toEqual([
      '@@ -1,2 +1,3 @@',
      '@@ -3,1 +3,0 @@',
      '@@ -3,0 +4,1 @@',
    ]);
  });

  it('is empty when the edits carry no text', () => {
    expect(patchOfEdits('a.ts', [{ before: '', after: '' }])).toBe('');
  });
});
