/**
 * Where a task sits in its column: a fractional index, a string that sorts
 * between its neighbours byte by byte (the column is `COLLATE "C"`). Moving a
 * task writes its own key and nobody else's, and there is always a key between
 * two others, so a column is never renumbered.
 *
 * The keys are base-62 digit strings read as a fraction in (0, 1): `''` is the
 * lower bound and `null` the upper one. None ends in `0`, which is what keeps a
 * key strictly between two others always findable.
 */
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** A key strictly between `lower` (`''` for none) and `upper` (`null` for none). */
export function rankBetween(lower: string, upper: string | null): string {
  if (upper !== null && lower >= upper) {
    throw new RangeError(`No rank between ${lower} and ${upper}: they are out of order`);
  }
  if (lower.endsWith('0') || upper?.endsWith('0')) {
    throw new RangeError('A rank never ends in 0');
  }
  return midpoint(lower, upper);
}

/** Whether `value` is a key this policy could have produced. */
export function isRank(value: string): boolean {
  return value.length > 0 && !value.endsWith('0') && [...value].every((c) => DIGITS.includes(c));
}

function midpoint(lower: string, upper: string | null): string {
  if (upper !== null) {
    // The shared prefix is kept, and the midpoint taken of what follows it.
    let shared = 0;
    while ((lower[shared] ?? '0') === upper[shared]) shared += 1;
    if (shared > 0) {
      return upper.slice(0, shared) + midpoint(lower.slice(shared), upper.slice(shared));
    }
  }
  const low = lower ? DIGITS.indexOf(lower[0]) : 0;
  const high = upper !== null ? DIGITS.indexOf(upper[0]) : DIGITS.length;
  if (high - low > 1) return DIGITS[Math.round((low + high) / 2)];
  // Adjacent first digits: the upper key's first digit alone is between them
  // when the upper key has more, otherwise go one digit deeper after `lower`'s.
  if (upper !== null && upper.length > 1) return upper.slice(0, 1);
  return DIGITS[low] + midpoint(lower.slice(1), null);
}
