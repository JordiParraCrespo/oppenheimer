/**
 * What the profile use cases need from avatar storage, in their own words.
 *
 * They deal in "the value to persist on the user row" and "something a browser
 * can load" — never in buckets, keys or signed URLs. Which of those a stored
 * value is, and how long a signature lives, is the adapter's business.
 */
export interface AvatarStoragePort {
  /**
   * Validate and store an avatar, returning the value to persist.
   *
   * Rejects an unaccepted media type or an oversized file with a
   * `ProfileErrors` entry, so a handler never has to pre-validate.
   */
  store(userId: string, file: Buffer, mimeType: string, size: number): Promise<string>;

  /**
   * Remove a stored avatar. Best-effort: clearing an avatar that is already
   * gone, or one that was never ours to store, is not a failure.
   */
  remove(key: string | null): Promise<void>;

  /** Turn a stored value into something a client can load, or `null`. */
  resolveUrl(stored: string | null): Promise<string | null>;
}
