/**
 * What one turn may still spend on its tools (`25-bots.md` §4.7): a count per
 * kind of call, kept on the turn's tool context so a limit is part of the turn
 * and not of the tool that checks it. One per turn; nothing outlives it.
 *
 * A kind is counted one of two ways, never both: in calls, with `take` (two
 * notices a turn), or in some amount the call returns, with `spend` and
 * `overspent` (the characters a turn reads off its sessions, §4.2), for a
 * limit that must bound volume rather than how often a tool is called.
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

  /**
   * Whether `kind` has already spent `max` or more this turn. Checked before
   * a call adds to it, so a turn already at its fill does no more of that
   * kind of work; pairs with `spend`.
   */
  overspent(kind: string, max: number): boolean {
    return (this.spent.get(kind) ?? 0) >= max;
  }

  /** Adds `amount` to what `kind` has spent this turn (pairs with `overspent`). */
  spend(kind: string, amount: number): void {
    this.spent.set(kind, (this.spent.get(kind) ?? 0) + amount);
  }
}
