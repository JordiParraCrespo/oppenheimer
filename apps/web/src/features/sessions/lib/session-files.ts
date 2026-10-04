import { SESSION_FILE_MEDIA_TYPES, SESSION_TEXT_TYPES } from '@oppenheimer/shared/protocol';

/**
 * Labels browsers give text that is not `text/*`: code, config, and the
 * `.ts` file Chrome and Safari call an MPEG stream. Sent, and judged by
 * their bytes like everything else.
 */
const TEXT_LIKE_TYPES = new Set([
  'application/javascript',
  'application/typescript',
  'application/x-typescript',
  'application/x-yaml',
  'application/yaml',
  'application/toml',
  'application/sql',
  'application/x-ndjson',
  'video/mp2t',
]);

/** Code a browser may label oddly or not at all; offered by the picker, sent on its name. */
const CODE_SUFFIXES = [
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
];

/** Name endings sent whatever the label says: the text types' and the code above. */
const TEXT_SUFFIXES = [...SESSION_TEXT_TYPES.flatMap((type) => type.suffixes), ...CODE_SUFFIXES];

/** Labels that are text in name but markup a browser runs; the API refuses them. */
const MARKUP_TYPES = new Set(['text/html', 'text/xml', 'image/svg+xml', 'application/xhtml+xml']);

/**
 * The one rule for which files a session takes, on every gesture and both
 * panes: a drop, a paste or the paperclip, on New session or in a running
 * session's terminal.
 *
 * Images, PDF and text, by the browser's label; or a file it does not label
 * at all (a pasted screenshot, a `.md` on some systems). The label is only
 * the first answer, to say no at once to a zip or a video rather than after
 * 5 MB of upload: the API judges the bytes either way, and refuses an
 * executable, a script or markup whatever it was called. Anything else is
 * refused here with a reason, never dropped in silence.
 */
export function isSessionFile(file: File): boolean {
  const type = file.type.split(';')[0]?.trim().toLowerCase() ?? '';
  if (type === '') return true;
  if (MARKUP_TYPES.has(type)) return false;
  return (
    (SESSION_FILE_MEDIA_TYPES as readonly string[]).includes(type) ||
    type.startsWith('text/') ||
    type.endsWith('+json') ||
    TEXT_LIKE_TYPES.has(type) ||
    // An OS may label a source file `application/x-ruby` or
    // `application/octet-stream`; a name the picker offers is still sent, and
    // the API reads its bytes.
    TEXT_SUFFIXES.some((suffix) => file.name.toLowerCase().endsWith(suffix))
  );
}

/** The files a session takes, in the order they came. */
export function sessionFilesIn(files: File[]): File[] {
  return files.filter(isSessionFile);
}

/**
 * What the paperclip's picker offers: the types and the name endings of the
 * files a session takes, and code a browser labels oddly. The picker is a
 * hint; `isSessionFile` and the API decide.
 */
export const SESSION_FILE_ACCEPT = [
  ...SESSION_FILE_MEDIA_TYPES,
  'text/*',
  '.jpg',
  '.jpeg',
  ...SESSION_TEXT_TYPES.flatMap((type) => type.suffixes),
  ...[
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
].join(',');

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
