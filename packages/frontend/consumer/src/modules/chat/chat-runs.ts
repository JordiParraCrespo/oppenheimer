/**
 * How a chat folds the calls an agent made into runs, whatever drew them (a
 * session's Claude Code transcript, a bot's trace): a stretch of calls that
 * only look around is one Explored run that names what it looked at, the way
 * Codex folds its exploring calls (`exec_cell/model.rs`), and a stretch of
 * the rest is a run of its own. Which calls look is the caller's: it hands
 * `cutRuns` a predicate and `exploredParts` what each call looked at.
 */

/** What a call that only looks did. */
export type ExploreVerb = 'read' | 'search' | 'list';

/** One thing a call looked at: `key` says when two are the same, `label` how the line names it. */
export interface ExploreTarget {
  verb: ExploreVerb;
  key: string;
  label: string;
}

/** A stretch of calls of one sort, in order. */
export interface CallRun<T> {
  explored: boolean;
  items: T[];
}

/** The calls cut wherever they turn from looking around to doing something else, and back. */
export function cutRuns<T>(items: readonly T[], explores: (item: T) => boolean): CallRun<T>[] {
  const runs: CallRun<T>[] = [];
  for (const item of items) {
    const explored = explores(item);
    const previous = runs.at(-1);
    if (previous?.explored === explored) previous.items.push(item);
    else runs.push({ explored, items: [item] });
  }
  return runs;
}

/** One verb of an Explored line and what it names, each once, in the order first seen. */
export interface ExploredPart {
  verb: ExploreVerb;
  targets: string[];
}

/**
 * What a run of exploring calls looked at, by verb in the order each verb
 * first came: a thing looked at twice (a file read by two calls) named once.
 */
export function exploredParts<T>(
  items: readonly T[],
  targetsOf: (item: T) => readonly ExploreTarget[] | null,
): ExploredPart[] {
  const parts = new Map<ExploreVerb, Map<string, string>>();
  for (const item of items) {
    for (const { verb, key, label } of targetsOf(item) ?? []) {
      const seen = parts.get(verb) ?? new Map<string, string>();
      if (label && !seen.has(key)) seen.set(key, label);
      parts.set(verb, seen);
    }
  }
  return [...parts].map(([verb, targets]) => ({ verb, targets: [...targets.values()] }));
}
