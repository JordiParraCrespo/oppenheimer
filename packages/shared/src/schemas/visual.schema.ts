import { z } from 'zod';

/**
 * A visual an agent shows in the chat: a title and a list of typed blocks the
 * console draws with its own components, in its own colours, light and dark.
 * No agent code runs: a block is data. A bot sends one with its `show_visual`
 * tool; a session's agent with `runner sessions show <spec.json>`, which
 * writes it into the transcript as an `oppenheimer.visual` entry. Both are
 * checked against this one schema, and a spec that fails is answered with
 * the path of the block at fault (`visualErrors`), so the agent can fix it.
 */

/** The most blocks one visual holds. */
export const VISUAL_BLOCKS_MAX = 24;

/** The most series a chart draws: one per categorical chart colour. */
export const VISUAL_SERIES_MAX = 5;

/** A spec's ceiling, in bytes of its JSON: what one transcript entry may carry. */
export const VISUAL_BYTES_MAX = 60 * 1024;

const text = (max: number) => z.string().trim().min(1).max(max);
const label = text(80);
const finite = z.number().finite();

/** How a number reads: "$1.2k", "42%", "3.5 h". */
const numberFormatSchema = z
  .object({
    /** Before the number: "$", "€". */
    prefix: z.string().max(4).optional(),
    /** After the number: "%", " h", " ms". */
    suffix: z.string().max(8).optional(),
    /** Digits after the point; left out, the number's own up to two. */
    decimals: z.number().int().min(0).max(4).optional(),
    /** Thousands as "1.2k", millions as "3.4M". */
    compact: z.boolean().optional(),
  })
  .strict();

export type VisualNumberFormat = z.infer<typeof numberFormatSchema>;

const markdownBlock = z
  .object({
    type: z.literal('markdown'),
    text: text(4000),
  })
  .strict();

const metricsBlock = z
  .object({
    type: z.literal('metrics'),
    items: z
      .array(
        z
          .object({
            label,
            value: z.union([finite, text(40)]),
            /** The change against before, as a number in the value's units; its sign picks the arrow. */
            delta: finite.optional(),
            /** Which way is good, so a fall in errors reads green. Default `up`. */
            good: z.enum(['up', 'down']).optional(),
            /** Under the figure: "vs last week". */
            hint: z.string().max(80).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    format: numberFormatSchema.optional(),
  })
  .strict();

const seriesSchema = z
  .object({
    label,
    values: z.array(finite).min(1).max(200),
  })
  .strict();

const chartFields = {
  title: z.string().max(120).optional(),
  /** The x axis: a label per point ("Mon", "Sep 5", "v1.2"). */
  labels: z.array(z.string().max(40)).min(1).max(200),
  series: z.array(seriesSchema).min(1).max(VISUAL_SERIES_MAX),
  format: numberFormatSchema.optional(),
};

const barBlock = z
  .object({ type: z.literal('bar'), ...chartFields, labels: chartFields.labels.max(60) })
  .strict();
const lineBlock = z.object({ type: z.literal('line'), ...chartFields }).strict();
const areaBlock = z.object({ type: z.literal('area'), ...chartFields }).strict();

const ringBlock = z
  .object({
    type: z.literal('ring'),
    title: z.string().max(120).optional(),
    /** Over the total, in the middle: "Merged". */
    total: z.string().max(40).optional(),
    segments: z
      .array(z.object({ label, value: finite.nonnegative() }).strict())
      .min(1)
      .max(VISUAL_SERIES_MAX),
    format: numberFormatSchema.optional(),
  })
  .strict();

const rankingBlock = z
  .object({
    type: z.literal('ranking'),
    title: z.string().max(120).optional(),
    items: z
      .array(
        z
          .object({ label, value: finite.nonnegative(), detail: z.string().max(120).optional() })
          .strict(),
      )
      .min(1)
      .max(20),
    format: numberFormatSchema.optional(),
  })
  .strict();

const cellSchema = z.union([finite, z.string().max(200), z.null()]);

const tableBlock = z
  .object({
    type: z.literal('table'),
    title: z.string().max(120).optional(),
    columns: z
      .array(
        z
          .object({
            label,
            align: z.enum(['left', 'right', 'center']).optional(),
            format: numberFormatSchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(10),
    rows: z.array(z.array(cellSchema).max(10)).min(1).max(200),
  })
  .strict();

const checklistBlock = z
  .object({
    type: z.literal('checklist'),
    title: z.string().max(120).optional(),
    items: z
      .array(
        z
          .object({ text: text(200), done: z.boolean(), note: z.string().max(160).optional() })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();

const progressBlock = z
  .object({
    type: z.literal('progress'),
    title: z.string().max(120).optional(),
    items: z
      .array(
        z
          .object({
            label,
            value: finite.nonnegative(),
            /** What full is; default 100. */
            target: finite.positive().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    format: numberFormatSchema.optional(),
  })
  .strict();

export const visualTones = ['neutral', 'info', 'success', 'warning', 'danger'] as const;

export type VisualTone = (typeof visualTones)[number];

const recordBlock = z
  .object({
    type: z.literal('record'),
    title: z.string().max(120).optional(),
    status: z
      .object({ label: text(40), tone: z.enum(visualTones).optional() })
      .strict()
      .optional(),
    fields: z
      .array(z.object({ label, value: text(400) }).strict())
      .min(1)
      .max(16),
  })
  .strict();

const calloutBlock = z
  .object({
    type: z.literal('callout'),
    tone: z.enum(visualTones).optional(),
    title: z.string().max(120).optional(),
    text: text(1000),
  })
  .strict();

const httpsUrl = z
  .string()
  .max(2048)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), { params: { visual: 'https' } });

const linksBlock = z
  .object({
    type: z.literal('links'),
    title: z.string().max(120).optional(),
    items: z
      .array(
        z.object({ label, url: httpsUrl, description: z.string().max(200).optional() }).strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();

const blockSchema = z.discriminatedUnion('type', [
  markdownBlock,
  metricsBlock,
  barBlock,
  lineBlock,
  areaBlock,
  ringBlock,
  rankingBlock,
  tableBlock,
  checklistBlock,
  progressBlock,
  recordBlock,
  calloutBlock,
  linksBlock,
]);

export type VisualBlock = z.infer<typeof blockSchema>;
export type VisualBlockType = VisualBlock['type'];
export type VisualChartBlock = Extract<VisualBlock, { type: 'bar' | 'line' | 'area' }>;

/** Every block type, in the order the tool's description teaches them. */
export const visualBlockTypes = [
  'markdown',
  'metrics',
  'bar',
  'line',
  'area',
  'ring',
  'ranking',
  'table',
  'checklist',
  'progress',
  'record',
  'callout',
  'links',
] as const satisfies readonly VisualBlockType[];

export const visualSchema = z
  .object({
    title: text(120),
    subtitle: z.string().max(240).optional(),
    blocks: z.array(blockSchema).min(1).max(VISUAL_BLOCKS_MAX),
  })
  .strict()
  .superRefine((visual, ctx) => {
    visual.blocks.forEach((block, index) => {
      if (block.type === 'bar' || block.type === 'line' || block.type === 'area') {
        block.series.forEach((series, s) => {
          if (series.values.length !== block.labels.length) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['blocks', index, 'series', s, 'values'],
              params: { visual: 'per-label', got: series.values.length, want: block.labels.length },
            });
          }
        });
      }
      if (block.type === 'table') {
        block.rows.forEach((row, r) => {
          if (row.length !== block.columns.length) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['blocks', index, 'rows', r],
              params: { visual: 'per-column', got: row.length, want: block.columns.length },
            });
          }
        });
      }
    });
  });

export type Visual = z.infer<typeof visualSchema>;

/** A path as the agent wrote it: `blocks[2].series[0].values`. */
function pathOf(path: readonly (string | number)[]): string {
  return path.reduce<string>(
    (out, part) => (typeof part === 'number' ? `${out}[${part}]` : out ? `${out}.${part}` : part),
    '',
  );
}

/**
 * Why a spec is not a visual, one line per fault with the path at fault, the
 * way the agent reads it back; empty when it is one. A block of an unknown
 * type names the types there are.
 */
export function visualErrors(error: z.ZodError): string[] {
  return error.issues.slice(0, 8).map((issue) => {
    const at = pathOf(issue.path) || 'visual';
    if (issue.code === z.ZodIssueCode.invalid_union_discriminator) {
      return `${at}: unknown block type; use one of ${visualBlockTypes.join(', ')}`;
    }
    if (issue.code === z.ZodIssueCode.custom) {
      const { visual, got, want } = (issue.params ?? {}) as { visual?: string; got?: number; want?: number };
      if (visual === 'per-label') return `${at}: has ${got} values for ${want} labels; give one value per label`;
      if (visual === 'per-column') return `${at}: has ${got} cells for ${want} columns`;
      if (visual === 'https') return `${at}: only http and https links`;
    }
    return `${at}: ${issue.message}`;
  });
}

/** A string's length in UTF-8, counted by code point: what the transcript stores. */
function utf8Bytes(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

export type VisualParse = { ok: true; visual: Visual } | { ok: false; errors: string[] };

/** A spec read and checked: the visual, or the faults with their paths. */
export function parseVisual(input: unknown): VisualParse {
  const bytes = utf8Bytes(JSON.stringify(input) ?? '');
  if (bytes > VISUAL_BYTES_MAX) {
    return {
      ok: false,
      errors: [`visual: ${bytes} bytes; keep it under ${VISUAL_BYTES_MAX} (fewer rows or points)`],
    };
  }
  const parsed = visualSchema.safeParse(input);
  return parsed.success
    ? { ok: true, visual: parsed.data }
    : { ok: false, errors: visualErrors(parsed.error) };
}
