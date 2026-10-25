import { SESSION_FILE_MAX_BYTES, sessionFileOffered } from '@oppenheimer/shared/protocol';
import { useState } from 'react';
import type { FileRefusal } from '../lib/session-files';

/** One file a composer holds, keyed so two files with one name stay two chips. */
export interface HeldFile {
  id: string;
  file: File;
}

/**
 * The files a composer holds for its next message, and why the last one
 * offered was turned away. Every way in (the paperclip, a paste, a drop)
 * goes through `hold` and one rule, `sessionFileOffered`, shared with the
 * running session's terminal: an image, a PDF or text, or no type at all (a
 * pasted screenshot often has none; the API judges the bytes). A file is
 * refused for that, for size or for count, never silently dropped.
 */
export function useHeldFiles(max: number) {
  const [files, setFiles] = useState<HeldFile[]>([]);
  const [refusal, setRefusal] = useState<FileRefusal | null>(null);

  function hold(incoming: File[]) {
    const accepted: HeldFile[] = [];
    let reason: FileRefusal | null = null;
    for (const file of incoming) {
      if (!sessionFileOffered(file)) {
        reason = { reason: 'notSupported', name: file.name };
      } else if (file.size > SESSION_FILE_MAX_BYTES) {
        reason = { reason: 'tooLarge', name: file.name };
      } else if (files.length + accepted.length >= max) {
        reason = { reason: 'tooMany', max };
      } else {
        accepted.push({ id: crypto.randomUUID(), file });
      }
    }
    setRefusal(reason);
    if (accepted.length > 0) setFiles((held) => [...held, ...accepted]);
  }

  /** Takes these files off the message; with none named, all of them. */
  function release(ids?: readonly string[]) {
    setRefusal(null);
    setFiles((held) => (ids ? held.filter((file) => !ids.includes(file.id)) : []));
  }

  return { files, refusal, hold, release };
}
