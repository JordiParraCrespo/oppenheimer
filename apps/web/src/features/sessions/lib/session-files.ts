import { SESSION_CREATE_MAX_FILES, sessionFileOffered } from '@oppenheimer/shared/protocol';
import type { TFunction } from 'i18next';

/** How many files one chat message carries: as many as a first task does. */
export const CHAT_MESSAGE_MAX_FILES = SESSION_CREATE_MAX_FILES;

/**
 * The files a session takes, in the order they came, on every gesture and
 * both panes: a drop, a paste or the paperclip, on New session or in a
 * running session's terminal. Which files is the shared label policy,
 * `sessionFileOffered`, kept next to the table of types; the API judges the
 * bytes either way.
 */
export function sessionFilesIn(files: File[]): File[] {
  return files.filter(sessionFileOffered);
}

/**
 * Every file a paste or a drop carries. The clipboard lists a pasted
 * screenshot under `items`, sometimes with an empty `files`; a drop from the
 * file manager lists its files under `files`, sometimes with no items. Both
 * are read, the items first, without counting a file twice.
 */
export function filesIn(transfer: DataTransfer | null): File[] {
  if (!transfer) return [];
  const fromItems = Array.from(transfer.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  return fromItems.length > 0 ? fromItems : Array.from(transfer.files ?? []);
}

/** Why the last file offered to a composer was not taken. */
export type FileRefusal =
  | { reason: 'notSupported' | 'tooLarge'; name: string }
  | { reason: 'tooMany'; max: number };

/**
 * A refusal as the composer that turned the file away says it: each
 * composer has its own copy (a first task, a message), and one map from the
 * reason to its line, so a new reason cannot be said by one and not the other.
 */
export function refusalText(
  refusal: FileRefusal,
  t: TFunction,
  composer: 'sessions.new.composer' | 'sessions.chat.composer',
): string {
  switch (refusal.reason) {
    case 'tooMany':
      return t(`${composer}.attachTooMany`, { max: refusal.max });
    case 'tooLarge':
      return t(`${composer}.attachTooLarge`, { name: refusal.name });
    case 'notSupported':
      return t(`${composer}.attachNotSupported`, { name: refusal.name });
  }
}
