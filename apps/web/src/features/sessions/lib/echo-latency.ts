/**
 * How long the host takes to answer a keystroke, measured in the browser: from
 * a key leaving the pane to the next output arriving on its stream. That is
 * the round trip a reader feels, relay and host included, and it is what
 * decides whether predictive echo (`typeahead.ts`) is worth drawing.
 *
 * A key only starts a sample when the stream has been quiet for `quietMs`:
 * while an agent is printing, the next chunk is its output, not the echo, and
 * would read as an impossibly fast host. A sample longer than `maxSampleMs` is
 * a key the program never echoed (a password, a key it ignores) and is
 * dropped.
 */
export class EchoLatency {
  private keyAt: number | null = null;
  private lastOutputAt = Number.NEGATIVE_INFINITY;
  private readonly samples: number[] = [];

  constructor(
    private readonly quietMs = 200,
    private readonly maxSampleMs = 3000,
    private readonly window = 50,
  ) {}

  /** A key was sent at `now`. */
  sent(now: number): void {
    if (this.keyAt !== null && now - this.keyAt <= this.maxSampleMs) return;
    this.keyAt = now - this.lastOutputAt >= this.quietMs ? now : null;
  }

  /** Output arrived at `now`. */
  received(now: number): void {
    if (this.keyAt !== null) {
      const sample = now - this.keyAt;
      if (sample <= this.maxSampleMs) this.add(sample);
      this.keyAt = null;
    }
    this.lastOutputAt = now;
  }

  /** A round trip measured another way (a confirmed prediction). */
  add(sample: number): void {
    this.samples.push(sample);
    if (this.samples.length > this.window) this.samples.shift();
  }

  get count(): number {
    return this.samples.length;
  }

  /** The `q` quantile (0–1) of the recent samples, or `null` before any. */
  quantile(q: number): number | null {
    if (this.samples.length === 0) return null;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
    return sorted[index] ?? null;
  }
}
