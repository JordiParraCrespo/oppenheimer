import 'katex/dist/katex.min.css';
import katex from 'katex';

/**
 * TeX typeset by KaTeX, as the markup it builds from the TeX (every
 * character escaped, `\href` and the like refused while `trust` is off).
 * This module, KaTeX's stylesheet and its fonts, which come from the app's
 * own bundle, load on the first formula only, as their own chunk.
 */

/** `tex` as KaTeX's markup, or `null` when it is not TeX KaTeX can read. */
export function typeset(tex: string, display: boolean): string | null {
  try {
    return katex.renderToString(tex, {
      displayMode: display,
      throwOnError: true,
      trust: false,
      strict: 'ignore',
      maxSize: 20,
      maxExpand: 500,
      output: 'htmlAndMathml',
    });
  } catch {
    return null;
  }
}
