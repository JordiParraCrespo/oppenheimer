/**
 * A diagram's colours and type, read from the design tokens wherever it is
 * drawn, so a diagram is never a second palette: Mermaid's `base` theme
 * takes them as `themeVariables`. Nodes sit on a whisper of the primary
 * blue with a hairline of it, edges in the muted ink, clusters and notes on
 * the quiet surfaces, and every chart-like diagram (pie, journey, timeline,
 * git, mindmap) draws from the `--chart-*` palette.
 */

/** The tokens a diagram reads, resolved to `#rrggbb`. */
type Tokens = Record<(typeof TOKENS)[number], string>;

const TOKENS = [
  'card',
  'fg',
  'fg-muted',
  'fg-subtle',
  'border',
  'border-subtle',
  'border-strong',
  'chat-wash',
  'primary',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'chart-grid',
  'chart-axis',
] as const;

/** What `drawDiagram` themes a diagram with. */
export interface DiagramTheme {
  dark: boolean;
  fontFamily: string;
  variables: Record<string, string | boolean | Record<string, string>>;
}

function channel(hex: string, at: number): number {
  return Number.parseInt(hex.slice(at, at + 2), 16);
}

/** `a` laid over `b` at `amount` (0 is `b`, 1 is `a`). */
function mix(a: string, b: string, amount: number): string {
  const out = [1, 3, 5].map((at) =>
    Math.round(channel(a, at) * amount + channel(b, at) * (1 - amount))
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${out.join('')}`;
}

function luminance(hex: string): number {
  return (0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)) / 255;
}

/** `#rrggbb` from `rgb(r, g, b)` or `#rgb` / `#rrggbb`, or `null` for any other form. */
function hexOf(color: string): string | null {
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(color);
  if (rgb) {
    return `#${rgb
      .slice(1, 4)
      .map((part) => Number(part).toString(16).padStart(2, '0'))
      .join('')}`;
  }
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color);
  return short
    ? `#${short
        .slice(1, 4)
        .map((part) => part + part)
        .join('')}`.toLowerCase()
    : null;
}

/**
 * A colour as `#rrggbb`, whatever form the token is written in (a name, a
 * `color-mix`, `rgb()`): the browser resolves it on a probe, and a canvas
 * hands back as hex what is not already `rgb()`, which is all Mermaid's
 * colour maths reads.
 */
function resolver(probe: HTMLElement): (value: string, fallback: string) => string {
  let context: CanvasRenderingContext2D | null | undefined;
  return (value, fallback) => {
    probe.style.color = '';
    probe.style.color = value;
    const computed = value ? getComputedStyle(probe).color : '';
    if (!computed) return fallback;
    const direct = hexOf(computed);
    if (direct) return direct;
    context ??= document.createElement('canvas').getContext('2d');
    if (!context) return fallback;
    context.fillStyle = fallback;
    context.fillStyle = computed;
    return hexOf(String(context.fillStyle)) ?? fallback;
  };
}

function readTokens(element: Element): { tokens: Tokens; fontFamily: string } {
  const style = getComputedStyle(element);
  const probe = document.createElement('span');
  probe.hidden = true;
  element.appendChild(probe);
  const resolve = resolver(probe);
  const fallbacks: Partial<Tokens> = { card: '#ffffff', fg: '#1d1d1f' };
  const tokens = {} as Tokens;
  for (const name of TOKENS) {
    tokens[name] = resolve(
      style.getPropertyValue(`--${name}`).trim(),
      fallbacks[name] ?? '#86868b',
    );
  }
  probe.remove();
  const fontFamily = style.getPropertyValue('--font-sans').trim() || style.fontFamily;
  return { tokens, fontFamily };
}

/** The theme the tokens around `element` give a diagram. */
export function diagramTheme(element: Element): DiagramTheme {
  const { tokens: t, fontFamily } = readTokens(element);
  const dark = luminance(t.card) < 0.5;
  const chart = [t['chart-1'], t['chart-2'], t['chart-3'], t['chart-4'], t['chart-5']];
  const tint = (color: string, amount = dark ? 0.16 : 0.08) => mix(color, t.card, amount);
  const edge = (color: string) => mix(color, t.card, dark ? 0.46 : 0.42);
  // Twelve steps for the diagrams that cycle through a scale: the five hues,
  // then the same five softer, then two more of the first.
  const scale = [...chart, ...chart.map((color) => mix(color, t.card, 0.6)), chart[0], chart[2]];
  const variables: DiagramTheme['variables'] = {
    darkMode: dark,
    background: t.card,
    fontFamily,
    fontSize: '14px',
    radius: '8',
    strokeWidth: '1',
    useGradient: false,
    dropShadow: 'none',

    primaryColor: tint(t['chart-1']),
    primaryBorderColor: edge(t['chart-1']),
    primaryTextColor: t.fg,
    secondaryColor: tint(t['chart-3']),
    secondaryBorderColor: edge(t['chart-3']),
    secondaryTextColor: t.fg,
    tertiaryColor: t['chat-wash'],
    tertiaryBorderColor: t.border,
    tertiaryTextColor: t.fg,
    mainBkg: tint(t['chart-1']),
    nodeBorder: edge(t['chart-1']),
    nodeTextColor: t.fg,
    textColor: t.fg,
    titleColor: t.fg,
    lineColor: t['fg-subtle'],
    arrowheadColor: t['fg-subtle'],
    defaultLinkColor: t['fg-subtle'],
    edgeLabelBackground: t.card,
    labelBackgroundColor: t.card,
    clusterBkg: mix(t['chat-wash'], t.card, 0.6),
    clusterBorder: t.border,
    noteBkgColor: tint(t['chart-5'], dark ? 0.14 : 0.12),
    noteBorderColor: edge(t['chart-5']),
    noteTextColor: t.fg,

    actorBkg: tint(t['chart-1']),
    actorBorder: edge(t['chart-1']),
    actorTextColor: t.fg,
    actorLineColor: t.border,
    signalColor: t['fg-muted'],
    signalTextColor: t.fg,
    labelBoxBkgColor: t['chat-wash'],
    labelBoxBorderColor: t.border,
    labelTextColor: t.fg,
    loopTextColor: t['fg-muted'],
    activationBkgColor: t['chat-wash'],
    activationBorderColor: t['border-strong'],
    sequenceNumberColor: t.card,

    stateBkg: tint(t['chart-1']),
    stateLabelColor: t.fg,
    compositeBackground: t.card,
    compositeTitleBackground: t['chat-wash'],
    compositeBorder: t.border,
    altBackground: t['chat-wash'],
    transitionColor: t['fg-subtle'],
    transitionLabelColor: t['fg-muted'],
    specialStateColor: t['fg-muted'],
    innerEndBackground: t['fg-muted'],

    classText: t.fg,
    rowOdd: t.card,
    rowEven: t['chat-wash'],
    attributeBackgroundColorOdd: t.card,
    attributeBackgroundColorEven: t['chat-wash'],
    relationColor: t['fg-subtle'],
    relationLabelBackground: t.card,
    relationLabelColor: t['fg-muted'],

    gridColor: t['chart-grid'],
    sectionBkgColor: tint(t['chart-1']),
    altSectionBkgColor: t.card,
    sectionBkgColor2: tint(t['chart-3']),
    taskBkgColor: tint(t['chart-1'], dark ? 0.4 : 0.3),
    taskBorderColor: edge(t['chart-1']),
    taskTextColor: t.fg,
    taskTextLightColor: t.fg,
    taskTextDarkColor: t.fg,
    taskTextOutsideColor: t.fg,
    activeTaskBkgColor: tint(t['chart-2'], dark ? 0.4 : 0.3),
    activeTaskBorderColor: edge(t['chart-2']),
    doneTaskBkgColor: t['chat-wash'],
    doneTaskBorderColor: t.border,
    critBkgColor: tint(t['chart-5'], dark ? 0.4 : 0.3),
    critBorderColor: edge(t['chart-5']),
    todayLineColor: t.primary,

    pieStrokeColor: t.card,
    pieStrokeWidth: '2px',
    pieOuterStrokeColor: t.card,
    pieOuterStrokeWidth: '0px',
    pieOpacity: '1',
    pieTitleTextColor: t.fg,
    pieTitleTextSize: '16px',
    pieSectionTextSize: '13px',
    pieLegendTextSize: '14px',
    pieSectionTextColor: dark ? t.fg : t.card,
    pieLegendTextColor: t['fg-muted'],

    quadrant1Fill: tint(t['chart-1']),
    quadrant2Fill: tint(t['chart-2']),
    quadrant3Fill: tint(t['chart-3']),
    quadrant4Fill: tint(t['chart-4']),
    quadrant1TextFill: t.fg,
    quadrant2TextFill: t.fg,
    quadrant3TextFill: t.fg,
    quadrant4TextFill: t.fg,
    quadrantPointFill: t['chart-1'],
    quadrantPointTextFill: t.fg,
    quadrantXAxisTextFill: t['fg-muted'],
    quadrantYAxisTextFill: t['fg-muted'],
    quadrantInternalBorderStrokeFill: t['border-subtle'],
    quadrantExternalBorderStrokeFill: t.border,
    quadrantTitleFill: t.fg,

    requirementBackground: tint(t['chart-1']),
    requirementBorderColor: edge(t['chart-1']),
    requirementTextColor: t.fg,

    branchLabelColor: t.card,
    commitLabelColor: t['fg-muted'],
    commitLabelBackground: t.card,
    tagLabelColor: t.fg,
    tagLabelBackground: t['chat-wash'],
    tagLabelBorder: t.border,
    scaleLabelColor: t.fg,
  };
  scale.forEach((color, index) => {
    variables[`cScale${index}`] = tint(color, dark ? 0.32 : 0.22);
    variables[`cScaleLabel${index}`] = t.fg;
    variables[`cScalePeer${index}`] = edge(color);
    variables[`pie${index + 1}`] = color;
    variables[`fillType${index % 8}`] = tint(color);
  });
  chart.concat(chart.slice(0, 3)).forEach((color, index) => {
    variables[`git${index}`] = color;
    variables[`gitInv${index}`] = t.card;
    variables[`gitBranchLabel${index}`] = t.card;
  });
  variables.xyChart = {
    backgroundColor: t.card,
    titleColor: t.fg,
    xAxisLabelColor: t['fg-muted'],
    xAxisTitleColor: t['fg-muted'],
    xAxisTickColor: t['chart-axis'],
    xAxisLineColor: t['chart-grid'],
    yAxisLabelColor: t['fg-muted'],
    yAxisTitleColor: t['fg-muted'],
    yAxisTickColor: t['chart-axis'],
    yAxisLineColor: t['chart-grid'],
    plotColorPalette: chart.join(','),
  };
  return { dark, fontFamily, variables };
}

/** One string per theme, to key what was drawn under it. */
export function themeKey(theme: DiagramTheme): string {
  return JSON.stringify(theme.variables);
}
