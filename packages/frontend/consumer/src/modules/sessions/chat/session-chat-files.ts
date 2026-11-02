import type { ChatStep, ChatTurn } from './session-chat';

/** The entry the runner adds for a file the agent shared (`runner sessions send-file`). */
export const SHARED_ENTRY = 'oppenheimer.file';

/**
 * A file the agent showed the person, as its host sent it: what it is and
 * where it is on the host, the agent's line about it, and what fit on the
 * link — an image's preview, a small text file's text, or neither, when the
 * file is too large or of a kind the chat cannot show. The file stays on
 * the host.
 */
export interface ChatSharedFile {
  id: string;
  name: string;
  /** Its absolute path on the host. */
  path: string;
  size: number;
  mediaType: string;
  caption: string | null;
  /** The image's JPEG preview, as a `data:` URL an `img` takes. */
  preview: string | null;
  text: string | null;
  at: Date | null;
}

type Loose = Record<string, unknown>;

function record(value: unknown): Loose | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Loose)
    : null;
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** The preview's data, only as base64 of a JPEG: what an `img` shows and never runs. */
function previewOf(value: unknown): string | null {
  const source = record(value);
  const data = string(source?.data);
  if (source?.type !== 'base64' || source.media_type !== 'image/jpeg' || !data) return null;
  return /^[A-Za-z0-9+/]+=*$/.test(data) ? `data:image/jpeg;base64,${data}` : null;
}

/** A shared-file entry as the chat holds it; none for one it cannot read. */
export function sharedFileOf(value: unknown): ChatSharedFile | null {
  const entry = record(value);
  const id = string(entry?.id);
  const name = string(entry?.name);
  const path = string(entry?.path);
  if (entry?.type !== SHARED_ENTRY || !id || !name || !path) return null;
  const at = string(entry.timestamp) ? new Date(String(entry.timestamp)) : null;
  return {
    id,
    name,
    path,
    size: typeof entry.size === 'number' && entry.size >= 0 ? entry.size : 0,
    mediaType: string(entry.media_type) ?? 'application/octet-stream',
    caption: string(entry.caption),
    preview: previewOf(entry.preview),
    text: typeof entry.text === 'string' ? entry.text : null,
    at: at && !Number.isNaN(at.getTime()) ? at : null,
  };
}

/**
 * The turns with each shared file placed where it was shared: in the last
 * turn that had started by then, after the steps written before it. A file
 * with no time, or shared before the first turn, goes in the first; with no
 * turns yet, it waits for one. Only the turns that take a file are new
 * objects, so the closed turns the chat keeps by identity stay as they were.
 */
export function withSharedFiles(turns: ChatTurn[], files: readonly ChatSharedFile[]): ChatTurn[] {
  if (files.length === 0 || turns.length === 0) return turns;
  const byTurn = new Map<number, ChatSharedFile[]>();
  for (const file of files) {
    let index = 0;
    if (file.at) {
      const time = file.at.getTime();
      for (const [at, turn] of turns.entries()) {
        if (turn.startedAt && turn.startedAt.getTime() <= time) index = at;
      }
    }
    byTurn.set(index, [...(byTurn.get(index) ?? []), file]);
  }
  return turns.map((turn, index) => {
    const placed = byTurn.get(index);
    if (!placed) return turn;
    const steps = [...turn.steps];
    for (const file of placed) {
      const step: ChatStep = { kind: 'file', id: `file:${file.id}`, at: file.at, file };
      const time = file.at?.getTime() ?? Number.POSITIVE_INFINITY;
      let at = steps.length;
      while (at > 0 && (steps[at - 1]?.at?.getTime() ?? 0) > time) at -= 1;
      steps.splice(at, 0, step);
    }
    const lastAt = placed.reduce<Date | null>(
      (latest, file) => (file.at && (!latest || file.at > latest) ? file.at : latest),
      turn.lastAt,
    );
    return { ...turn, steps, lastAt };
  });
}
