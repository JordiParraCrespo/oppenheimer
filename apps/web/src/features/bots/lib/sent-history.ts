/**
 * Where Up and Down have taken the composer in what you sent before:
 * `index` into the sent texts (newest first), `stash` the draft you had
 * before the first Up, which Down past the newest gives back.
 */
export interface SentHistoryPlace {
  index: number;
  stash: string;
}

/**
 * One step through what you sent: Up (`older`) to an older message, Down
 * (`newer`) to a newer one, then back to the draft you left. Up at
 * the oldest and Down with nothing recalled do nothing (`null`), so the key
 * keeps its ordinary meaning there.
 */
export function stepSentHistory(
  texts: readonly string[],
  place: SentHistoryPlace | null,
  draft: string,
  direction: 'older' | 'newer',
): { place: SentHistoryPlace | null; draft: string } | null {
  if (direction === 'older') {
    const index = place ? place.index + 1 : 0;
    const text = texts[index];
    if (text === undefined) return null;
    return { place: { index, stash: place?.stash ?? draft }, draft: text };
  }
  if (!place) return null;
  if (place.index === 0) return { place: null, draft: place.stash };
  const index = place.index - 1;
  return { place: { index, stash: place.stash }, draft: texts[index] ?? place.stash };
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
