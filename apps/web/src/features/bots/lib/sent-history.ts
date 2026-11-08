/**
 * Where Up and Down have taken the composer in what you sent before:
 * `index` into the sent texts (newest first), and `edits`, what the field
 * held at each place when it stepped away from it, `-1` being the draft you
 * had before the first Up. Nothing written is lost by stepping.
 */
export interface SentHistoryPlace {
  index: number;
  edits: Readonly<Record<number, string>>;
}

/**
 * One step through what you sent, the way readline steps: Up (`older`) to an
 * older message, Down (`newer`) to a newer one, then back to your draft. The
 * field's text is kept at the place it leaves, and a place you come back to
 * shows what you left there, your draft included, until a send ends the walk.
 * Up at the oldest and Down at your draft do nothing (`null`), so the key
 * keeps its ordinary meaning there.
 */
export function stepSentHistory(
  texts: readonly string[],
  place: SentHistoryPlace | null,
  draft: string,
  direction: 'older' | 'newer',
): { place: SentHistoryPlace; draft: string } | null {
  const from = place?.index ?? -1;
  const to = direction === 'older' ? from + 1 : from - 1;
  if (to < -1 || to >= texts.length) return null;
  const edits = { ...place?.edits, [from]: draft };
  const next = edits[to] ?? texts[to] ?? '';
  return { place: { index: to, edits }, draft: next };
}

/**
 * Whether an arrow should step through what you sent rather than move the
 * caret: Up with the caret on the field's first line, Down on its last, no
 * text selected. A recalled message you have not edited steps either way,
 * so pressing Up again goes on back past a message of several lines.
 */
export function arrowStepsHistory(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  direction: 'older' | 'newer',
  recalled: boolean,
): boolean {
  if (recalled) return true;
  if (selectionStart !== selectionEnd) return false;
  return direction === 'older'
    ? !value.slice(0, selectionStart).includes('\n')
    : !value.slice(selectionEnd).includes('\n');
}
