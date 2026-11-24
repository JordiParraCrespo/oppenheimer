import { describe, expect, it } from 'vitest';
import {
  type KeyedPermission,
  type PermissionOption,
  permissionChoiceKeys,
  permissionPromptOf,
} from '../permission-keys.js';

/**
 * The keys that answer each agent's permission dialog. Claude Code's were
 * played into Claude Code 2.1.331 in tmux and did what each case says
 * (`1` ran the command, Down ×3, Tab, the words and Enter refused it with
 * them and the agent tried again as told); Codex's are its TUI's default
 * approval keymap in 0.172.0. A change that breaks one allows what the
 * person refused, or leaves the agent waiting on a dialog nobody sees.
 */

const DOWN = '\u001b[B';
const UP = '\u001b[A';

const option = (index: number, label: string, key: string | null = null): PermissionOption => ({
  label,
  kind: null,
  index,
  key,
});

const claudeBash: KeyedPermission = {
  options: [
    option(0, 'Yes'),
    option(1, "Yes, and don't ask again for mkdir commands in /home/runner/trial"),
    option(2, 'Yes, and switch to auto mode'),
    option(3, 'No'),
  ],
  cursor: 0,
  amendKey: '\t',
};

describe('permissionChoiceKeys', () => {
  it("picks Claude Code's options by their number, which sends them at once", () => {
    expect(permissionChoiceKeys(claudeBash, 0)).toEqual(['1']);
    expect(permissionChoiceKeys(claudeBash, 1)).toEqual(['2']);
    expect(permissionChoiceKeys(claudeBash, 3)).toEqual(['4']);
  });

  it('moves to the option from the cursor, opens its field and types the note on one line', () => {
    expect(permissionChoiceKeys(claudeBash, 3, 'use a folder\nnamed later')).toEqual([
      DOWN,
      DOWN,
      DOWN,
      '\t',
      'use a folder named later',
      '\r',
    ]);
    expect(permissionChoiceKeys({ ...claudeBash, cursor: 3 }, 0, 'and then run the tests')).toEqual(
      [UP, UP, UP, '\t', 'and then run the tests', '\r'],
    );
  });

  // What breaks this: Tab and the words typed into a dialog that has no
  // field, where Tab moves on and the words pick nothing or the wrong option.
  it('picks the option alone where the dialog takes no note, and for a note of only spaces', () => {
    const fetch: KeyedPermission = { ...claudeBash, amendKey: null };
    expect(permissionChoiceKeys(fetch, 3, 'read the cache instead')).toEqual(['4']);
    expect(permissionChoiceKeys(claudeBash, 3, '   ')).toEqual(['4']);
  });

  it("types Codex's letter for an option bound to one", () => {
    const codex: KeyedPermission = {
      options: [
        option(0, 'Yes, proceed', 'y'),
        option(1, "Yes, and don't ask again for this command in this session", 'a'),
        option(2, 'No, and tell Codex what to do differently', 'n'),
      ],
      cursor: 0,
      amendKey: null,
    };
    expect(permissionChoiceKeys(codex, 0)).toEqual(['y']);
    expect(permissionChoiceKeys(codex, 1)).toEqual(['a']);
    expect(permissionChoiceKeys(codex, 2)).toEqual(['n']);
  });

  it('types nothing for an option the dialog does not have', () => {
    expect(permissionChoiceKeys(claudeBash, 7)).toEqual([]);
  });
});

describe('permissionPromptOf', () => {
  // What breaks this: a card drawn for an agent whose dialog the console
  // cannot read, typing Claude Code's keys into another CLI.
  it('knows the dialogs of Claude Code and Codex, and of no other agent', () => {
    expect(permissionPromptOf('claude-code')?.amend?.key).toBe('\t');
    expect(permissionPromptOf('codex')?.choices.map((choice) => choice.key)).toEqual([
      'y',
      'p',
      'p',
      'a',
      'd',
      'n',
    ]);
    expect(permissionPromptOf('opencode')).toBeUndefined();
    expect(permissionPromptOf('toString')).toBeUndefined();
  });
});
