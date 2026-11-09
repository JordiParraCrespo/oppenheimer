/**
 * What the person typed, read out of a user line of Claude Code's transcript.
 * The CLI writes more than the person's words on those lines: wrappers around
 * what they typed, and lines of its own. Each is one entry below, so the next
 * one the CLI adds is a line here, not a branch in the turn builder.
 */

/** Tags the CLI wraps around part of what was typed; the words inside stay. */
const UNWRAPPED: readonly RegExp[] = [
  // Text pasted into the prompt.
  /<\/?pasted_content(?:\s[^>]*)?>/g,
];

/** How a line the CLI writes for the person reads as typed. */
const REWRITES: readonly { readonly prefix: string; readonly read: (value: string) => string }[] = [
  {
    // A slash command: `/name arguments`.
    prefix: '<command-',
    read: (value) => {
      const name = /<command-name>([^<]*)<\/command-name>/.exec(value)?.[1]?.trim() ?? '';
      const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(value)?.[1]?.trim() ?? '';
      return [name, args].filter(Boolean).join(' ');
    },
  },
  {
    // A shell command run from the prompt: `! command`.
    prefix: '<bash-input>',
    read: (value) => `! ${value.replace(/<\/?bash-input>/g, '').trim()}`,
  },
];

/** Lines that are the CLI's own, not the person's: a caveat, a command's output. */
const CLI_LINES: readonly string[] = [
  'Caveat:',
  '<local-command-',
  '<bash-stdout',
  '<bash-stderr',
  '<system-reminder>',
];

/**
 * The person's words as they typed them, or `null` for a line that is the
 * CLI's own. The line is told apart as written, wrappers and all, so pasted
 * text that happens to start like one of the CLI's lines stays the person's.
 */
export function typedPrompt(raw: string): string | null {
  const value = raw.trim();
  if (CLI_LINES.some((prefix) => value.startsWith(prefix))) return null;
  const rewrite = REWRITES.find(({ prefix }) => value.startsWith(prefix));
  const typed = UNWRAPPED.reduce(
    (text, tags) => text.replace(tags, ''),
    rewrite ? rewrite.read(value) : value,
  ).trim();
  return typed === '' ? null : typed;
}
