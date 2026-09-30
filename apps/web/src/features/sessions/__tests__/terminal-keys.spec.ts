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

const none = { hasSelection: false, agentWindow: true, mac: false };
const selected = { hasSelection: true, agentWindow: true, mac: false };
const shell = { hasSelection: false, agentWindow: false, mac: false };
const mac = { hasSelection: false, agentWindow: true, mac: true };

describe('classifyKey', () => {
  it('turns Shift+Enter into a newline in the prompt, not a submit', () => {
    expect(classifyKey(chord('Enter', { shiftKey: true }), none)).toEqual({
      kind: 'send',
      data: '\n',
    });
  });

  it('leaves Shift+Enter alone in a shell window', () => {
    expect(classifyKey(chord('Enter', { shiftKey: true }), shell)).toEqual({ kind: 'terminal' });
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

  it('copies on Ctrl+Shift+C off the Mac, rather than opening the inspector', () => {
    expect(classifyKey(chord('C', { ctrlKey: true, shiftKey: true }), selected)).toEqual({
      kind: 'copy',
    });
    expect(classifyKey(chord('C', { ctrlKey: true, shiftKey: true }), none)).toEqual({
      kind: 'copy',
    });
  });

  it('leaves Ctrl+Shift+C to the program on the Mac', () => {
    expect(classifyKey(chord('C', { ctrlKey: true, shiftKey: true }), mac)).toEqual({
      kind: 'terminal',
    });
  });

  it('edits the line with the Mac command chords', () => {
    expect(classifyKey(chord('ArrowLeft', { metaKey: true }), mac)).toEqual({
      kind: 'send',
      data: '\x01',
    });
    expect(classifyKey(chord('ArrowRight', { metaKey: true }), mac)).toEqual({
      kind: 'send',
      data: '\x05',
    });
    expect(classifyKey(chord('Backspace', { metaKey: true }), mac)).toEqual({
      kind: 'send',
      data: '\x15',
    });
  });

  it('moves by word with Option and the arrows on the Mac', () => {
    expect(classifyKey(chord('ArrowLeft', { altKey: true }), mac)).toEqual({
      kind: 'send',
      data: '\x1bb',
    });
    expect(classifyKey(chord('ArrowRight', { altKey: true }), mac)).toEqual({
      kind: 'send',
      data: '\x1bf',
    });
  });

  it('keeps the later phases of a Mac chord away from xterm', () => {
    for (const type of ['keypress', 'keyup']) {
      expect(classifyKey(chord('ArrowLeft', { type, metaKey: true }), mac)).toEqual({
        kind: 'browser',
      });
      expect(classifyKey(chord('ArrowLeft', { type, altKey: true }), mac)).toEqual({
        kind: 'browser',
      });
    }
  });

  it("leaves Cmd+C to the browser's copy on the Mac", () => {
    expect(classifyKey(chord('c', { metaKey: true }), { ...mac, hasSelection: true })).toEqual({
      kind: 'terminal',
    });
  });

  it('keeps the Mac chords to the Mac', () => {
    expect(classifyKey(chord('ArrowLeft', { altKey: true }), none)).toEqual({ kind: 'terminal' });
    expect(classifyKey(chord('ArrowLeft', { metaKey: true }), none)).toEqual({ kind: 'terminal' });
    expect(classifyKey(chord('ArrowLeft', { metaKey: true, shiftKey: true }), mac)).toEqual({
      kind: 'terminal',
    });
  });
});
