import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BOT_TOOL_GROUPS } from '@oppenheimer/shared';
import { BOT_CAPABILITIES } from '../domain/bot-capability.policy';

/**
 * The capability list is the one place the prompt's core learns what a bot
 * can do (2026-11-23): each capability is a folder of prompts and a row.
 * What breaks this: a new tool group no capability lists, whose tools the
 * prompt would file under "Other"; a capability whose words are not in its
 * own folder; or a prompt folder that belongs to no capability and to the
 * core neither, so nobody knows who sends it.
 */
describe('BOT_CAPABILITIES', () => {
  const prompts = join(__dirname, '..', 'domain', 'prompts');
  const folders = readdirSync(prompts, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  /** The bot itself, not a capability: who it is, its memory, skills and goals. */
  const CORE = ['core', 'memory', 'skills', 'goals'];

  it('lists every tool group but the bot’s own under exactly one capability', () => {
    const listed = BOT_CAPABILITIES.flatMap((capability) =>
      capability.lists ? [capability.lists.group] : [],
    );
    expect([...listed].sort()).toEqual(BOT_TOOL_GROUPS.filter((group) => group !== 'self').sort());
  });

  it('keeps each capability’s words in a folder of its own, and every folder is one or the core', () => {
    const names = BOT_CAPABILITIES.map((capability) => capability.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(folders).toContain(name);
    expect(folders.filter((folder) => !names.includes(folder)).sort()).toEqual([...CORE].sort());
  });

  it('reads every phrase of a capability from its own folder', () => {
    for (const capability of BOT_CAPABILITIES) {
      for (const intro of capability.intros) {
        for (const id of [intro.does, intro.connects, intro.example].filter(Boolean)) {
          expect(id?.startsWith(`${capability.name}/`)).toBe(true);
        }
      }
    }
  });
});
