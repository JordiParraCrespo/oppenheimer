import type {
  KeyedPermission,
  PermissionOption,
  PermissionPromptSpec,
} from '@oppenheimer/shared/sessions';
import type { ChatToolCall, ChatTurn } from './session-chat';

/**
 * The permission dialog the agent draws before a tool runs, as the terminal
 * shows it: its question, what it says it asks about, and its options with
 * the keys that pick them (`permissionChoiceKeys`). The transcript holds only
 * the call; whether the agent waits on the person, and what it offers them,
 * only the screen says, so the chat reads it there.
 */
export interface ChatPermissionPrompt extends KeyedPermission {
  /** The dialog's words and options, joined: stable while it is on screen, another for the next. */
  id: string;
  /** Its question ("Do you want to proceed?"). */
  title: string;
  /** Its first line, what kind of thing it asks ("Bash command", "Edit file"). */
  head: string | null;
  /** The lines between that and the question: the command, the file, the URL. */
  detail: string[];
  options: PermissionOption[];
}

/** How much of the bottom of the screen a dialog is looked for in. */
const DIALOG_ROWS = 40;
/** How many lines over its question are kept as what it asks about. */
const DETAIL_ROWS = 12;
/** How many rows under its last option its footer may be. */
const FOOTER_ROWS = 3;

/** A numbered option, the cursor before it or not: `❯ 1. Yes`, `  2. No`. */
const OPTION = /^(\s*)([❯›>▶➤])?(\s*)([1-9])[.)]\s+(\S.*)$/u;
/** A rule across the screen: the line Claude Code draws over a dialog, or a box's edge. */
const RULE = /^[\s─━═╭╮╰╯┌┐└┘]{8,}$/u;
/** A dotted rule round a dialog's command or diff, which bounds nothing. */
const DOTTED = /^[\s╌┄┈]{8,}$/u;
/** A box's sides, taken off a line before it is read. */
const SIDES = /^[\s│┃]+|[\s│┃]+$/gu;
/** What an option's label ends with to name its key, which the card says in its own way. */
const KEY_HINT = /\s*\((?:esc|shift\+tab|[a-z])\)$/iu;

interface OptionRow {
  n: number;
  label: string;
  cursor: boolean;
  /** Where the label starts, for the rows a long one wrapped onto. */
  column: number;
}

function optionRow(row: string): OptionRow | null {
  const match = OPTION.exec(row.replace(/[\s│┃]+$/u, ''));
  if (!match) return null;
  const [, lead = '', cursor, gap = '', n = '0', label = ''] = match;
  return {
    n: Number(n),
    label: label.trim(),
    cursor: cursor !== undefined,
    column: lead.length + (cursor ? cursor.length : 0) + gap.length + 3,
  };
}

const clean = (row: string) => row.replace(SIDES, '');

/**
 * The permission dialog at the bottom of a screen, read with the agent's
 * spec (`permissionPromptOf`), given as its rows top to bottom; none when
 * none is drawn. The dialog is its question, then options numbered from 1 in
 * order, a label that wrapped indented under its start; over the question,
 * up to the rule over the dialog, what it asks about. A question the agent's
 * spec does not know, an option it cannot tell, or a dialog with no way to
 * allow or to refuse is no dialog: the console never answers what it cannot
 * read. Only the lowest one counts, so one left in the scrollback is not.
 */
export function readPermissionPrompt(
  spec: PermissionPromptSpec,
  screen: readonly string[],
): ChatPermissionPrompt | null {
  const rows = screen.slice(-DIALOG_ROWS).map((row) => row.trimEnd());
  let first = -1;
  for (let at = rows.length - 1; at >= 0; at--) {
    if (optionRow(rows[at] ?? '')?.n === 1) {
      first = at;
      break;
    }
  }
  if (first < 0) return null;

  const found: OptionRow[] = [];
  let end = first;
  for (let at = first; at < rows.length; at++) {
    const raw = rows[at] ?? '';
    const option = optionRow(raw);
    if (option?.n === found.length + 1) {
      found.push(option);
      end = at;
      continue;
    }
    const last = found.at(-1);
    const indent = raw.length - raw.trimStart().length;
    if (option || !last || raw.trim() === '' || indent < last.column) break;
    last.label = `${last.label} ${raw.trim()}`;
    end = at;
  }
  if (found.length < 2) return null;

  // The question is the line over the options, or, where the dialog says
  // what it asks about under it, the first line over that it reads as one.
  let titleAt = -1;
  for (let at = first - 1; at >= 0 && first - at <= DETAIL_ROWS + 1; at--) {
    const line = clean(rows[at] ?? '');
    if (RULE.test(rows[at] ?? '')) break;
    if (spec.titles.some((pattern) => pattern.test(line))) {
      titleAt = at;
      break;
    }
    if (line !== '' && spec.detailAt === 'above') break;
  }
  if (titleAt < 0) return null;
  const title = clean(rows[titleAt] ?? '');

  const options: PermissionOption[] = [];
  for (const [index, row] of found.entries()) {
    const label = row.label.replace(KEY_HINT, '').trim();
    const rule = spec.choices.find((choice) => choice.label.test(label));
    if (!rule) return null;
    options.push({ label, kind: rule.kind, index, key: rule.key ?? null });
  }
  const allows = options.some((option) => option.kind === 'once');
  const refuses = options.some((option) => option.kind === 'deny' || option.kind === 'decline');
  if (!allows || !refuses) return null;

  const said: string[] = [];
  if (spec.detailAt === 'below') {
    for (const raw of rows.slice(titleAt + 1, first)) said.push(clean(raw));
  } else {
    for (let at = titleAt - 1; at >= 0 && said.length < DETAIL_ROWS + 1; at--) {
      const raw = rows[at] ?? '';
      if (RULE.test(raw)) break;
      if (!DOTTED.test(raw)) said.unshift(clean(raw));
    }
  }
  const lines = said.filter((line) => line !== '' && !spec.noise?.test(line));
  const footer = rows
    .slice(end + 1, end + 1 + FOOTER_ROWS)
    .map(clean)
    .join(' ');
  const amendKey = spec.amend?.hint.test(footer) ? spec.amend.key : null;
  const cursor = Math.max(
    0,
    found.findIndex((row) => row.cursor),
  );
  const head = spec.detailAt === 'above' ? (lines[0] ?? null) : null;
  const detail = spec.detailAt === 'above' ? lines.slice(1) : lines;
  return {
    id: [title, ...lines, ...options.map((option) => option.label)].join('\u0000'),
    title,
    head,
    detail,
    options,
    cursor,
    amendKey,
  };
}

/** Whether two readings say the same, so an unchanged screen publishes nothing. */
export function samePermissionPrompt(
  a: ChatPermissionPrompt | null,
  b: ChatPermissionPrompt | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.cursor === b.cursor && a.amendKey === b.amendKey;
}

/** A permission the agent waits on: the dialog on screen, and the call it asks about. */
export interface ChatPendingPermission {
  prompt: ChatPermissionPrompt;
  /**
   * The call the dialog asks about: the last one in the turn with no result
   * yet, inside the subagent that made it when one did; none while the
   * transcript has not caught up with the screen.
   */
  call: ChatToolCall | null;
}

/** The last call with no result among `steps`, followed into a subagent still at work. */
function openCall(steps: ChatTurn['steps']): ChatToolCall | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step?.kind !== 'tool' || step.call.status !== 'running') continue;
    const inner = step.call.subagent ? openCall(step.call.subagent.steps) : null;
    return inner ?? step.call;
  }
  return null;
}

/**
 * Whether the agent waits on the person's permission, and for what: the
 * dialog on its screen (`readPermissionPrompt`), with the last call of the
 * turn that has no result, which is what the dialog is about. A question the
 * agent asks (`AskUserQuestion`) is its own picker, never this. None when no
 * dialog is drawn: the turn goes on, or the agent's dialog is not one the
 * console reads.
 */
export function pendingPermission(
  turn: ChatTurn | undefined,
  prompt: ChatPermissionPrompt | null,
): ChatPendingPermission | null {
  if (!prompt) return null;
  const call = turn ? openCall(turn.steps) : null;
  if (call?.kind === 'question') return null;
  return { prompt, call };
}

/** One command of a line, between the operators that join several. */
const SEGMENTS = /\s*(?:&&|\|\||[;|&\n])\s*/;
/**
 * What makes a command worth a second look before it is allowed: it deletes
 * a tree, rewrites what others share, or hands the machine to something
 * else. Each pattern reads one command of the line, so a flag after the
 * subcommand or a `-C dir` before it still counts.
 */
const RISKY: readonly RegExp[] = [
  // rm -rf, rm -fr, rm -r -f, rm --recursive --force
  /^(?:sudo\s+)?rm\b(?=.*\s(?:-[a-zA-Z]*[rR]|--recursive\b))(?=.*\s(?:-[a-zA-Z]*f|--force\b))/,
  /^(?:sudo\s+)?git\s.*\bpush\b.*(?:\s(?:-f|--force(?:-with-lease)?)\b|\s\+\S)/,
  /^(?:sudo\s+)?git\s.*\breset\b.*--hard\b/,
  /^(?:sudo\s+)?git\s.*\bclean\b.*\s-[a-zA-Z]*f/,
  /^(?:sudo\s+)?git\s.*\bbranch\b.*\s-D\b/,
  /^sudo\b/,
  /^(?:mkfs|fdisk|dd)\b/,
  /^chmod\s.*-R\b.*\b777\b/,
  /\bdrop\s+(?:table|database)\b/i,
];

/**
 * Whether a command the agent wants to run deserves a warning tint on the
 * card. A hint, never a gate: it fails towards saying nothing, and a command
 * it misses is still the person's to read.
 */
export function riskyCommand(command: string): boolean {
  const segments = command.trim().split(SEGMENTS);
  return segments.some((segment, index) => {
    // A download is only worth a word when it is piped into a shell.
    if (/^(?:curl|wget)\b/.test(segment)) {
      return /^(?:sudo\s+)?(?:ba|z)?sh\b/.test(segments[index + 1] ?? '');
    }
    return RISKY.some((pattern) => pattern.test(segment));
  });
}
