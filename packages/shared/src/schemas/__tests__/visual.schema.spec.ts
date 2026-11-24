import { describe, expect, it } from 'vitest';
import { parseVisual, VISUAL_BYTES_MAX } from '../visual.schema.js';

const chart = (values: number[]) => ({
  title: 'Deploys',
  blocks: [{ type: 'bar', labels: ['Mon', 'Tue', 'Wed'], series: [{ label: 'Deploys', values }] }],
});

describe('parseVisual', () => {
  it('reads a visual of every kind of block an agent is taught', () => {
    const result = parseVisual({
      title: 'Week in review',
      subtitle: 'Sep 1 – Sep 7',
      blocks: [
        { type: 'markdown', text: 'All **green**.' },
        { type: 'metrics', items: [{ label: 'Merged', value: 42, delta: 6 }] },
        { type: 'line', labels: ['a', 'b'], series: [{ label: 'p50', values: [1, 2] }] },
        { type: 'area', labels: ['a'], series: [{ label: 'x', values: [1] }] },
        { type: 'ring', segments: [{ label: 'Auto', value: 3 }] },
        { type: 'ranking', items: [{ label: 'CI', value: 9 }] },
        { type: 'table', columns: [{ label: 'Name' }, { label: 'Runs', align: 'right' }], rows: [['a', 1]] },
        { type: 'checklist', items: [{ text: 'Ship', done: true }] },
        { type: 'progress', items: [{ label: 'Coverage', value: 81 }] },
        { type: 'record', fields: [{ label: 'Branch', value: 'main' }] },
        { type: 'callout', tone: 'warning', text: 'Flaky' },
        { type: 'links', items: [{ label: 'PR', url: 'https://github.com/a/b/pull/1' }] },
      ],
    });
    expect(result.ok).toBe(true);
  });

  // The agent fixes a spec from these lines alone: losing the path would leave it guessing.
  it('names the path of a series whose values do not match the labels', () => {
    expect(parseVisual(chart([1, 2]))).toEqual({
      ok: false,
      errors: ['blocks[0].series[0].values: has 2 values for 3 labels; give one value per label'],
    });
  });

  it('names the block types there are when one is unknown', () => {
    const result = parseVisual({ title: 'x', blocks: [{ type: 'pie' }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/^blocks\[0\]\.type: unknown block type; use one of markdown, metrics/);
  });

  it('refuses a table row with a cell too many', () => {
    const result = parseVisual({
      title: 'x',
      blocks: [{ type: 'table', columns: [{ label: 'A' }], rows: [['a', 'b']] }],
    });
    expect(result).toEqual({ ok: false, errors: ['blocks[0].rows[0]: has 2 cells for 1 columns'] });
  });

  // A javascript: link would run in the console's origin when clicked.
  it('refuses a link that is not http or https', () => {
    const result = parseVisual({
      title: 'x',
      blocks: [{ type: 'links', items: [{ label: 'x', url: 'javascript:alert(1)' }] }],
    });
    expect(result.ok).toBe(false);
  });

  it('refuses a spec over the entry ceiling before checking it', () => {
    const result = parseVisual({ title: 'x'.repeat(VISUAL_BYTES_MAX), blocks: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/bytes; keep it under/);
  });
});
