/**
 * What one turn may still spend on its tools (`25-bots.md` §4.7): a count per
 * kind of call, kept on the turn's tool context so a limit is part of the turn
 * and not of the tool that checks it. One per turn; nothing outlives it.
 */
export class BotTurnBudget {
  private readonly spent = new Map<string, number>();

  /** Takes one `kind` call if fewer than `max` were taken this turn; says whether it did. */
  take(kind: string, max: number): boolean {
    const used = this.spent.get(kind) ?? 0;
    if (used >= max) return false;
    this.spent.set(kind, used + 1);
    return true;
  }
}
