import mermaid from 'mermaid';
import type { DiagramTheme } from './diagram-theme';

/**
 * A `mermaid` fence drawn as a picture. Mermaid runs in strict mode (no
 * script, no click handler, its labels sanitised) and the SVG it returns is
 * shown through `<img>`, where nothing in it can run and no page style
 * reaches into it. This module is loaded on the first diagram only, as its
 * own chunk.
 */

/** A drawn diagram: the picture, its size at 1:1, and what it says it is. */
export interface DrawnDiagram {
  src: string;
  width: number;
  height: number;
  title: string | undefined;
}

let drawn = 0;
// Mermaid keeps one configuration and one scratch element: one diagram at a time.
let queue: Promise<unknown> = Promise.resolve();

function configure(theme: DiagramTheme): void {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme: 'base',
    darkMode: theme.dark,
    fontFamily: theme.fontFamily,
    themeVariables: theme.variables,
    htmlLabels: false,
    look: 'neo',
    flowchart: { curve: 'basis', padding: 12, nodeSpacing: 40, rankSpacing: 44 },
    sequence: {
      mirrorActors: false,
      actorMargin: 48,
      width: 128,
      height: 44,
      boxMargin: 8,
      noteMargin: 10,
      messageMargin: 36,
      actorFontSize: 14,
      messageFontSize: 14,
      noteFontSize: 13,
    },
    gantt: { barHeight: 22, barGap: 6, fontSize: 12, sectionFontSize: 12 },
    pie: { textPosition: 0.7 },
    state: { padding: 8 },
  });
}

function text(value: string | undefined): string | undefined {
  const words = value
    ?.replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
  return words || undefined;
}

/** The SVG at its own size, as a picture an `<img>` can show. */
function asPicture(svg: string): DrawnDiagram | null {
  const box = /viewBox="([-\d.]+)[ ,]+([-\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)"/.exec(svg);
  const width = Math.ceil(Number(box?.[3]));
  const height = Math.ceil(Number(box?.[4]));
  if (!(width > 0 && height > 0)) return null;
  // The look's drop shadows read as smudges on the card; the frame is depth enough.
  const flat = svg.replace(/\sfilter="url\(#[^)]*drop-shadow[^)]*\)"/g, '');
  const sized = flat.replace(/^<svg\b[^>]*>/, (open) =>
    open
      .replace(/\s(width|height)="[^"]*"/g, '')
      .replace(/\sstyle="[^"]*"/, '')
      .replace(/^<svg/, `<svg width="${width}" height="${height}"`),
  );
  return {
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`,
    width,
    height,
    title: text(/<title[^>]*>([\s\S]*?)<\/title>/.exec(svg)?.[1]),
  };
}

async function draw(source: string, theme: DiagramTheme): Promise<DrawnDiagram | null> {
  configure(theme);
  try {
    if (!(await mermaid.parse(source, { suppressErrors: true }))) return null;
    drawn += 1;
    const { svg } = await mermaid.render(`markdown-diagram-${drawn}`, source);
    return asPicture(svg);
  } catch {
    return null;
  } finally {
    // Mermaid leaves a scratch element behind when a render throws.
    document.getElementById(`dmarkdown-diagram-${drawn}`)?.remove();
  }
}

/**
 * `source` drawn under `theme`, or `null` when Mermaid cannot read it: the
 * caller then shows the source as code.
 */
export function drawDiagram(source: string, theme: DiagramTheme): Promise<DrawnDiagram | null> {
  const next = queue.then(() => draw(source, theme));
  queue = next.catch(() => null);
  return next;
}
