/**
 * A placeholder has the shape of what replaces it: the real container, its
 * static labels written, a bar at the height of each line still to come
 * (`.agents/rules/frontend-ui.md`, "A placeholder has the shape of what
 * replaces it"). The one shape a script can tell is wrong is the slab: a
 * `Skeleton` that is a block 64px tall or more (`h-16` and up, `size-16`,
 * `h-[64px]`) or one that fills its frame (`flex-1`, `h-full`, `min-h-*`),
 * wherever it is drawn. That is a guess at a height, and the page jumps by
 * the difference when the data lands.
 *
 * A placeholder that really is one block (a terminal before its first frame,
 * a field at its own height) says so on the lines above it, or inside its
 * `QueryState.Pending`: `{/* A block stands in here: <why> *\/}`.
 *
 * A tripwire over the source text, not a parser, like `query-state-slots.mjs`:
 * whether a named placeholder component has the right shape is the audit's
 * call (`/frontend-audit`, `U7`). The cases are `skeleton-shape.test.mjs`.
 */

/** Tall enough to be a block rather than a line or a row: 16 spacing units, 64px. */
const SLAB_UNITS = 16;
const PENDING = /<QueryState\.Pending>([\s\S]*?)<\/QueryState\.Pending>/g;
/** A `Skeleton` tag, its `{…}` attributes read whole, so a `>` inside one does not end it. */
const SKELETON = /<Skeleton\b(?:[^>{}]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*>/g;
const EXCUSED = /A block stands in here: \S/;

/** Comments blanked rather than cut, so a reported line is the file's line. */
const blankComments = (source) =>
  source.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|(?<![:'"`\\])\/\/.*$/gm, (comment) =>
    comment.replace(/[^\n]/g, ' '),
  );

/**
 * A tag's classes: its `className` string, or the static strings of the
 * expression it is given (a `cn(…)`'s arguments, a template literal's text).
 * `dynamic` says part of the list is only known at run time (a `${…}`), so a
 * height may be in it.
 */
function classesOf(tag) {
  const quoted = /className="([^"]*)"/.exec(tag);
  if (quoted) return { classes: quoted[1].split(/\s+/).filter(Boolean), dynamic: false };
  const start = tag.indexOf('className={');
  if (start === -1) return { classes: [], dynamic: false };
  let depth = 0;
  let end = start + 'className='.length;
  for (; end < tag.length; end += 1) {
    if (tag[end] === '{') depth += 1;
    if (tag[end] === '}' && --depth === 0) break;
  }
  const expression = tag.slice(start + 'className={'.length, end);
  const templates = [...expression.matchAll(/`([^`]*)`/g)].map((m) => m[1]);
  const dynamic = templates.some((text) => text.includes('${'));
  const literal = [
    ...templates.map((text) => text.replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, ' ')),
    ...[...expression.replace(/`[^`]*`/g, ' ').matchAll(/'([^']*)'|"([^"]*)"/g)].map(
      (m) => m[1] ?? m[2],
    ),
  ].join(' ');
  return { classes: literal.split(/\s+/).filter(Boolean), dynamic };
}

/** The height a class sets, in spacing units, or null when it sets none. */
function unitsOf(name) {
  const units = /^(?:min-h|h|size)-(\d+(?:\.\d+)?)$/.exec(name);
  if (units) return Number(units[1]);
  const pixels = /^(?:min-h|h|size)-\[(\d+)px\]$/.exec(name);
  return pixels ? Number(pixels[1]) / 4 : null;
}

/**
 * Whether a `Skeleton` tag's classes make it a block rather than a bar: a
 * height (or floor) of 64px or more, or a frame it fills with no height of
 * its own (`flex-1` beside an `h-4` is a bar filling its row, not a block).
 * A list with a run-time part is judged only on the heights it states.
 */
function isSlab(tag) {
  const { classes: names, dynamic } = classesOf(tag);
  const classes = names.map((name) => name.replace(/^[a-z0-9-]+:/, ''));
  const heights = classes.map(unitsOf).filter((units) => units !== null);
  if (heights.some((units) => units >= SLAB_UNITS)) return true;
  if (dynamic || heights.some((units) => units > 0)) return false;
  return classes.some(
    (name) => name === 'flex-1' || name === 'h-full' || name.startsWith('min-h-'),
  );
}

/** Lines above a block that its excuse may sit on. */
const EXCUSE_REACH = 3;

/**
 * Each slab in `source`, as `{ line, message }`: every `Skeleton` tall enough
 * to be a block, wherever it is drawn (a `QueryState.Pending`, a named
 * `<View>Skeleton`, a `fallback`, a ternary while a read is pending). The
 * container around it does not excuse it: a 256px block inside the real
 * dialog is still a guess at the dialog's height. One that really is a block
 * says why on the lines just above it, or anywhere in the `QueryState.Pending`
 * it sits in.
 */
export function skeletonSlabProblems(source) {
  const text = blankComments(source);
  const excusedSlots = [...text.matchAll(PENDING)]
    .filter((match) => EXCUSED.test(source.slice(match.index, match.index + match[0].length)))
    .map((match) => [match.index, match.index + match[0].length]);
  const problems = [];
  for (const match of text.matchAll(SKELETON)) {
    if (!isSlab(match[0])) continue;
    if (excusedSlots.some(([from, to]) => match.index >= from && match.index < to)) continue;
    const line = text.slice(0, match.index).split('\n').length;
    const above = source
      .split('\n')
      .slice(Math.max(0, line - 1 - EXCUSE_REACH), line)
      .join('\n');
    if (EXCUSED.test(above)) continue;
    problems.push({
      line,
      message: `Skeleton is a slab (${classesOf(match[0]).classes.join(' ')}) — draw the placeholder in the real container, its labels written and a bar per line, so the page does not jump when the data lands; a block that really stands in for one says so above it ({/* A block stands in here: <why> */})`,
    });
  }
  return problems;
}
