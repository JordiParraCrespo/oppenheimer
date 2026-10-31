import type { ChatToolCall } from '@oppenheimer/frontend-consumer';

/**
 * Which calls only look around, and what they looked at, so a run of them
 * folds into one "Explored" group that names its targets ("Read a.ts, b.ts ·
 * Searched foo · Listed src"), the way Codex folds its exploring calls
 * (`exec_cell/model.rs`). A call is exploring when it reads a file, lists
 * one or searches: `Read`, `NotebookRead`, `Grep`, `Glob`, `LS`, or a
 * `Bash` command that does only that (`ls`, `cat`, `rg`, `sed -n`, `find`
 * without an action), whose output may go through a filter (`| head`). Any
 * other call ends the run.
 */

/** What an exploring call did. */
export type ExploreVerb = 'read' | 'search' | 'list';

export interface ExploreTarget {
  verb: ExploreVerb;
  /** A path for a read or a list, a pattern for a search; empty when the call named none. */
  target: string;
}

/** What an exploring call looked at, in order; none for a call that does more than look. */
function exploreOf(call: ChatToolCall): ExploreTarget[] | null {
  switch (call.kind) {
    case 'read':
      return [{ verb: 'read', target: call.target ?? '' }];
    case 'search':
      return [{ verb: call.name === 'Grep' ? 'search' : 'list', target: call.target ?? '' }];
    case 'command':
      return call.name === 'Bash' && call.target ? exploringCommand(call.target) : null;
    default:
      return null;
  }
}

export function isExploring(call: ChatToolCall): boolean {
  return exploreOf(call) !== null;
}

/** One verb of a run's summary and its targets, a file read twice named once. */
export interface ExploredPart {
  verb: ExploreVerb;
  targets: string[];
}

/**
 * What a run of exploring calls looked at, by verb in the order each verb
 * first came, each target once: a file read twice (or by `Read` then `cat`)
 * is one name, and a read is named by its file, not its folder.
 */
export function exploredParts(calls: readonly ChatToolCall[]): ExploredPart[] {
  const parts = new Map<ExploreVerb, Map<string, string>>();
  for (const call of calls) {
    for (const { verb, target } of exploreOf(call) ?? []) {
      if (!target) continue;
      const seen = parts.get(verb) ?? new Map<string, string>();
      const key = verb === 'read' ? target.replace(/^\.\//, '') : target;
      if (!seen.has(key)) seen.set(key, verb === 'read' ? fileName(target) : target);
      parts.set(verb, seen);
    }
  }
  return [...parts].map(([verb, targets]) => ({ verb, targets: [...targets.values()] }));
}

/** A path's last part, the file's name. */
function fileName(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed.slice(trimmed.lastIndexOf('/') + 1);
}

const READERS = new Set(['cat', 'head', 'tail', 'less', 'more', 'nl', 'bat']);
const LISTERS = new Set(['ls', 'find', 'tree', 'fd', 'eza']);
const SEARCHERS = new Set(['rg', 'grep', 'egrep', 'fgrep', 'ag', 'ack']);
/** What may take an exploring command's output without changing anything. */
const FILTERS = new Set(['head', 'tail', 'wc', 'sort', 'uniq', 'cut', 'tr', 'nl', 'column', 'cat']);
/** `find` flags that act on what it finds. */
const FIND_ACTIONS = /^-(exec|execdir|ok|okdir|delete|fprint|fprint0|fprintf|fls)$/;
/** Flags that take the next word as their value, so it is neither a pattern nor a path. */
const VALUE_FLAGS: Record<string, Set<string>> = {
  head: new Set(['-n', '-c']),
  tail: new Set(['-n', '-c']),
  rg: new Set(['-g', '--glob', '-t', '--type', '-T', '-A', '-B', '-C', '-m', '-M', '--max-count']),
  grep: new Set(['-A', '-B', '-C', '-m', '--include', '--exclude']),
  find: new Set(),
};

/** A command's stages, each its words, or none when it writes, substitutes or cannot be read. */
function statementsOf(command: string): string[][][] | null {
  const cleaned = command.replace(/\s2>\s*\/dev\/null/g, ' ').replace(/\s2>&1/g, ' ');
  if (/[<>`]|\$\(/.test(cleaned)) return null;
  const words = tokens(cleaned);
  if (!words) return null;
  const statements: string[][][] = [[[]]];
  for (const word of words) {
    const statement = statements.at(-1) as string[][];
    if (word === '&&' || word === ';' || word === '||') statements.push([[]]);
    else if (word === '|') statement.push([]);
    else statement.at(-1)?.push(word);
  }
  return statements;
}

/** A command line's words, quotes taken off; operators as words of their own. None when a quote is left open. */
function tokens(command: string): string[] | null {
  const words: string[] = [];
  let word = '';
  let quote: string | null = null;
  let started = false;
  const flush = () => {
    if (started) words.push(word);
    word = '';
    started = false;
  };
  for (let i = 0; i < command.length; i += 1) {
    const char = command.charAt(i);
    if (quote) {
      if (char === quote) quote = null;
      else word += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      flush();
    } else if (char === '&' && command.charAt(i + 1) === '&') {
      flush();
      words.push('&&');
      i += 1;
    } else if (char === '|' && command.charAt(i + 1) === '|') {
      flush();
      words.push('||');
      i += 1;
    } else if (char === '|' || char === ';') {
      flush();
      words.push(char);
    } else if (char === '&') {
      return null;
    } else {
      word += char;
      started = true;
    }
  }
  if (quote) return null;
  flush();
  return words;
}

/** The words after a program that are not flags, nor the values of flags that take one. */
function operands(program: string, args: readonly string[]): string[] {
  const valued = VALUE_FLAGS[program] ?? new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;
    if (arg === '--') {
      out.push(...args.slice(i + 1));
      break;
    }
    if (arg.startsWith('-')) {
      if (valued.has(arg)) i += 1;
      continue;
    }
    out.push(arg);
  }
  return out;
}

/** `sed` that only prints (`sed -n '1,80p' file`): the files it reads, or none when it may write. */
function sedReads(args: readonly string[]): string[] | null {
  if (!args.includes('-n') || args.some((arg) => arg === '-i' || arg.startsWith('-i'))) return null;
  const [, ...files] = args.filter((arg) => !arg.startsWith('-'));
  return files;
}

/** One stage's program, taken by its name (`/usr/bin/rg` is `rg`), with `git grep` as `grep`. */
function programOf(stage: readonly string[]): { program: string; args: string[] } | null {
  const [first, ...args] = stage;
  if (!first) return null;
  const program = first.slice(first.lastIndexOf('/') + 1);
  if (program === 'git' && args[0] === 'grep') return { program: 'grep', args: args.slice(1) };
  return { program, args };
}

function stageTargets(stage: readonly string[]): ExploreTarget[] | null {
  const parsed = programOf(stage);
  if (!parsed) return null;
  const { program, args } = parsed;
  if (READERS.has(program)) {
    return operands(program, args).map((target) => ({ verb: 'read' as const, target }));
  }
  if (program === 'sed') {
    return sedReads(args)?.map((target) => ({ verb: 'read' as const, target })) ?? null;
  }
  if (LISTERS.has(program)) {
    if (program === 'find' && args.some((arg) => FIND_ACTIONS.test(arg))) return null;
    const paths = program === 'find' ? args.slice(0, 1) : operands(program, args);
    const target = paths.find((path) => !path.startsWith('-')) ?? '.';
    return [{ verb: 'list', target }];
  }
  if (SEARCHERS.has(program)) {
    const [pattern] = args.includes('-e')
      ? [args[args.indexOf('-e') + 1] ?? '']
      : operands(program === 'rg' ? 'rg' : 'grep', args);
    return [{ verb: 'search', target: pattern ?? '' }];
  }
  return null;
}

/** A filter after a pipe, which only narrows what came before it. */
function isFilter(stage: readonly string[]): boolean {
  const parsed = programOf(stage);
  if (!parsed) return false;
  if (parsed.program === 'sed') return sedReads(parsed.args) !== null;
  return FILTERS.has(parsed.program) || SEARCHERS.has(parsed.program);
}

/**
 * What a shell command looked at, when it only looks: each statement a
 * reader, a lister or a searcher, its pipes into filters, a `cd` before it
 * allowed; none when anything in it may change something.
 */
export function exploringCommand(command: string): ExploreTarget[] | null {
  const statements = statementsOf(command);
  if (!statements) return null;
  const targets: ExploreTarget[] = [];
  for (const [head, ...filters] of statements) {
    if (!head || head.length === 0) continue;
    if (head[0] === 'cd' && filters.length === 0) continue;
    const found = stageTargets(head);
    if (!found || !filters.every(isFilter)) return null;
    targets.push(...(found.length > 0 ? found : [{ verb: 'read' as const, target: '' }]));
  }
  return targets.length > 0 ? targets : null;
}
