/**
 * Every `<QueryState>` draws each rung of a read. A slot left out is a rung
 * that draws nothing: without `Error` a failed read is a blank, without
 * `Pending` the first load is. The types cannot say which children an element
 * needs, so this does: a `<QueryState>` holds a `Pending`, an `Error` and a
 * `Data`, and an `Empty` exactly when it is given `isEmpty`.
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

/** The root's opening tag after `<QueryState`, up to the `>` outside any `{…}`. */
function openingTag(source, from) {
  let depth = 0;
  for (let i = from; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') depth -= 1;
    else if (source[i] === '>' && depth === 0) return source.slice(from, i + 1);
  }
  return source.slice(from);
}

/** What is wrong with each `<QueryState>` in `source`, as `{ line, message }`. */
export function queryStateSlotProblems(source) {
  const text = blankComments(source);
  const problems = [];
  const open = [];
  for (const match of text.matchAll(ROOT)) {
    if (!match[1]) {
      open.push(match.index);
      continue;
    }
    const start = open.pop();
    if (start === undefined) continue;
    const tag = openingTag(text, start + '<QueryState'.length);
    const inside = text.slice(start + '<QueryState'.length + tag.length, match.index);
    const line = text.slice(0, start).split('\n').length;
    const has = (slot) => new RegExp(`<QueryState\\.${slot}\\b`).test(inside);
    const emptyAsked = /\bisEmpty\s*=/.test(tag);

    const missing = REQUIRED.filter((slot) => !has(slot)).map((slot) => `QueryState.${slot}`);
    if (emptyAsked && !has('Empty')) missing.push('QueryState.Empty (it is given isEmpty)');
    if (missing.length > 0) {
      problems.push({
        line,
        message: `<QueryState> without ${missing.join(', ')} — each rung of a read draws something; a slot left out draws nothing`,
      });
    }
    if (!emptyAsked && has('Empty')) {
      problems.push({
        line,
        message:
          '<QueryState.Empty> with no isEmpty on its <QueryState> — the root decides what is empty, so the slot never draws',
      });
    }
  }
  return problems;
}
