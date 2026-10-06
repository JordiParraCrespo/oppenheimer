import { common, createLowlight } from 'lowlight';

/**
 * A code block's syntax, the way the Codex desktop app finds it: highlight.js
 * (through `lowlight`, with its common languages) for the fence's language,
 * as a tree of spans classed `hljs-*` that `Prose` colours. The tree is
 * turned into elements, never into HTML.
 */

export type CodeNode =
  | { kind: 'text'; text: string }
  | { kind: 'span'; className: string; children: CodeNode[] };

const lowlight = createLowlight(common);

type HastNode = ReturnType<typeof lowlight.highlight>['children'][number];

function toNode(node: HastNode): CodeNode | null {
  if (node.type === 'text') return { kind: 'text', text: node.value };
  if (node.type !== 'element') return null;
  const classes = node.properties.className;
  return {
    kind: 'span',
    className: Array.isArray(classes) ? classes.join(' ') : '',
    children: node.children
      .map((child) => toNode(child as HastNode))
      .filter((child) => child !== null),
  };
}

/** The code as highlighted spans, or null when the fence names no language highlight.js knows. */
export function highlightCode(code: string, language: string | undefined): CodeNode[] | null {
  const name = language?.trim().split(/\s+/)[0]?.toLowerCase();
  if (!name || !lowlight.registered(name)) return null;
  return lowlight
    .highlight(name, code)
    .children.map(toNode)
    .filter((node) => node !== null);
}
