/**
 * Reads "Using Oppenheimer", `docs/guide/*.md`, as pages: the one reader the
 * two consumers share, the emitter that bundles the pages for bots
 * (`emit-guide.mjs`) and the build step that publishes them for agents
 * outside Oppenheimer (`llms-txt.mjs`).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GUIDE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'guide');

/** The frontmatter keys every page carries. */
const REQUIRED = ['title', 'description', 'sidebar_position'];

function parsePage(file) {
  const text = readFileSync(join(GUIDE_DIR, file), 'utf8').replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!match) throw new Error(`docs/guide/${file}: no frontmatter between --- lines`);
  const meta = {};
  for (const line of match[1].split('\n')) {
    const pair = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (pair) meta[pair[1]] = pair[2].replace(/^(['"])(.*)\1$/, '$2').trim();
  }
  for (const key of REQUIRED) {
    if (!meta[key]) throw new Error(`docs/guide/${file}: frontmatter has no ${key}`);
  }
  return {
    id: file.replace(/\.md$/, ''),
    title: meta.title,
    description: meta.description,
    position: Number(meta.sidebar_position),
    body: match[2].trim(),
  };
}

/** Every page, in the order the sidebar lists them. */
export function readGuidePages() {
  return readdirSync(GUIDE_DIR)
    .filter((file) => file.endsWith('.md'))
    .map(parsePage)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}
