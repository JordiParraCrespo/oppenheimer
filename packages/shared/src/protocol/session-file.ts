/**
 * What counts as a file a session can take, once, for both sides of the link.
 *
 * The control plane judges an upload by it before anything is sent, and the
 * runner judges the bytes it pulled by it again before anything is written.
 * The runner's copy is **generated** from this module
 * (`scripts/emit-session-file.cjs` →
 * `apps/runner/internal/sessions/domain/session_file.gen.go`). The text
 * verdict is code on both sides, so it has one owner, `isSessionText` here:
 * the emitter computes its answer on every case in `session-file.vectors.ts`
 * and writes them into a Go test the runner's `IsText` must pass, and the spec
 * here fails when either generated file is stale.
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
 * What a browser says about a file is a hint for clients only, and its
 * policy lives here too (`sessionFileOffered`, `SESSION_FILE_ACCEPT`), so the
 * console refuses a zip before uploading it by the same table the server
 * judges the bytes against.
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
  /**
   * One of the four images every runner takes. A runner that did not name
   * `session.files` is sent these rows and no others; a later image type is
   * not one of them until it says so.
   */
  image: boolean;
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
    image: true,
    extension: '.png',
    signatures: [[{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }]],
  },
  {
    mediaType: 'image/jpeg',
    image: true,
    extension: '.jpg',
    signatures: [[{ offset: 0, bytes: [0xff, 0xd8, 0xff] }]],
  },
  {
    mediaType: 'image/gif',
    image: true,
    extension: '.gif',
    signatures: [[{ offset: 0, bytes: ascii('GIF87a') }], [{ offset: 0, bytes: ascii('GIF89a') }]],
  },
  {
    mediaType: 'image/webp',
    image: true,
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
    image: false,
    extension: '.pdf',
    signatures: [[{ offset: 0, bytes: ascii('%PDF-') }]],
  },
] as const satisfies readonly SessionFileType[];

/**
 * The text types. `text/plain` is first and is what text with any other
 * label is saved as: a log, and code — a `.ts`, a `.py` — which is offered by
 * its ending and saved as `.txt`, because the agent reads it the same and the
 * host never runs it.
 */
export const SESSION_TEXT_TYPES = [
  {
    mediaType: 'text/plain',
    extension: '.txt',
    suffixes: [
      '.txt',
      '.log',
      '.text',
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.py',
      '.go',
      '.rs',
      '.java',
      '.rb',
      '.yaml',
      '.yml',
      '.toml',
      '.sql',
    ],
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
export const SESSION_IMAGE_MEDIA_TYPES = SESSION_FILE_TYPES.filter((type) => type.image).map(
  (type) => type.mediaType,
) as readonly SessionFileMediaType[];

/** Whether a runner without `session.files` takes this type. */
export function isSessionImageType(mediaType: string): boolean {
  return (SESSION_IMAGE_MEDIA_TYPES as readonly string[]).includes(mediaType);
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
export const SESSION_TEXT_CONTROL_ALLOWED = [0x09, 0x0a, 0x0c, 0x0d] as const;

/** How many bytes of an opening are compared, after a BOM and ASCII whitespace. */
export const SESSION_TEXT_OPENING_BYTES = 16;

interface Utf8Decoder {
  decode(bytes: Uint8Array): string;
}

/**
 * The platform's strict UTF-8 decoder (Node and every browser have one; this
 * package's `lib` just does not type it). `fatal` refuses what Go's
 * `utf8.Valid` refuses: overlong forms, surrogates, past U+10FFFF.
 */
function strictUtf8(): Utf8Decoder {
  const { TextDecoder } = globalThis as unknown as {
    TextDecoder: new (label: string, options: { fatal: boolean }) => Utf8Decoder;
  };
  return new TextDecoder('utf-8', { fatal: true });
}

/**
 * The bytes text opens with, as compared with the refused openings: after a
 * UTF-8 byte-order mark and ASCII whitespace, the first
 * `SESSION_TEXT_OPENING_BYTES` bytes, A–Z lowered. Bytes, never characters,
 * so a multibyte character on the cut reads the same on both sides.
 */
function openingOf(bytes: Uint8Array): string {
  let start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  while (start < bytes.length && [0x20, 0x09, 0x0a, 0x0c, 0x0d].includes(bytes[start] as number)) {
    start += 1;
  }
  let opening = '';
  for (const byte of bytes.subarray(start, start + SESSION_TEXT_OPENING_BYTES)) {
    opening += String.fromCharCode(byte >= 0x41 && byte <= 0x5a ? byte + 0x20 : byte);
  }
  return opening;
}

/**
 * Whether bytes are text a session takes (see the module's note). This is the
 * verdict's one owner: the runner's `IsText` is held to it by the vectors in
 * `session-file.vectors.ts`, generated into a Go test.
 */
export function isSessionText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  for (const byte of bytes) {
    const allowed = (SESSION_TEXT_CONTROL_ALLOWED as readonly number[]).includes(byte);
    if ((byte < 0x20 && !allowed) || byte === 0x7f) return false;
  }
  try {
    strictUtf8().decode(bytes);
  } catch {
    return false;
  }
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
 * Labels browsers give text that is not `text/*` (code, config, and the
 * `.ts` Chrome and Safari call an MPEG stream). Offered, and judged by their
 * bytes like everything else.
 */
export const SESSION_TEXT_LABELS = [
  'application/javascript',
  'application/typescript',
  'application/x-typescript',
  'application/x-yaml',
  'application/yaml',
  'application/toml',
  'application/sql',
  'application/x-ndjson',
  'video/mp2t',
] as const;

/** Labels that say text but mean markup a browser runs: refused before any upload. */
export const SESSION_REFUSED_LABELS = [
  'text/html',
  'text/xml',
  'image/svg+xml',
  'application/xhtml+xml',
] as const;

/**
 * Whether a client should send a file at all, from what the browser says
 * about it — the first answer, so a zip or a video is refused before 5 MB of
 * upload. Never the last: the bytes are judged by `sniffSessionFile` on the
 * server whatever this said. No label at all (a pasted screenshot) is sent; a
 * markup label is not, even with a text ending; otherwise a type in the
 * table, any other `text/*` or `+json`, a label in `SESSION_TEXT_LABELS`, or
 * a name ending a text type lists (an OS may call a `.rb`
 * `application/x-ruby`, or anything `application/octet-stream`).
 */
export function sessionFileOffered(file: { type: string; name: string }): boolean {
  const label = file.type.split(';')[0]?.trim().toLowerCase() ?? '';
  if (label === '') return true;
  if ((SESSION_REFUSED_LABELS as readonly string[]).includes(label)) return false;
  const name = file.name.toLowerCase();
  return (
    (SESSION_FILE_MEDIA_TYPES as readonly string[]).includes(label) ||
    label.startsWith('text/') ||
    label.endsWith('+json') ||
    (SESSION_TEXT_LABELS as readonly string[]).includes(label) ||
    SESSION_TEXT_TYPES.some((type) =>
      (type.suffixes as readonly string[]).some((suffix) => name.endsWith(suffix)),
    )
  );
}

/** What a file picker offers: the table's types and endings, and any `text/*`. */
export const SESSION_FILE_ACCEPT = [
  ...SESSION_FILE_MEDIA_TYPES,
  'text/*',
  '.jpg',
  '.jpeg',
  ...SESSION_TEXT_TYPES.flatMap((type) => type.suffixes),
].join(',');

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
