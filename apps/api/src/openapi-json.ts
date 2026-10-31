/**
 * The OpenAPI document as JSON in the repository's Biome style, so
 * `openapi.json` is written already formatted: objects always open one key a
 * line, an array of plain values stays on one line when it fits the 100
 * columns `biome.json` sets, and anything else opens one entry a line.
 * `JSON.stringify(document, null, 2)` alone opened every array, which made
 * the raw file bigger than Biome's 1 MiB limit before it could format it.
 */
const LINE_WIDTH = 100;

export function formatOpenApiJson(value: unknown): string {
  return `${format(value, 0, 0, 0)}\n`;
}

/**
 * `value` at `indent`, on a line that already holds `lead` characters before
 * it and will hold `tail` after it (a comma).
 */
function format(value: unknown, indent: number, lead: number, tail: number): string {
  const inner = ' '.repeat(indent + 2);
  const close = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every(isPlain)) {
      const line = `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
      if (lead + line.length + tail <= LINE_WIDTH) return line;
    }
    const rows = value.map((item, index) => {
      const comma = index < value.length - 1 ? 1 : 0;
      return `${inner}${format(item, indent + 2, indent + 2, comma)}${comma ? ',' : ''}`;
    });
    return `[\n${rows.join('\n')}\n${close}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined);
    if (entries.length === 0) return '{}';
    const rows = entries.map(([key, item], index) => {
      const comma = index < entries.length - 1 ? 1 : 0;
      const name = `${JSON.stringify(key)}: `;
      const body = format(item, indent + 2, indent + 2 + name.length, comma);
      return `${inner}${name}${body}${comma ? ',' : ''}`;
    });
    return `{\n${rows.join('\n')}\n${close}}`;
  }
  return JSON.stringify(value);
}

function isPlain(value: unknown): boolean {
  return value === null || typeof value !== 'object';
}
