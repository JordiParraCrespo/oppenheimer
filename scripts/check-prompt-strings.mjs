#!/usr/bin/env node
/**
 * What a model is told is prose in `domain/prompts/`, not a string in the code
 * (`apps/api/AGENTS.md`, "What a model is told is prose"). This holds it: in
 * an API module that has prompt files, a sentence written as a string literal
 * fails, unless the ledger below says why it is not for a model.
 *
 * A sentence is a literal (a string, a template, or a list of them joined by
 * a literal) whose own words number at least four and its characters at
 * least 28. Shorter text is a label or a piece of a record's format and
 * stays in the code. A literal is not counted where a model's words are not
 * written: an exception's message (it is the API's, for its clients, even
 * when a failed tool passes it on; what a tool says to refuse is a
 * `BotToolRefusal`, which is counted), a logger's, a query's, a decorator's,
 * a type, a key, a comparison, a domain event's or an outbox row's reason,
 * what a tool's `summarize` returns (the line on the person's approval
 * card), and the argument of `promptText` itself.
 *
 * The ledger is exact: an entry names a file and how the sentence starts (or
 * the whole file, when none of it is for a model), and an entry that matches
 * nothing fails too, so the ledger cannot outlive what it excuses.
 *
 * Run: pnpm check:prompt-strings
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const API_SRC = join(root, 'apps/api/src');

const MIN_WORDS = 4;
const MIN_CHARS = 28;

/**
 * Sentences that stay strings, each with why it is not a model's words.
 * `starts` is how the sentence begins; without it the whole file is excused.
 */
export const LEDGER = [
  {
    file: 'bots-chat/infrastructure/metered-bot-engine.adapter.ts',
    why: 'metric descriptions, read in the monitoring stack',
  },
  {
    file: 'bots-chat/infrastructure/redis-bot-stream.adapter.ts',
    why: 'Lua scripts and log lines',
  },
  {
    file: 'bots-chat/infrastructure/bot-routine-target.adapter.ts',
    starts: 'Routine ',
    why: "why a run was skipped, kept on the run's row for whoever reads it",
  },
  {
    file: 'bots-chat/domain/bot-built-in.policy.ts',
    why: "the API routes behind each built-in command, for a client's developer",
  },
  {
    file: 'bots-chat/domain/bot-channel-turn.policy.ts',
    starts: 'Done, with nothing to say here.',
    why: 'sent to the person on Telegram or WhatsApp, not to a model',
  },
  {
    file: 'bots-chat/domain/bot-approval.entity.ts',
    starts: 'expired: the owner wrote',
    why: "the reason on an approval's domain event, for whoever reads the outbox",
  },
  {
    file: 'bots-chat/domain/bot-goal.entity.ts',
    starts: 'The bot said the goal is met.',
    why: "a goal's stored claim when the bot gave no words",
  },
  {
    file: 'bots-chat/domain/bot-turn.entity.ts',
    starts: 'The turn was interrupted.',
    why: "a turn's stored error, shown to the person",
  },
  {
    file: 'bots-chat/domain/bot-rule-review.policy.ts',
    starts: 'Auto-approved by your rule',
    why: "a step's line in the chat, for the person",
  },
  {
    file: 'bots-chat/domain/bot-rule-review.policy.ts',
    starts: 'Your rules could not be checked',
    why: "an approval card's note, for the person",
  },
  {
    file: 'bots-chat/domain/bot-session-activity.policy.ts',
    starts: 'that follow-up never reached the host',
    why: "one phrase of a table with one per kind of a session's activity entry; the others are short labels, and the table stays whole",
  },
  {
    file: 'bots-chat/domain/bot-session-activity.policy.ts',
    starts: 'the pending decision was answered',
    why: "one phrase of a table with one per kind of a session's activity entry; the others are short labels, and the table stays whole",
  },
  {
    file: 'bots-chat/domain/bot-session-activity.policy.ts',
    starts: 'the agent no longer waits on a decision',
    why: "one phrase of a table with one per kind of a session's activity entry; the others are short labels, and the table stays whole",
  },
  {
    file: 'bots-chat/domain/bot-session-wait.policy.ts',
    starts: 'had its task expire',
    why: 'one phrase of a table of short ones for how a task ended; the table stays whole',
  },
  {
    file: 'bots-chat/application/bot-session-search.policy.ts',
    starts: 'question or permission asked',
    why: "one of a table of short labels for a session's activity",
  },
  {
    file: 'bots-chat/application/bot-turn-failure-report.policy.ts',
    starts: 'The turn ended without saying why',
    why: 'a failure report for the error tracker',
  },
  {
    file: 'bots-chat/application/turn-transcript.policy.ts',
    starts: 'The turn ended without saying how',
    why: "a turn's stored error, shown to the person",
  },
  {
    file: 'bots-chat/application/turn-transcript.policy.ts',
    starts: 'Stopped: the model sent nothing',
    why: "a turn's stored error, shown to the person",
  },
  {
    file: 'bots-chat/application/turn-transcript.policy.ts',
    starts: 'Stopped: the turn kept repeating',
    why: "a turn's stored error, shown to the person",
  },
  {
    file: 'bots-chat/application/turn-transcript.policy.ts',
    starts: 'Stopped at the step limit',
    why: "a turn's stored error, shown to the person",
  },
  {
    file: 'bots-chat/application/turn-transcript.policy.ts',
    starts: 'The turn could not be saved',
    why: "a storage error's message",
  },
  {
    file: 'bots-chat/application/bot-cloud-session.policy.ts',
    starts: 'Start a ',
    why: "the line on the person's approval card for a cloud session",
  },
  {
    file: 'bots-chat/bot-session-tool.mapper.ts',
    starts: ', and hear back when it ends',
    why: "part of the line on the person's approval card for a session",
  },
  {
    file: 'bots-chat/bot-session-tool.mapper.ts',
    starts: ', even with work never pushed',
    why: "part of the line on the person's approval card for closing a session",
  },
  {
    file: 'bots-chat/bot-session-tool.mapper.ts',
    starts: 'Close the session "',
    why: "the line on the person's approval card for closing a session",
  },
  {
    file: 'bots-chat/bot-subscription.mapper.ts',
    starts: 'every task, until the session is closed',
    why: "a watch tool's answer, still here because the mapper is at its 300-line cap: it moves to prompt files with the mapper's answer builders",
  },
  {
    file: 'bots-chat/bot-subscription.mapper.ts',
    starts: 'You follow session',
    why: "a watch tool's answer, still here because the mapper is at its 300-line cap: it moves to prompt files with the mapper's answer builders",
  },
  {
    file: 'bots-chat/bot-subscription.mapper.ts',
    starts: 'You are also woken when its terminal',
    why: "a watch tool's answer, still here because the mapper is at its 300-line cap: it moves to prompt files with the mapper's answer builders",
  },
  {
    file: 'bots-chat/bot-subscription.mapper.ts',
    starts: 'Its host runs a runner too old',
    why: "a watch tool's answer, still here because the mapper is at its 300-line cap: it moves to prompt files with the mapper's answer builders",
  },
  {
    file: 'bots-chat/bot-subscription.mapper.ts',
    starts: 'Its host is offline; the watch starts',
    why: "a watch tool's answer, still here because the mapper is at its 300-line cap: it moves to prompt files with the mapper's answer builders",
  },
  {
    file: 'bots-chat/bot-subscription.mapper.ts',
    starts: 'pull request #',
    why: "a watch tool's answer, still here because the mapper is at its 300-line cap: it moves to prompt files with the mapper's answer builders",
  },
];

const SKIP_DIRS = new Set(['__tests__', 'prompts', 'database', 'dtos', 'decorators', 'guards']);
const SKIP_FILES =
  /(\.spec\.ts|\.gen\.ts|\.orm-entity\.ts|\.controller\.ts|\.module\.ts|\.di-tokens\.ts|\.errors\.ts|\.domain-event\.ts|\.port\.ts|\.repository\.ts|\.command\.ts|\.query\.ts)$/;

const isLiteral = (node) =>
  ts.isStringLiteral(node) ||
  ts.isNoSubstitutionTemplateLiteral(node) ||
  ts.isTemplateExpression(node);

/** `['a', `b ${c}`].join('\n')`: a list of nothing but literals, joined by a literal. */
function joinedList(node) {
  if (!ts.isCallExpression(node) || node.arguments.length !== 1) return null;
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'join') return null;
  const list = ts.skipParentheses(callee.expression);
  const separator = node.arguments[0];
  if (!ts.isArrayLiteralExpression(list) || list.elements.length < 2) return null;
  if (!ts.isStringLiteral(separator) && !ts.isNoSubstitutionTemplateLiteral(separator)) return null;
  if (!list.elements.every(isLiteral)) return null;
  return { elements: [...list.elements], separator: separator.text };
}

/** The literal's own words, without what fills it. */
function wordsOf(node) {
  const joined = joinedList(node);
  if (joined) return joined.elements.map(wordsOf).join(joined.separator);
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' ');
  }
  return node.text;
}

const SQL = /^\s*(SELECT|UPDATE|INSERT|DELETE|WITH|CREATE|ALTER|DROP)\b|\bFROM\s+"|\bWHERE\s+"/;

function isSentence(node) {
  const text = wordsOf(node).trim();
  if (text.length < MIN_CHARS || SQL.test(text)) return false;
  const words = text.split(/\s+/).filter((word) => /[A-Za-z]{2,}/.test(word));
  return words.length >= MIN_WORDS && /[a-z]{2,} [a-z]{2,}/i.test(text);
}

const NOT_WORDS_CALLS = /(logger\.|console\.|\.query$|^promptText$)/;
const NOT_WORDS_NEW = /(Exception$|^Error$|^AppError$|^RegExp$|^Logger$|DomainEvent$)/;

const isFunction = (node) =>
  ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node);

/**
 * Whether the literal sits where a model's words are not written. A call or a
 * constructor excuses only what is handed to it directly: a sentence inside a
 * callback passed to it is counted like any other.
 */
function cannotBeWords(node, source) {
  let direct = true;
  for (let parent = node.parent, child = node; parent; child = parent, parent = parent.parent) {
    if (ts.isDecorator(parent) || ts.isTypeNode(parent) || ts.isTaggedTemplateExpression(parent)) {
      return true;
    }
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
    if (ts.isCaseClause(parent) && parent.expression === child) return true;
    if (ts.isPropertyAssignment(parent) && parent.name === child) return true;
    if (ts.isElementAccessExpression(parent) && parent.argumentExpression === child) return true;
    if (
      ts.isBinaryExpression(parent) &&
      [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
      ].includes(parent.operatorToken.kind)
    ) {
      return true;
    }
    if (ts.isNewExpression(parent)) {
      const made = parent.expression.getText(source);
      // A tool's refusal is read by the model, wherever it is thrown.
      if (/BotToolRefusal$/.test(made)) return false;
      if (direct && NOT_WORDS_NEW.test(made)) return true;
    }
    if (direct && ts.isCallExpression(parent) && parent.expression !== child) {
      const callee = parent.expression.getText(source).replace(/\s+/g, '');
      if (NOT_WORDS_CALLS.test(callee)) return true;
    }
    // What a tool's `summarize` returns is the line on the person's approval card.
    if (ts.isPropertyAssignment(parent) && parent.name.getText(source) === 'summarize') return true;
    // An outbox row's reason is for whoever reads the table.
    if (ts.isPropertyAssignment(parent) && parent.name.getText(source) === 'reason') {
      for (let outer = parent.parent; outer; outer = outer.parent) {
        if (
          ts.isCallExpression(outer) &&
          /(stageJob|stageEvents)$/.test(outer.expression.getText(source))
        ) {
          return true;
        }
      }
    }
    if (isFunction(parent)) direct = false;
  }
  return false;
}

/** Every sentence a file writes as a literal: its line and how it starts. */
export function sentencesIn(text, name = 'file.ts') {
  const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
  const found = [];
  const add = (node) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    found.push({ line: line + 1, text: wordsOf(node).trim() });
  };
  (function visit(node) {
    const joined = joinedList(node);
    if (joined && isSentence(node) && !cannotBeWords(node, source)) {
      // The lines are one text: only what fills them is looked at further.
      for (const element of joined.elements) {
        if (ts.isTemplateExpression(element)) {
          for (const span of element.templateSpans) visit(span.expression);
        }
      }
      add(node);
      return;
    }
    ts.forEachChild(node, visit);
    if (isLiteral(node) && isSentence(node) && !cannotBeWords(node, source)) add(node);
  })(source);
  return found.sort((a, b) => a.line - b.line);
}

function filesOf(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) filesOf(path, out);
    } else if (entry.name.endsWith('.ts') && !SKIP_FILES.test(entry.name)) {
      out.push(path);
    }
  }
  return out.sort();
}

/**
 * The sentences no ledger entry covers, and the ledger entries that cover
 * nothing, over `{ file, text }` pairs with `file` relative to the API's `src`.
 */
export function check(files, ledger = LEDGER) {
  const used = new Set();
  const outstanding = [];
  for (const { file, text } of files) {
    for (const sentence of sentencesIn(text, file)) {
      const entry = ledger.find(
        (candidate) =>
          candidate.file === file &&
          (candidate.starts === undefined || sentence.text.startsWith(candidate.starts)),
      );
      if (entry) used.add(entry);
      else outstanding.push({ file, ...sentence });
    }
  }
  return { outstanding, stale: ledger.filter((entry) => !used.has(entry)) };
}

/** The API modules that keep their words for a model in prompt files. */
function modulesWithPrompts() {
  return readdirSync(API_SRC, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(API_SRC, name, 'domain/prompts')))
    .sort();
}

function main() {
  const modules = modulesWithPrompts();
  const files = modules.flatMap((name) =>
    filesOf(join(API_SRC, name)).map((path) => ({
      file: relative(API_SRC, path),
      text: readFileSync(path, 'utf8'),
    })),
  );
  const { outstanding, stale } = check(files);
  if (!outstanding.length && !stale.length) {
    console.log(
      `Prompt strings: ${files.length} files of ${modules.join(', ')} hold no sentence outside the ledger's ${LEDGER.length} entries.`,
    );
    return;
  }
  console.error(
    `Prompt strings: ${outstanding.length + stale.length} problem${outstanding.length + stale.length === 1 ? '' : 's'}\n`,
  );
  for (const { file, line, text } of outstanding) {
    console.error(`  ✖ apps/api/src/${file}:${line}: "${text.replace(/\s+/g, ' ').slice(0, 90)}…"`);
  }
  if (outstanding.length) {
    console.error(
      '\n  A sentence for a model goes in the module\'s domain/prompts/ and is read with promptText\n  (apps/api/AGENTS.md, "What a model is told is prose"). One that is not for a model goes in\n  LEDGER in scripts/check-prompt-strings.mjs, with why.\n',
    );
  }
  for (const entry of stale) {
    console.error(
      `  ✖ LEDGER: ${entry.file}${entry.starts ? ` "${entry.starts}"` : ''} matches nothing; remove the entry`,
    );
  }
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
