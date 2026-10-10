/**
 * Guard clauses for protecting domain invariants.
 * Ported from the Domain-Driven Hexagon reference architecture.
 */
export class Guard {
  /** Accepts strings, numbers, booleans, objects and arrays. */
  static isEmpty(value: unknown): boolean {
    if (typeof value === 'number' || typeof value === 'boolean') {
      return false;
    }
    if (typeof value === 'undefined' || value === null) {
      return true;
    }
    if (value instanceof Date) {
      return false;
    }
    if (value instanceof Object && !Object.keys(value).length) {
      return true;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return true;
      }
      if (value.every((item) => Guard.isEmpty(item))) {
        return true;
      }
    }
    if (typeof value === 'string') {
      return value.trim().length === 0;
    }

    return false;
  }

  /** False for an empty value, rather than a throw: empty is out of any range. */
  static lengthIsBetween(
    value: number | string | Array<unknown>,
    min: number,
    max: number,
  ): boolean {
    if (Guard.isEmpty(value)) {
      return false;
    }
    const valueLength = typeof value === 'number' ? Number(value).toString().length : value.length;
    return valueLength >= min && valueLength <= max;
  }
}
