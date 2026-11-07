/**
 * Texts kept under `prefix + id` on this device, in memory and in the
 * browser's storage: a half-written message that should outlive leaving its
 * screen or reloading the page. An empty text is forgotten. Storage is a
 * convenience: when it is blocked (a private window, cleared site data) a
 * text lives as long as the tab.
 *
 * A store outside React, so whoever writes a text (a keystroke, a filled-in
 * suggestion, a send that consumed it) need not be mounted beside the field
 * that reads it (`useStoredText`).
 */
export interface StoredTexts {
  /** The text kept for `id`: what was last written, or what this browser kept. */
  read(id: string): string;
  /** Writes the text for `id`; an empty one is forgotten. */
  write(id: string, text: string): void;
  /** Called with the id whenever a text changes; returns the unsubscribe. */
  subscribe(listener: (id: string) => void): () => void;
}

export function storedTexts(prefix: string): StoredTexts {
  const texts = new Map<string, string>();
  const listeners = new Set<(id: string) => void>();

  function stored(id: string): string {
    try {
      return globalThis.localStorage?.getItem(prefix + id) ?? '';
    } catch {
      return '';
    }
  }

  function store(id: string, text: string): void {
    try {
      if (text) globalThis.localStorage?.setItem(prefix + id, text);
      else globalThis.localStorage?.removeItem(prefix + id);
    } catch {
      // Blocked storage keeps the text in memory only.
    }
  }

  function read(id: string): string {
    let text = texts.get(id);
    if (text === undefined) {
      text = stored(id);
      texts.set(id, text);
    }
    return text;
  }

  return {
    read,
    write(id, text) {
      if (read(id) === text) return;
      texts.set(id, text);
      store(id, text);
      for (const listener of listeners) listener(id);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
