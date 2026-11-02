/** What an agent's context held: the tokens, against its window when that is known. */
export interface ChatUsageContext {
  tokens: number;
  window: number | null;
}

/** One of a subscription's usage windows: the share used, 0–100, and when it resets. */
export interface ChatUsageLimit {
  usedPercent: number;
  resetsAt: Date | null;
}

/** The context as a share of its window, 0–100; none when the window is not known. */
export function contextPercent(context: ChatUsageContext | null): number | null {
  if (!context?.window) return null;
  return Math.min(100, (context.tokens / context.window) * 100);
}
