import {
  type CallRun,
  type ChatToolCall,
  cutRuns,
  type ExploredPart,
  type ExploreTarget,
  exploredParts,
} from '@oppenheimer/frontend-consumer';

/**
 * Which of the agent's calls only look around, for the product package's
 * fold (`cutRuns`, `exploredParts`): `Read`, `NotebookRead`, `Grep`,
 * `Glob`, `LS`, and a `Bash` command that is one obvious reader, lister or
 * searcher (`exploringCommand`). Any other call ends the run.
 */

/** What an exploring call looked at; none for a call that does more than look. */
function exploreOf(call: ChatToolCall): ExploreTarget[] | null {
  switch (call.kind) {
    case 'read':
      return [readOf(call.target ?? '')];
    case 'search':
      return [
        call.name === 'Grep'
          ? searchOf(call.target ?? '')
          : { verb: 'list', key: call.target ?? '', label: call.target ?? '' },
      ];
    case 'command':
      return call.name === 'Bash' && call.target ? exploringCommand(call.target) : null;
    default:
      return null;
  }
}

/** A run of calls cut where it turns from looking around to doing something else, and back. */
export function exploredRuns(calls: readonly ChatToolCall[]): CallRun<ChatToolCall>[] {
  return cutRuns(calls, (call) => exploreOf(call) !== null);
}

/** What a run of exploring calls looked at, a file read twice (by `Read`, then `cat`) named once. */
export function exploredPartsOf(calls: readonly ChatToolCall[]): ExploredPart[] {
  return exploredParts(calls, exploreOf);
}

/** A file read, the same file however its path was spelled, named by its file name. */
function readOf(path: string): ExploreTarget {
  const key = path.replace(/^\.\//, '').replace(/\/+$/, '');
  return { verb: 'read', key, label: key.slice(key.lastIndexOf('/') + 1) };
}

function searchOf(pattern: string): ExploreTarget {
  return { verb: 'search', key: pattern, label: pattern };
}

function listOf(path: string): ExploreTarget {
  return { verb: 'list', key: path, label: path };
}

/** Anything that may write, run something else, or start a second statement. */
const UNSAFE = /[<>`;&\n\r]|\$\(|(^|\s)-(i\S*|exec\S*|delete|ok\S*|fprint\S*)(\s|$)/;
/** A leading `cd <dir> &&`, the one second statement allowed. */
const LEADING_CD = /^\s*cd\s+[^\s|]+\s*&&\s*/;
/** What may take an exploring command's output: it only narrows what came before. */
const FILTER = /^(head|tail|wc|sort|grep)(\s|$)/;
/** The predicates a `find` may carry and still only list. */
const FIND_PREDICATES = new Set(['-name', '-iname', '-type', '-path', '-maxdepth', '-mindepth']);

/** The words of one stage, quotes taken off; quotes left open make it unreadable. */
function wordsOf(stage: string): string[] | null {
  const words = stage.match(/"[^"]*"|'[^']*'|[^\s"']+|["']/g) ?? [];
  if (words.some((word) => word === '"' || word === "'")) return null;
  return words.map((word) => word.replace(/^(["'])(.*)\1$/, '$2'));
}

/** Words that are not flags, nor a count (`head -n 40`). */
function operands(args: readonly string[]): string[] {
  return args.filter((arg) => !arg.startsWith('-') && !/^\d+$/.test(arg));
}

/**
 * What a shell command looked at, when it is one obvious reader (`cat`,
 * `head`, `tail`, `sed -n`), lister (`ls`, `tree`, `find` with only name and
 * type predicates) or searcher (`rg`, `grep`, `git grep`), after at most a
 * leading `cd … &&` and piped into at most `head`, `tail`, `wc`, `sort` or
 * `grep`. Anything else is not looking around: a redirect, a substitution,
 * a `;`, an `&`, a newline (a second statement), `-i`, `-exec` or `-delete`.
 */
export function exploringCommand(command: string): ExploreTarget[] | null {
  const body = command.replace(LEADING_CD, '');
  if (UNSAFE.test(body)) return null;
  const [head, ...filters] = body.split('|').map((stage) => stage.trim());
  if (!head || !filters.every((stage) => FILTER.test(stage))) return null;
  const words = wordsOf(head);
  if (!words) return null;
  const [program, ...args] = words;
  switch (program) {
    case 'cat':
    case 'head':
    case 'tail': {
      const files = operands(args);
      return files.length > 0 ? files.map(readOf) : null;
    }
    case 'sed': {
      if (!args.includes('-n')) return null;
      const [, ...files] = operands(args);
      return files.length > 0 ? files.map(readOf) : null;
    }
    case 'ls':
    case 'tree':
      return [listOf(operands(args)[0] ?? '.')];
    case 'find': {
      const named = args[0] !== undefined && !args[0].startsWith('-');
      const path = named ? (args[0] as string) : '.';
      const rest = named ? args.slice(1) : args;
      for (let i = 0; i < rest.length; i += 2) {
        if (!FIND_PREDICATES.has(rest[i] ?? '') || rest[i + 1] === undefined) return null;
      }
      return [listOf(path)];
    }
    case 'git':
      return args[0] === 'grep' && operands(args.slice(1))[0]
        ? [searchOf(operands(args.slice(1))[0] as string)]
        : null;
    case 'rg':
    case 'grep': {
      const [pattern] = operands(args);
      return pattern ? [searchOf(pattern)] : null;
    }
    default:
      return null;
  }
}
