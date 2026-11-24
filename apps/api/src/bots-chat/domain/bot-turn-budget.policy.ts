/**
 * What one turn may still spend on its tools: a count per
 * kind of call, kept on the turn's tool context so a limit is part of the turn
 * and not of the tool that checks it. One per turn; nothing outlives it.
 *
 * A kind is counted one of two ways, never both: in calls, with `take` (two
 * notices a turn), or in some amount the call returns, with `spend` and
 * `overspent` (the characters a turn reads off its sessions), for a
 * limit that must bound volume rather than how often a tool is called. A
 * kind allowed once a turn (`check_back`) can instead be claimed with
 * `once`, which keeps what the first call did, for a second to answer with.
 */
export class BotTurnBudget {
  private readonly spent = new Map<string, number>();
  private readonly firsts = new Map<string, string>();

  /**
   * Claims the turn's one `kind` call, keeping `note` (what it did): null when
   * this is the first, else the note the first one kept.
   */
  once(kind: string, note: string): string | null {
    const first = this.firsts.get(kind);
    if (first !== undefined) return first;
    this.firsts.set(kind, note);
    return null;
  }

  /** Gives back a `once` claim whose work failed, so a retry in the turn can make it. */
  release(kind: string): void {
    this.firsts.delete(kind);
  }

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
