/**
 * What counts as a file a session can take, once, for both sides of the link.
 *
 * The control plane judges an upload by it before anything is sent, and the
 * runner judges the bytes it pulled by it again before anything is written.
 * The runner's copy is **generated** from this module
 * (`scripts/emit-session-file.cjs` →
 * `apps/runner/internal/sessions/domain/session_file.gen.go`), so the two can
 * only disagree about what a file is when somebody forgets to build.
 *
 * It is an allowlist, and a file is known by its bytes, never by the label a
 * browser gave it nor by its name:
 *
 * - **Binary types** (the images, PDF) by their magic bytes. A type matches
 *   when **any** of its signatures does; a signature is every one of its parts
 *   matching at its offset.
 * - **Text** by being text: valid UTF-8 with no control bytes but tab, line
 *   feed, form feed and carriage return, that neither opens with `#!` (a
 *   script the host could run) nor as markup a browser would run (HTML, SVG,
 *   XML). The label only picks which of the text types it is saved as, and
 *   every one of those is inert on disk.
 *
 * Everything else is refused: executables (ELF, Mach-O, PE), archives, SVG,
 * HTML, and any binary the table does not name. The runner names each file
 * itself (`<uuid><extension from here>`), so no name a person chose reaches the
 * host's disk or a shell.
 *
 * The wire still calls these `images` (`session.image`, `images[]`): a field
 * name, kept so a runner and a control plane of different ages agree. Which
 * types a given runner takes is its `hello`: one without `session.files` is
 * sent images only (`SESSION_IMAGE_MEDIA_TYPES`).
 */

interface SignaturePart {
  offset: number;
  bytes: readonly number[];
}

export interface SessionFileType {
  mediaType: string;
  /** What the runner names the file with, so the agent reads the path as what it is. */
  extension: string;
  signatures: readonly (readonly SignaturePart[])[];
}

export interface SessionTextType {
  mediaType: string;
  extension: string;
  /** Lower-case name endings a browser may leave unlabelled ("notes.md" arrives as ""). */
  suffixes: readonly string[];
}

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

/** The binary types, known by their magic bytes, in the order they are tried. */
export const SESSION_FILE_TYPES = [
  {
    mediaType: 'image/png',
    extension: '.png',
    signatures: [[{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }]],
  },
  {
    mediaType: 'image/jpeg',
    extension: '.jpg',
    signatures: [[{ offset: 0, bytes: [0xff, 0xd8, 0xff] }]],
  },
  {
    mediaType: 'image/gif',
    extension: '.gif',
    signatures: [[{ offset: 0, bytes: ascii('GIF87a') }], [{ offset: 0, bytes: ascii('GIF89a') }]],
  },
  {
    mediaType: 'image/webp',
    extension: '.webp',
    signatures: [
      [
        { offset: 0, bytes: ascii('RIFF') },
        { offset: 8, bytes: ascii('WEBP') },
      ],
    ],
  },
  {
    mediaType: 'application/pdf',
    extension: '.pdf',
    signatures: [[{ offset: 0, bytes: ascii('%PDF-') }]],
  },
] as const satisfies readonly SessionFileType[];

/**
 * The text types. `text/plain` is first and is what text with any other
 * label (a log, a `.ts` a browser calls `video/mp2t`) is saved as.
 */
export const SESSION_TEXT_TYPES = [
  {
    mediaType: 'text/plain',
    extension: '.txt',
    suffixes: ['.txt', '.log', '.text'],
  },
  { mediaType: 'text/markdown', extension: '.md', suffixes: ['.md', '.markdown'] },
  { mediaType: 'text/csv', extension: '.csv', suffixes: ['.csv'] },
  { mediaType: 'application/json', extension: '.json', suffixes: ['.json'] },
] as const satisfies readonly SessionTextType[];

export type SessionFileMediaType =
  | (typeof SESSION_FILE_TYPES)[number]['mediaType']
  | (typeof SESSION_TEXT_TYPES)[number]['mediaType'];

/** Every type a session takes, binary then text. */
export const SESSION_FILE_MEDIA_TYPES = [
  ...SESSION_FILE_TYPES.map((type) => type.mediaType),
  ...SESSION_TEXT_TYPES.map((type) => type.mediaType),
] as readonly SessionFileMediaType[];

/** The types a runner without `session.files` takes: the images it was built for. */
export const SESSION_IMAGE_MEDIA_TYPES = SESSION_FILE_TYPES.map((type) => type.mediaType).filter(
  (mediaType) => mediaType.startsWith('image/'),
) as readonly SessionFileMediaType[];

/** Whether a runner without `session.files` takes this type. */
export function isSessionImageType(mediaType: string): boolean {
  return (SESSION_IMAGE_MEDIA_TYPES as readonly string[]).includes(mediaType);
}

/**
 * Whether a runner whose `hello` named `capabilities` can save every one of
 * these types: any, once it named `session.files`; the images alone before.
 * Whether it takes files at all is its own capability (`session.image`,
 * `session.create.images`), asked separately.
 */
export function runnerTakesFiles(
  capabilities: readonly string[],
  mediaTypes: readonly string[],
): boolean {
  return capabilities.includes('session.files') || mediaTypes.every(isSessionImageType);
}

/**
 * The largest file a session takes. It is the upload's cap — the control
 * plane refuses more before storing it, and the runner reads no more than
 * this when it pulls one — not a property of the link, which never carries
 * the bytes.
 */
export const SESSION_FILE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * How many files a session's first task may carry. Each is pulled before the
 * agent starts, so the cap bounds how long a launch can wait on downloads.
 */
export const SESSION_CREATE_MAX_FILES = 5;

/**
 * Openings that make text something a program runs rather than reads: a
 * script's interpreter line, and markup a browser executes. Compared after a
 * byte-order mark and leading whitespace, case-insensitively.
 */
export const SESSION_TEXT_REFUSED_OPENINGS = [
  '#!',
  '<!doctype',
  '<html',
  '<head',
  '<body',
  '<script',
  '<svg',
  '<?xml',
] as const;

/** Tab, line feed, form feed, carriage return: the only control bytes text may hold. */
const TEXT_CONTROL_ALLOWED = new Set([0x09, 0x0a, 0x0c, 0x0d]);

/**
 * Whether bytes are well-formed UTF-8: no overlong forms, no surrogates,
 * nothing past U+10FFFF — what Go's `utf8.Valid` accepts, written out because
 * this package runs where `TextDecoder` is not typed.
 */
function isUtf8(bytes: Uint8Array): boolean {
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i] as number;
    if (b < 0x80) {
      i += 1;
      continue;
    }
    let need: number;
    let min: number;
    let max = 0xbf;
    if (b >= 0xc2 && b <= 0xdf) {
      need = 1;
      min = 0x80;
    } else if (b >= 0xe0 && b <= 0xef) {
      need = 2;
      min = b === 0xe0 ? 0xa0 : 0x80;
      if (b === 0xed) max = 0x9f;
    } else if (b >= 0xf0 && b <= 0xf4) {
      need = 3;
      min = b === 0xf0 ? 0x90 : 0x80;
      if (b === 0xf4) max = 0x8f;
    } else {
      return false;
    }
    if (i + need >= bytes.length) return false;
    const second = bytes[i + 1] as number;
    if (second < min || second > max) return false;
    for (let k = 2; k <= need; k++) {
      const next = bytes[i + k] as number;
      if (next < 0x80 || next > 0xbf) return false;
    }
    i += need + 1;
  }
  return true;
}

/** The first characters of text, for the opening check: ASCII is all it compares. */
function openingOf(bytes: Uint8Array): string {
  let start = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
  // ASCII whitespace only, as the runner trims it, so the two agree byte for byte.
  while (start < bytes.length && [0x20, 0x09, 0x0a, 0x0c, 0x0d].includes(bytes[start] as number)) {
    start += 1;
  }
  let opening = '';
  for (let i = start; i < bytes.length && opening.length < 16; i++) {
    opening += String.fromCharCode(bytes[i] as number);
  }
  return opening.toLowerCase();
}

/** Whether bytes are text a session takes (see the module's note). */
export function isSessionText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  for (const byte of bytes) {
    if ((byte < 0x20 && !TEXT_CONTROL_ALLOWED.has(byte)) || byte === 0x7f) return false;
  }
  if (!isUtf8(bytes)) return false;
  const opening = openingOf(bytes);
  return !SESSION_TEXT_REFUSED_OPENINGS.some((refused) => opening.startsWith(refused));
}

/** What the browser said about a file: its label and its name. Neither is trusted. */
export interface SessionFileHint {
  mediaType?: string;
  fileName?: string;
}

/**
 * Which text type a text file is saved as: the one its label or its name
 * ending names, else `text/plain`. Only ever one of the inert text types.
 */
export function sessionTextTypeFor(hint: SessionFileHint = {}): SessionFileMediaType {
  const label = hint.mediaType?.split(';')[0]?.trim().toLowerCase();
  const name = hint.fileName?.toLowerCase() ?? '';
  const type =
    SESSION_TEXT_TYPES.find((t) => t.mediaType === label) ??
    SESSION_TEXT_TYPES.find((t) => t.suffixes.some((suffix) => name.endsWith(suffix)));
  return type?.mediaType ?? 'text/plain';
}

/**
 * The type a file's bytes declare, or `null` when they declare none a session
 * takes. The hint is read only for text, and only to pick which text type.
 */
export function sniffSessionFile(
  bytes: Uint8Array,
  hint?: SessionFileHint,
): SessionFileMediaType | null {
  const matches = (part: SignaturePart) =>
    part.bytes.every((byte, i) => bytes[part.offset + i] === byte);
  for (const type of SESSION_FILE_TYPES) {
    if (type.signatures.some((signature) => signature.every(matches))) return type.mediaType;
  }
  return isSessionText(bytes) ? sessionTextTypeFor(hint) : null;
}

/**
 * Whether bytes are the type they are said to be: what the runner asks of a
 * file it pulled, with the type the control plane parked it under.
 */
export function sessionFileIs(bytes: Uint8Array, mediaType: string): boolean {
  const text = SESSION_TEXT_TYPES.some((t) => t.mediaType === mediaType);
  return text ? isSessionText(bytes) : sniffSessionFile(bytes) === mediaType;
}

/**
 * The two rules any list of files attached to a first task keeps, on the HTTP
 * body and on the wire alike: they ride a task — with no prompt there is
 * nothing to read them with — and no file is named twice.
 */
export function attachedFilesAreValid(
  prompt: string | undefined,
  ids: readonly string[] | undefined,
): boolean {
  if (!ids?.length) return true;
  return prompt !== undefined && prompt.length > 0 && new Set(ids).size === ids.length;
}
