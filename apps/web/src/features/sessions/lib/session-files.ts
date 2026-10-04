import { sessionFileOffered } from '@oppenheimer/shared/protocol';

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
