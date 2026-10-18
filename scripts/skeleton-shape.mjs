/**
 * A placeholder has the shape of what replaces it: the real container, its
 * static labels written, a bar at the height of each line still to come
 * (`.agents/rules/frontend-ui.md`, "A placeholder has the shape of what
 * replaces it"). The one shape a script can tell is wrong is the slab: a
 * `QueryState.Pending` holding nothing but `Skeleton`s, one of them a block
 * 64px tall or more (`h-16` and up, `size-16`, `h-[64px]`) or one that fills
 * its frame (`flex-1`, `h-full`, `min-h-*`). That is a guess at a height, and
 * the page jumps by the difference when the data lands.
 *
 * A pane that really is one block until it answers (a terminal before its
 * first frame) says so inside the slot: `{/* A block stands in here: <why> *\/}`.
 *
 * A tripwire over the source text, not a parser, like `query-state-slots.mjs`:
 * whether a named placeholder component has the right shape is the audit's
 * call (`/frontend-audit`, `U7`). The cases are `skeleton-shape.test.mjs`.
 */

/** Tall enough to be a block rather than a line or a row: 16 spacing units, 64px. */
const SLAB_UNITS = 16;
const PENDING = /<QueryState\.Pending>([\s\S]*?)<\/QueryState\.Pending>/g;
const ONLY_SKELETONS = /^(?:\s*<Skeleton\b[^>]*\/>)+\s*$/;
const SKELETON = /<Skeleton\b[^>]*\/>/g;
const EXCUSED = /A block stands in here: \S/;

/** Comments blanked rather than cut, so a reported line is the file's line. */
const blankComments = (source) =>
  source.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|(?<![:'"`\\])\/\/.*$/gm, (comment) =>
    comment.replace(/[^\n]/g, ' '),
  );

/** Whether a `Skeleton` tag's classes make it a block rather than a bar. */
function isSlab(tag) {
  const classes = /className="([^"]*)"/.exec(tag)?.[1].split(/\s+/) ?? [];
  return classes.some((name) => {
    const bare = name.replace(/^[a-z0-9-]+:/, '');
    if (bare === 'flex-1' || bare === 'h-full' || bare.startsWith('min-h-')) return true;
    const units = /^(?:h|size)-(\d+(?:\.\d+)?)$/.exec(bare);
    if (units) return Number(units[1]) >= SLAB_UNITS;
    const pixels = /^(?:h|size)-\[(\d+)px\]$/.exec(bare);
    return pixels ? Number(pixels[1]) >= SLAB_UNITS * 4 : false;
  });
}

/** Each `QueryState.Pending` in `source` that is a slab, as `{ line, message }`. */
export function skeletonSlabProblems(source) {
  const text = blankComments(source);
  const problems = [];
  for (const match of text.matchAll(PENDING)) {
    const inside = match[1];
    if (!ONLY_SKELETONS.test(inside)) continue;
    if (EXCUSED.test(source.slice(match.index, match.index + match[0].length))) continue;
    const slab = [...inside.matchAll(SKELETON)].find(([tag]) => isSlab(tag));
    if (!slab) continue;
    problems.push({
      line: text.slice(0, match.index).split('\n').length,
      message: `QueryState.Pending is a slab (${/className="([^"]*)"/.exec(slab[0])?.[1] ?? 'Skeleton'}) — draw the placeholder in the real container, its labels written and a bar per line, so the page does not jump when the data lands`,
    });
  }
  return problems;
}
