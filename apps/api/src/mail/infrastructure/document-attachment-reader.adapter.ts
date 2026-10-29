import { Injectable } from '@nestjs/common';
import { strFromU8, unzipSync } from 'fflate';
import {
  ATTACHMENT_TEXT_MAX,
  type AttachmentReaderPort,
  type AttachmentReading,
} from './attachment-reader.port';
import { htmlToText } from './gmail-message.util';

/** The most one file inside an Office document may unpack to: a zip bomb stops here. */
const ZIP_ENTRY_MAX_BYTES = 20 * 1024 * 1024;
/** The most pages of a PDF read for text. */
const PDF_PAGES_MAX = 50;

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const TEXT_EXTENSIONS = new Set([
  'txt',
  'csv',
  'tsv',
  'md',
  'json',
  'xml',
  'yaml',
  'yml',
  'log',
  'ics',
  'vcf',
  'eml',
]);

/**
 * `unpdf` is ESM-only and the API compiles to CommonJS, whose module resolution
 * cannot read its types: it is loaded by name, which Node 22 resolves from
 * CommonJS and Vitest from ESM, and typed by the part this adapter calls.
 */
const UNPDF = 'unpdf';

/** The part of `unpdf` this adapter calls. */
interface Unpdf {
  getDocumentProxy(data: Uint8Array): Promise<{ numPages: number }>;
  extractText(
    pdf: unknown,
    options: { mergePages: false },
  ): Promise<{ totalPages: number; text: string[] }>;
}

/**
 * Attachments as text, with no network and no process: `unpdf` (pdf.js) for
 * PDFs, `fflate` to open Word, Excel and PowerPoint files and read their XML,
 * and the bytes themselves for text. A file the bot cannot read says why.
 */
@Injectable()
export class DocumentAttachmentReaderAdapter implements AttachmentReaderPort {
  async read(file: {
    filename: string;
    mimeType: string;
    bytes: Buffer;
  }): Promise<AttachmentReading> {
    const mimeType = file.mimeType.toLowerCase();
    const extension = file.filename.toLowerCase().split('.').pop() ?? '';
    try {
      if (IMAGE_TYPES.has(mimeType)) {
        return { kind: 'image', mimeType: mimeType as 'image/png' };
      }
      if (mimeType === 'application/pdf' || extension === 'pdf') {
        return await this.pdf(file.bytes);
      }
      if (extension === 'docx') return fitted('Word document', docxText(file.bytes));
      if (extension === 'xlsx')
        return fitted('spreadsheet, as CSV per sheet', xlsxText(file.bytes));
      if (extension === 'pptx') return fitted('slides', pptxText(file.bytes));
      if (mimeType === 'text/html' || extension === 'html' || extension === 'htm') {
        return fitted('HTML, as text', htmlToText(file.bytes.toString('utf8')));
      }
      if (mimeType.startsWith('text/') || TEXT_EXTENSIONS.has(extension)) {
        return fitted('text', file.bytes.toString('utf8'));
      }
    } catch {
      return { kind: 'unreadable', reason: 'The file could not be read; it may be damaged.' };
    }
    return {
      kind: 'unreadable',
      reason: `Files of type ${file.mimeType || extension || 'unknown'} are not opened; only its name and size are known.`,
    };
  }

  private async pdf(bytes: Buffer): Promise<AttachmentReading> {
    const unpdf = (await import(UNPDF)) as Unpdf;
    const document = await unpdf.getDocumentProxy(new Uint8Array(bytes));
    const { totalPages, text } = await unpdf.extractText(document, { mergePages: false });
    const pages = text.slice(0, PDF_PAGES_MAX);
    if (!pages.some((page) => page.trim())) {
      return {
        kind: 'unreadable',
        reason: `The PDF has ${totalPages} page(s) and no text layer: it is a scan, which is not read in this version.`,
      };
    }
    const body = pages
      .map((page, index) => `--- Page ${index + 1} ---\n${page.trim()}`)
      .join('\n\n');
    const reading = fitted(`PDF, ${totalPages} page(s)`, body);
    return totalPages > PDF_PAGES_MAX && reading.kind === 'text'
      ? { ...reading, truncated: true }
      : reading;
  }
}

function fitted(format: string, text: string): AttachmentReading {
  const clean = text.replace(/\r\n/g, '\n').trim();
  return {
    kind: 'text',
    format,
    text: clean.slice(0, ATTACHMENT_TEXT_MAX),
    truncated: clean.length > ATTACHMENT_TEXT_MAX,
  };
}

/** The named entries of an Office file, each unpacked only if it is small enough to be honest. */
function unzipped(bytes: Buffer, wanted: (name: string) => boolean): Record<string, string> {
  const files = unzipSync(new Uint8Array(bytes), {
    filter: (entry) => wanted(entry.name) && entry.originalSize <= ZIP_ENTRY_MAX_BYTES,
  });
  return Object.fromEntries(Object.entries(files).map(([name, data]) => [name, strFromU8(data)]));
}

function docxText(bytes: Buffer): string {
  const xml = unzipped(bytes, (name) => name === 'word/document.xml')['word/document.xml'] ?? '';
  return xmlText(
    xml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n'),
  );
}

function pptxText(bytes: Buffer): string {
  const files = unzipped(bytes, (name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  return Object.keys(files)
    .sort((a, b) => slideNumber(a) - slideNumber(b))
    .map((name) => {
      const runs = [...files[name].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]);
      return `--- Slide ${slideNumber(name)} ---\n${xmlText(runs.join(' '))}`;
    })
    .join('\n\n');
}

function slideNumber(name: string): number {
  return Number(/slide(\d+)\.xml$/.exec(name)?.[1] ?? 0);
}

/** Each sheet as CSV, in workbook order: shared strings resolved, inline strings and numbers as written. */
function xlsxText(bytes: Buffer): string {
  const files = unzipped(
    bytes,
    (name) =>
      name === 'xl/sharedStrings.xml' ||
      name === 'xl/workbook.xml' ||
      /^xl\/worksheets\/sheet\d+\.xml$/.test(name),
  );
  const shared = [...(files['xl/sharedStrings.xml'] ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(
    (m) => xmlText(m[1]),
  );
  const names = [
    ...(files['xl/workbook.xml'] ?? '').matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g),
  ].map((m) => decodeXml(m[1]));
  return Object.keys(files)
    .filter((name) => name.startsWith('xl/worksheets/'))
    .sort((a, b) => sheetNumber(a) - sheetNumber(b))
    .map((name, index) => {
      const rows = [...files[name].matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((row) =>
        [...row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
          .map((cell) => csvCell(cellValue(cell[1], cell[2] ?? '', shared)))
          .join(','),
      );
      return `--- Sheet ${names[index] ?? index + 1} ---\n${rows.join('\n')}`;
    })
    .join('\n\n');
}

function sheetNumber(name: string): number {
  return Number(/sheet(\d+)\.xml$/.exec(name)?.[1] ?? 0);
}

function cellValue(attributes: string, inner: string, shared: readonly string[]): string {
  const type = /\bt="([^"]*)"/.exec(attributes)?.[1];
  if (type === 'inlineStr') return xmlText(/<is>([\s\S]*?)<\/is>/.exec(inner)?.[1] ?? '');
  const value = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '';
  if (type === 's') return shared[Number(value)] ?? '';
  return decodeXml(value);
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function xmlText(xml: string): string {
  return decodeXml(xml.replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const point = Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
    })
    .replace(/&amp;/g, '&');
}
