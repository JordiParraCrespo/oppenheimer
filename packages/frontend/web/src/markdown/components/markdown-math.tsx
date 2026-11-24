import type { ReactNode } from 'react';
import { useMath } from '../hooks/use-math';

/**
 * A formula: `$…$` in a line, `$$…$$` or a `math` fence as a block of its
 * own, typeset by KaTeX in the text's colour. Until KaTeX has loaded a
 * formula in a line shows its TeX, and a block keeps a line's room; TeX
 * KaTeX cannot read shows `children`, the source as code, never an error.
 * A block wider than the column scrolls sideways in its own box.
 */
export function MarkdownMath({
  tex,
  display,
  children,
}: {
  tex: string;
  display: boolean;
  /** The source as code, for TeX KaTeX cannot read (and, in a line, until it loads). */
  children: ReactNode;
}) {
  const typeset = useMath();
  if (!typeset) {
    return display ? <div aria-busy className="min-h-12" /> : children;
  }
  const html = typeset(tex, display);
  if (html === null) return children;
  return display ? (
    <div
      data-slot="markdown-math"
      className="overflow-x-auto overflow-y-hidden px-0.5 py-1 [&_.katex-display]:my-1 [&_.katex]:text-[1.12em]"
      // KaTeX builds this from the TeX with every character escaped and `trust` off.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX's own escaped markup
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    <span
      data-slot="markdown-math"
      className="[&_.katex]:text-[1.06em]"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX's own escaped markup
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
