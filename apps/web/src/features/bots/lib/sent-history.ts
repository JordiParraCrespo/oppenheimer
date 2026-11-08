/**
 * Where Up and Down have taken the composer in what you sent before:
 * `index` into the sent texts (newest first, `-1` the draft you had before
 * the first Up), `base`, the text the field was given on arriving there, and
 * `edits`, what the field held at each place when it stepped away from it.
 * Nothing written is lost by stepping, and the field still shows an unedited
 * recall while it reads `base`.
 */
export interface SentHistoryPlace {
  index: number;
  base: string;
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
): SentHistoryPlace | null {
  const from = place?.index ?? -1;
  const to = direction === 'older' ? from + 1 : from - 1;
  if (to < -1 || to >= texts.length) return null;
  const edits = { ...place?.edits, [from]: draft };
  return { index: to, base: edits[to] ?? texts[to] ?? '', edits };
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
