#!/usr/bin/env node
// PreToolUse hook on Bash: refuse the git commands that publish to the wrong
// place, destroy work, or stage more than was meant. Exit 2 blocks the call
// and hands the message on stderr back to the agent.
//
// The policy, one list for both enforcers:
//
// - a push to main or master (`git push origin main`, `HEAD:main`, `+master`,
//   `refs/heads/main`, `--all`, `--mirror`): work goes on a branch and reaches
//   main through a pull request;
// - a force push (`--force`, `-f`, `--force-with-lease`, a `+refspec`);
// - deleting a remote branch (`--delete`, `-d`, a `:refspec`);
// - `git reset --hard`, and deleting a branch unmerged (`git branch -D`,
//   `--delete --force`);
// - `git add` (or `git stage`) of everything: `-A`, `--all`, `.`, `./`, `*`,
//   `:/`; stage files by name, so nothing nobody read (a secret, another
//   session's work) rides along;
// - `git add` of an env file: `.env`, `.env.local`, `.env.<anything>`, except
//   the committed `.env.example`, which documents them.
//
// `.claude/settings.json` denies the same force-push, reset, branch-delete
// and remote-delete commands, but its rules are glob prefixes over the raw
// command line: `git -C repo push --force`, `git -c k=v push`, a quoted
// argument or a second command after `&&` slips past them. They stay as the
// first line; this hook is the precise check. It parses the command the way
// a shell splits it (quotes, escapes, `&&` `||` `;` `|` `&`, newlines,
// subshells, `$(...)`), skips leading `VAR=value` words and wrappers such as
// `env` or `command`, then git's global options (`-C <path>`, `-c <k=v>`,
// `--git-dir=…`, `--no-pager`, …) to find the subcommand, and honours `--`.
// `.agents/hooks/git-guard.test.mjs` holds the cases.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEPARATORS = new Set(['&&', '||', ';', '|', '&', '\n', '(', ')', '$(', '`']);
/** Words that run the command after them (and their own options). */
const WRAPPERS = new Set(['env', 'command', 'exec', 'time', 'nohup', 'nice', 'builtin']);
/** git's global options that take the next word as their value. */
const GLOBAL_WITH_VALUE = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--super-prefix',
  '--config-env',
  '--exec-path',
  '--list-cmds',
  '--attr-source',
]);
const PROTECTED = new Set(['main', 'master']);

/**
 * Split a command line into words, shell style, with every separator as a
 * word of its own. Quotes group and are removed, a backslash escapes the next
 * character, and `$(` and a backtick open a nested command.
 */
export function tokenize(line) {
  const words = [];
  let word = '';
  let quoted = false;
  const flush = () => {
    if (word !== '' || quoted) words.push(word);
    word = '';
    quoted = false;
  };
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const pair = line.slice(i, i + 2);
    if (char === "'") {
      const end = line.indexOf("'", i + 1);
      word += end === -1 ? line.slice(i + 1) : line.slice(i + 1, end);
      quoted = true;
      i = end === -1 ? line.length : end;
    } else if (char === '"') {
      quoted = true;
      for (i += 1; i < line.length && line[i] !== '"'; i += 1) {
        if (line[i] === '\\' && i + 1 < line.length) i += 1;
        word += line[i];
      }
    } else if (char === '\\') {
      if (line[i + 1] === '\n') i += 1;
      else if (i + 1 < line.length) word += line[++i];
    } else if (pair === '&&' || pair === '||' || pair === '$(') {
      flush();
      words.push(pair);
      i += 1;
    } else if (SEPARATORS.has(char)) {
      flush();
      words.push(char);
    } else if (char === '#' && word === '' && !quoted) {
      while (i < line.length && line[i] !== '\n') i += 1;
      i -= 1;
    } else if (/\s/.test(char)) {
      flush();
    } else {
      word += char;
    }
  }
  flush();
  return words;
}

/** The simple commands in `line`, each as its words, separators dropped. */
export function commands(line) {
  const result = [[]];
  for (const word of tokenize(line)) {
    if (SEPARATORS.has(word)) result.push([]);
    else result.at(-1).push(word);
  }
  return result.filter((words) => words.length > 0);
}

/** `{ subcommand, args }` when `words` runs git, after its global options; else undefined. */
export function gitInvocation(words) {
  let i = 0;
  for (;;) {
    while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) i += 1;
    if (!WRAPPERS.has(words[i])) break;
    i += 1;
    while (i < words.length && words[i].startsWith('-')) i += 1;
  }
  if (i >= words.length || basename(words[i]) !== 'git') return undefined;
  i += 1;
  while (i < words.length && words[i].startsWith('-')) {
    const option = words[i];
    i += GLOBAL_WITH_VALUE.has(option) ? 2 : 1;
  }
  if (i >= words.length) return undefined;
  return { subcommand: words[i], args: words.slice(i + 1) };
}

/** `git push` options whose value is the next word, so it is not read as the remote. */
const PUSH_WITH_VALUE = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);

/** Options and operands, with `--` ending the options. */
function split(args, withValue = new Set()) {
  const options = [];
  const operands = [];
  let ended = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!ended && arg === '--') ended = true;
    else if (!ended && arg.startsWith('-') && arg !== '-') {
      options.push(arg);
      if (withValue.has(arg)) i += 1;
    } else operands.push(arg);
  }
  return { options, operands };
}

/** Whether a short-option cluster (`-fu`) or a long option names `short` or `long`. */
function has(options, short, ...long) {
  return options.some(
    (option) =>
      long.some((name) => option === name || option.startsWith(`${name}=`)) ||
      (short && /^-[A-Za-z]+$/.test(option) && option.slice(1).includes(short)),
  );
}

function refName(ref) {
  return ref.replace(/^refs\/heads\//, '');
}

function checkPush(args) {
  const { options, operands } = split(args, PUSH_WITH_VALUE);
  if (has(options, 'f', '--force', '--force-with-lease', '--force-if-includes')) {
    return 'Do not force push. Push new commits, or ask the person to force push themselves.';
  }
  if (has(options, 'd', '--delete') || has(options, null, '--prune')) {
    return 'Do not delete remote branches. Ask the person to.';
  }
  if (has(options, null, '--all', '--mirror', '--branches')) {
    return 'Do not push every branch: it includes main. Push your branch by name.';
  }
  // The first operand is the remote; the rest are refspecs.
  for (const refspec of operands.slice(1)) {
    if (refspec.startsWith('+')) {
      return 'Do not force push (a +refspec). Push new commits instead.';
    }
    const colon = refspec.indexOf(':');
    if (colon === 0) return 'Do not delete remote branches (a :refspec). Ask the person to.';
    const destination = refName(colon === -1 ? refspec : refspec.slice(colon + 1));
    if (PROTECTED.has(destination)) {
      return 'Do not push to main or master. Push a branch and open a pull request (the steward skill).';
    }
  }
  return undefined;
}

function checkAdd(args) {
  const { options, operands } = split(args);
  if (has(options, 'A', '--all', '--no-ignore-removal')) {
    return 'Do not stage everything (git add -A / --all / . / *). Stage the files you changed by path.';
  }
  for (const pathspec of operands) {
    const path = pathspec.replace(/^:\((?:top|literal|glob|icase)\)/, '');
    // `.`, `./`, `././`, `*`, `:/` and `:(top)` all name the whole tree.
    if (['*', ':/', ':'].includes(path) || /^(\.\/)*\.?\/?$/.test(path)) {
      return 'Do not stage everything (git add -A / --all / . / *). Stage the files you changed by path.';
    }
    const name = basename(path);
    if ((name === '.env' || name.startsWith('.env.') || name === '.env*') && name !== '.env.example') {
      return `Do not stage ${pathspec}: env files hold secrets. Only .env.example is committed.`;
    }
  }
  return undefined;
}

function checkReset(args) {
  return split(args).options.includes('--hard')
    ? 'Do not run git reset --hard: it discards work. Ask the person, or stash.'
    : undefined;
}

function checkBranch(args) {
  const { options } = split(args);
  const forcedDelete =
    has(options, 'D') ||
    (has(options, 'd', '--delete') && has(options, 'f', '--force'));
  return forcedDelete
    ? 'Do not force-delete a branch (git branch -D). Ask the person to.'
    : undefined;
}

const CHECKS = { push: checkPush, add: checkAdd, stage: checkAdd, reset: checkReset, branch: checkBranch };

/** Why `line` is refused, or undefined when it may run. */
export function verdict(line) {
  for (const words of commands(line)) {
    const git = gitInvocation(words);
    const check = git && CHECKS[git.subcommand];
    const reason = check?.(git.args);
    if (reason) return reason;
  }
  return undefined;
}

function main() {
  let command;
  try {
    command = JSON.parse(readFileSync(0, 'utf8'))?.tool_input?.command;
  } catch {
    process.exit(0);
  }
  if (typeof command !== 'string' || command === '') process.exit(0);
  const reason = verdict(command);
  if (reason) {
    process.stderr.write(`BLOCKED: ${reason}\n`);
    process.exit(2);
  }
  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
