const LABELS: Record<string, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  opencode: 'OpenCode',
};

/** The name a person reads for an agent engine. */
export function engineLabel(engine: string): string {
  return LABELS[engine] ?? engine;
}
