/**
 * A map that keeps at most `max` entries, forgetting the one set longest ago
 * when a new key would pass it, and handing what it forgets to `onEvict`.
 * For per-process memory a request path fills (who was judged, which agent a
 * port uses): a bound, not a cache policy, so a burst of readers costs a
 * fixed amount and the next request of a forgotten one simply builds it again.
 */
export class BoundedMap<K, V> {
  private readonly entries = new Map<K, V>();

  constructor(
    private readonly max: number,
    private readonly onEvict: (value: V) => void = () => {},
  ) {}

  get(key: K): V | undefined {
    return this.entries.get(key);
  }

  set(key: K, value: V): void {
    if (!this.entries.has(key) && this.entries.size >= this.max) {
      const [oldest] = this.entries;
      if (oldest) {
        this.entries.delete(oldest[0]);
        this.onEvict(oldest[1]);
      }
    }
    this.entries.set(key, value);
  }

  delete(key: K): void {
    this.entries.delete(key);
  }

  values(): IterableIterator<V> {
    return this.entries.values();
  }
}
