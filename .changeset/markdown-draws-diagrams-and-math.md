---
"@oppenheimer/frontend-web": minor
"@oppenheimer/design-system-web": patch
"@oppenheimer/translations": minor
"@oppenheimer/web": patch
---

A reply's Markdown draws diagrams and typesets math, in both chats and
everywhere else `Markdown` renders.

- `@oppenheimer/frontend-web`: a closed `mermaid` fence is a diagram, drawn
  by Mermaid in strict mode in the theme's own colours and type (redrawn
  when the theme switches) and shown through `<img>`; a quiet sketch of
  nodes holds its room while it draws, a hover toolbar switches to the
  source, copies it or opens the diagram large with zoom and pan, and a wide
  one scrolls inside its frame. A source Mermaid cannot read shows as the
  code block with a note. `$…$`, `$$…$$` and a `math` fence are typeset by
  KaTeX, with prices ("$5 and $10") left as text and bad TeX shown as code;
  `MarkdownLine` shows a formula's TeX as a code span. A fence still being
  written stays code, and the caller's `code` renderer never sees a diagram
  or a formula. Mermaid, KaTeX and KaTeX's stylesheet and fonts load on
  first use, in their own chunks.
- `@oppenheimer/design-system-web`: `animate-diagram-in`, a fade and the
  last 1.5% of scale for a picture settling into its frame.
- `@oppenheimer/translations`: `common.markdown.diagram.*`.
- `@oppenheimer/web`: fonts are never inlined as `data:` URIs, which the
  console's `font-src 'self'` refuses.
