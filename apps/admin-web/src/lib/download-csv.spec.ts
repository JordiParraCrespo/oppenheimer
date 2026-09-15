import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { downloadCsv, downloadCsvRows, toCsv } from './download-csv';

/**
 * The quoting is what stands between a lead called "Smith, Jane" and a file
 * with a column too many. It was written four times across four screens before
 * moving here, so the cases below are the ones a hand-rolled version gets
 * wrong: the comma, the embedded quote, the newline, and the empty cell.
 */

describe('toCsv', () => {
  it('quotes every cell, including ones that need no quoting', () => {
    // RFC 4180 permits either. Quoting unconditionally means one code path
    // rather than a predicate that has to be right about every separator.
    expect(toCsv(['Name'], [['Ada']])).toBe('"Name"\n"Ada"');
  });

  it('keeps a comma inside its cell', () => {
    expect(toCsv(['Name'], [['Smith, Jane']])).toBe('"Name"\n"Smith, Jane"');
  });

  it('doubles an embedded quote', () => {
    // `"` closes the field unless it is doubled, so a single one shifts every
    // column after it.
    expect(toCsv(['Note'], [['She said "hi"']])).toBe('"Note"\n"She said ""hi"""');
  });

  it('doubles every quote in a cell, not just the first', () => {
    // The original hand-rolled versions used `replace`, which stops after one.
    expect(toCsv(['Note'], [['a"b"c']])).toBe('"Note"\n"a""b""c"');
  });

  it('keeps a newline inside its cell', () => {
    expect(toCsv(['Note'], [['line one\nline two']])).toBe('"Note"\n"line one\nline two"');
  });

  it('writes an empty cell as an empty quoted field', () => {
    expect(toCsv(['A', 'B'], [['', 'x']])).toBe('"A","B"\n"","x"');
  });

  it('joins several columns and rows', () => {
    expect(
      toCsv(
        ['Name', 'Email'],
        [
          ['Ada', 'ada@example.com'],
          ['Grace', 'grace@example.com'],
        ],
      ),
    ).toBe('"Name","Email"\n"Ada","ada@example.com"\n"Grace","grace@example.com"');
  });

  it('writes a header-only document when there are no rows', () => {
    // An export of an empty table is still a file with columns in it, not a
    // blank download.
    expect(toCsv(['Name', 'Email'], [])).toBe('"Name","Email"');
  });
});

describe('downloadCsv', () => {
  const createObjectURL = vi.fn((_blob: Blob) => 'blob:fake');
  const revokeObjectURL = vi.fn();
  // A bare `vi.fn()` widens to `Mock<Procedure | Constructable>` in Vitest 5,
  // which `mockImplementation` will not accept. Name the signature instead.
  let click: Mock<() => void>;

  beforeEach(() => {
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    click = vi.fn<() => void>();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('clicks a link carrying the blob URL and the filename', () => {
    downloadCsv('leads.csv', '"a"\n"b"');

    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
  });

  it('declares the blob as UTF-8 CSV', () => {
    // Without the charset, Excel opens an export containing accented names as
    // mojibake — which is most of a Spanish organization's leads.
    downloadCsv('leads.csv', '"José"');

    const [blob] = createObjectURL.mock.calls[0];
    expect(blob.type).toBe('text/csv;charset=utf-8');
  });

  it('revokes the object URL once the click is dispatched', () => {
    // The browser has taken its own reference by then. Holding ours keeps the
    // blob alive for the life of the document, and an export screen used a few
    // times leaks every file it produced.
    downloadCsv('leads.csv', '"a"');

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('revokes after the click, never before it', () => {
    const order: string[] = [];
    click.mockImplementation(() => order.push('click'));
    revokeObjectURL.mockImplementation(() => order.push('revoke'));

    downloadCsv('leads.csv', '"a"');

    expect(order).toEqual(['click', 'revoke']);
  });
});

describe('downloadCsvRows', () => {
  it('serialises the rows and hands the result to the browser', () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:fake');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadCsvRows('team.csv', ['Name'], [['Smith, Jane']]);

    expect(createObjectURL).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
