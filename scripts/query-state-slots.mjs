/**
 * Every `<QueryState>` draws each rung of a Suspense read. A slot left out is
 * a rung that draws nothing: without `Error` a failed read is a blank, without
 * `Pending` the first load is. The types cannot say which children an element
 * needs, so this does: a `<QueryState>` holds a `Pending`, an `Error` and a
 * `Data`.
 *
 * A tripwire over the source text, not a parser: it pairs `<QueryState>` with
 * its closing tag and reads what is between them. `check-frontend-structure.mjs`
 * runs it over every frontend source file; the cases are
 * `query-state-slots.test.mjs`.
 */

const REQUIRED = ['Pending', 'Error', 'Data'];
const ROOT = /<(\/?)QueryState(?=[\s>])/g;

/** Comments blanked rather than cut, so a reported line is the file's line. */
const blankComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\/|(?<![:'"`\\])\/\/.*$/gm, (comment) =>
    comment.replace(/[^\n]/g, ' '),
  );

/** What is wrong with each `<QueryState>` in `source`, as `{ line, message }`. */
export function queryStateSlotProblems(source) {
  const text = blankComments(source);
  const problems = [];
  const open = [];
  // Roots already closed: a root nested in another's `Data` owns its slots,
  // and they say nothing about the root around it.
  const closed = [];
  for (const match of text.matchAll(ROOT)) {
    if (!match[1]) {
      open.push(match.index);
      continue;
    }
    const start = open.pop();
    if (start === undefined) continue;
    const from = start + '<QueryState'.length;
    let inside = '';
    let at = from;
    for (const [innerStart, innerEnd] of closed.filter(([s, e]) => s > from && e < match.index)) {
      if (innerStart < at) continue;
      inside += text.slice(at, innerStart);
      at = innerEnd;
    }
    inside += text.slice(at, match.index);
    closed.push([start, match.index + match[0].length]);
    const line = text.slice(0, start).split('\n').length;
    const missing = REQUIRED.filter(
      (slot) => !new RegExp(`<QueryState\\.${slot}\\b`).test(inside),
    ).map((slot) => `QueryState.${slot}`);
    if (missing.length > 0) {
      problems.push({
        line,
        message: `<QueryState> without ${missing.join(', ')} — each rung of a read draws something; a slot left out draws nothing`,
      });
    }
  }
  return problems;
}
