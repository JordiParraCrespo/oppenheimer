/** What the recorder bar draws: the last levels, oldest first, and how long it has been recording. */
export interface DictationReading {
  levels: readonly number[];
  elapsedMs: number;
}

const EMPTY: DictationReading = { levels: [], elapsedMs: 0 };

/**
 * The recording's live readings, outside React state: a level arrives about
 * twelve times a second, and only the bar that draws them subscribes, so the
 * composer and the chips around it never re-render while someone speaks.
 */
export class DictationMeter {
  private reading: DictationReading = EMPTY;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly keep = 48) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly read = (): DictationReading => this.reading;

  push(level: number, elapsedMs: number): void {
    const levels = [...this.reading.levels, level].slice(-this.keep);
    this.reading = { levels, elapsedMs };
    for (const listener of this.listeners) listener();
  }

  reset(): void {
    this.reading = EMPTY;
    for (const listener of this.listeners) listener();
  }
}

/** "0:07", "1:42". */
export function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
