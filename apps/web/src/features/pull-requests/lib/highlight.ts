import { common, createLowlight } from 'lowlight';

/**
 * A code block's syntax, the way the Codex desktop app finds it: highlight.js
 * (through `lowlight`, with its common languages) for the fence's language.
 * The result is lowlight's own tree, which the code block renders as spans.
 */

const lowlight = createLowlight(common);

/** A node of the highlighted tree: text, or a span classed `hljs-*` around more. */
export type CodeNode = ReturnType<typeof lowlight.highlight>['children'][number];

/** The code's highlighted tree, or null when the fence names no language highlight.js knows. */
export function highlightCode(code: string, language: string | undefined): CodeNode[] | null {
  const name = language?.trim().split(/\s+/)[0]?.toLowerCase();
  if (!name || !lowlight.registered(name)) return null;
  return lowlight.highlight(name, code).children;
}

/**
 * The colour a highlight.js class takes, grouped the way the Codex app
 * groups them and drawn from the hues the system already themes.
 */
const SYNTAX: Record<string, string> = {
  'hljs-comment': 'text-fg-muted italic',
  'hljs-quote': 'text-fg-muted italic',
  'hljs-keyword': 'text-(--file-icon-pink)',
  'hljs-doctag': 'text-(--file-icon-pink)',
  'hljs-operator': 'text-(--file-icon-pink)',
  'hljs-built_in': 'text-(--file-icon-orange)',
  'hljs-literal': 'text-(--file-icon-orange)',
  'hljs-number': 'text-(--file-icon-orange)',
  'hljs-string': 'text-(--file-icon-green)',
  'hljs-regexp': 'text-(--file-icon-green)',
  'hljs-addition': 'text-(--file-icon-green)',
  'hljs-deletion': 'text-danger',
  'hljs-variable': 'text-(--file-icon-purple)',
  'hljs-template-variable': 'text-(--file-icon-purple)',
  'hljs-type': 'text-(--file-icon-purple)',
  'hljs-title': 'text-(--file-icon-purple)',
  'hljs-attr': 'text-(--file-icon-yellow)',
  'hljs-attribute': 'text-(--file-icon-yellow)',
  'hljs-section': 'text-(--file-icon-yellow)',
  'hljs-name': 'text-(--file-icon-blue)',
  'hljs-tag': 'text-(--file-icon-blue)',
  'hljs-symbol': 'text-(--file-icon-blue)',
  'hljs-bullet': 'text-(--file-icon-blue)',
  'hljs-link': 'text-(--file-icon-blue)',
  'hljs-meta': 'text-(--file-icon-blue)',
};

/** A span's colour from its classes; `title class_` is a literal, as in the app. */
export function syntaxClass(classes: unknown): string | undefined {
  const names = Array.isArray(classes) ? classes.map(String) : [];
  if (names.includes('hljs-title') && names.includes('class_')) return SYNTAX['hljs-built_in'];
  return names.map((name) => SYNTAX[name]).find(Boolean);
}
