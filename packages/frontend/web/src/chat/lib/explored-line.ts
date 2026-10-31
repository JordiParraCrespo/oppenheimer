/**
 * What an Explored line says after its heading, in either chat: each verb
 * with what it named, the verbs apart by a middle dot, a long list cut to
 * its first few and a count ("Read a.ts, b.ts · Searched cancel · Listed
 * src +2 more"). The parts are the product package's `exploredParts`; the
 * words are the caller's.
 */
export interface ExploredLinePart {
  verb: 'read' | 'search' | 'list';
  targets: readonly string[];
}

export interface ExploredLineWords {
  verb: Record<ExploredLinePart['verb'], string>;
  more: (count: number) => string;
}

/** How many things a verb names before the rest are a count. */
const SHOWN = 3;

export function exploredLine(parts: readonly ExploredLinePart[], words: ExploredLineWords): string {
  return parts
    .map(({ verb, targets }) => {
      const rest = targets.length - SHOWN;
      return [
        words.verb[verb],
        targets.slice(0, SHOWN).join(', '),
        rest > 0 ? words.more(rest) : '',
      ]
        .filter(Boolean)
        .join(' ');
    })
    .join(' · ');
}
