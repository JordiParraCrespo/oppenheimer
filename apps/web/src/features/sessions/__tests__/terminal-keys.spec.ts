import { describe, expect, it } from 'vitest';
import { classifyKey, type KeyChord } from '../lib/terminal-keys';

function chord(key: string, mods: Partial<KeyChord> = {}): KeyChord {
  return {
    type: 'keydown',
    key,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    ...mods,
  };
}

const none = { hasSelection: false };
const selected = { hasSelection: true };

describe('classifyKey', () => {
  it('turns Shift+Enter into a newline in the prompt, not a submit', () => {
    expect(classifyKey(chord('Enter', { shiftKey: true }), none)).toEqual({
      kind: 'send',
      data: '\n',
    });
  });

  it('keeps the keypress after Shift+Enter away from xterm too', () => {
    expect(classifyKey(chord('Enter', { type: 'keypress', shiftKey: true }), none)).toEqual({
      kind: 'browser',
    });
  });

  it('leaves plain Enter and Alt+Enter to the terminal', () => {
    expect(classifyKey(chord('Enter'), none)).toEqual({ kind: 'terminal' });
    expect(classifyKey(chord('Enter', { altKey: true }), none)).toEqual({ kind: 'terminal' });
  });

  it('copies on Ctrl+C when something is selected, and interrupts otherwise', () => {
    expect(classifyKey(chord('c', { ctrlKey: true }), selected)).toEqual({ kind: 'browser' });
    expect(classifyKey(chord('c', { ctrlKey: true }), none)).toEqual({ kind: 'terminal' });
  });

  it('pastes on Ctrl+Shift+V', () => {
    expect(classifyKey(chord('V', { ctrlKey: true, shiftKey: true }), none)).toEqual({
      kind: 'browser',
    });
  });

  it('leaves ordinary typing alone', () => {
    expect(classifyKey(chord('a'), selected)).toEqual({ kind: 'terminal' });
    expect(classifyKey(chord('v', { ctrlKey: true }), none)).toEqual({ kind: 'terminal' });
  });
});
