/**
 * Reads a module's prompt files: the Markdown under `domain/prompts/` that
 * holds what a model is told, so the words are edited as prose and the code
 * beside them only decides which are sent.
 *
 * A file is one prompt, or several fragments the code chooses among. A
 * folder, one level deep, says where its words are sent (`system/` for
 * sections of the system prompt, `turn/` for what opens a turn), and is
 * part of the id:
 *
 *   system/rules.md               one prompt, id `system/rules`
 *   system/what-you-can-do.md     with `<!-- fragment: plain-refusal -->`
 *                                 markers: `system/what-you-can-do.plain-refusal`
 *
 * `{{name}}` is a slot the code fills; a prompt's slots become its type. Any
 * other HTML comment is a note for whoever edits the file: it goes above the
 * words it is about (at the top of the file, or right under a marker) and is
 * never sent.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*\.md$/;
const FOLDER_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const MARKER = /<!--\s*fragment:\s*([^>]*?)\s*-->/g;
const FRAGMENT_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const LEADING_NOTE = /^\s*<!--[\s\S]*?-->/;
const SLOT = /\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g;

/** A chunk's words: the notes above them dropped, the blank lines around them cut. */
function wordsOf(chunk, where) {
  let text = chunk;
  while (LEADING_NOTE.test(text)) text = text.replace(LEADING_NOTE, '');
  text = text.replace(/^(?:[ \t]*\n)+/, '').replace(/\s+$/, '');
  if (text.includes('<!--')) {
    throw new Error(`${where}: a note goes above the words it is about, not among them.`);
  }
  return text;
}

function slotsOf(text, where) {
  const slots = [...new Set([...text.matchAll(SLOT)].map((match) => match[1]))];
  if (text.replace(SLOT, '').match(/\{\{|\}\}/)) {
    throw new Error(`${where}: a slot is {{name}}, letters and digits only.`);
  }
  return slots;
}

/** One file's prompts, in the order it writes them; `folder` is the one it sits in, if any. */
export function parsePromptFile(name, source, folder) {
  if (!FILE_NAME.test(name)) {
    throw new Error(`${name}: a prompt file is named in kebab-case and ends in .md.`);
  }
  if (folder !== undefined && !FOLDER_NAME.test(folder)) {
    throw new Error(`${folder}/: a folder of prompt files is named in kebab-case.`);
  }
  const file = `${folder === undefined ? '' : `${folder}/`}${name.replace(/\.md$/, '')}`;
  const text = source.replace(/\r\n/g, '\n');
  const markers = [...text.matchAll(MARKER)];
  if (markers.length === 0) {
    const words = wordsOf(text, name);
    if (!words) throw new Error(`${name}: empty. A prompt file holds words.`);
    return [{ id: file, text: words, slots: slotsOf(words, name) }];
  }
  if (wordsOf(text.slice(0, markers[0].index), name)) {
    throw new Error(`${name}: words above the first fragment belong to no fragment.`);
  }
  return markers.map((marker, index) => {
    const fragment = marker[1];
    const where = `${name}, fragment ${fragment}`;
    if (!FRAGMENT_NAME.test(fragment)) {
      throw new Error(`${where}: a fragment is named in kebab-case.`);
    }
    const end = markers[index + 1]?.index ?? text.length;
    const words = wordsOf(text.slice(marker.index + marker[0].length, end), where);
    if (!words) throw new Error(`${where}: empty.`);
    return { id: `${file}.${fragment}`, text: words, slots: slotsOf(words, where) };
  });
}

/** The Markdown files in `dir`, by name. */
function markdownIn(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort();
}

/**
 * Where each Markdown file under `dir` is and the folder it sits in, if any:
 * the files of `dir` first, then each folder's, by name.
 */
function promptFilesIn(dir) {
  const folders = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return [undefined, ...folders].flatMap((folder) => {
    const at = folder === undefined ? dir : join(dir, folder);
    return markdownIn(at).map((name) => ({ name, folder, path: join(at, name) }));
  });
}

/**
 * Every prompt of the Markdown files in `dir` and in its folders, one level
 * deep: the files of `dir` first, then each folder's, by name, and by order
 * within a file. That order is the generated module's, and nothing else's:
 * the code reads a prompt by id.
 */
export function readPrompts(dir) {
  const prompts = promptFilesIn(dir).flatMap(({ name, folder, path }) =>
    parsePromptFile(name, readFileSync(path, 'utf8'), folder),
  );
  const seen = new Set();
  for (const { id } of prompts) {
    if (seen.has(id)) throw new Error(`${id}: two prompts with one id.`);
    seen.add(id);
  }
  return prompts;
}

const key = (id) => JSON.stringify(id);

/** The module `prompts.gen.ts` holds for these prompts. */
export function renderPromptModule(prompts) {
  const filled = prompts.filter((prompt) => prompt.slots.length > 0);
  return [
    '// Code generated by apps/api/scripts/emit-prompts.mjs from the Markdown beside it;',
    '// DO NOT EDIT. Edit the .md files, then run',
    '// `pnpm --filter @oppenheimer/api generate:prompts`.',
    '',
    '/** Every prompt, by `<file>` or `<file>.<fragment>`, after `<folder>/` when it sits in one. */',
    'export type PromptId =',
    ...prompts.map(
      (prompt, index) => `  | ${key(prompt.id)}${index === prompts.length - 1 ? ';' : ''}`,
    ),
    '',
    '/** The slots of each prompt that has any: what the code fills in. */',
    'export interface PromptSlots {',
    ...filled.map(
      (prompt) =>
        `  ${key(prompt.id)}: { ${prompt.slots.map((slot) => `${slot}: string`).join('; ')} };`,
    ),
    '}',
    '',
    'export const PROMPT_TEXT: Readonly<Record<PromptId, string>> = {',
    ...prompts.map((prompt) => `  ${key(prompt.id)}: ${JSON.stringify(prompt.text)},`),
    '};',
    '',
  ].join('\n');
}
