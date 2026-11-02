import { strToU8, zipSync } from 'fflate';
import { DocumentAttachmentReaderAdapter } from '../infrastructure/document-attachment-reader.adapter';

/**
 * What a bot can take from an attachment (`product/next-steps/mail.md` §3.2):
 * the files people mail each other (an invoice PDF, a spreadsheet, a Word
 * document) read as text from real bytes built here, images handed back as
 * images, and anything else named and left closed, never run or unpacked.
 */

const reader = new DocumentAttachmentReaderAdapter();

function office(files: Record<string, string>): Buffer {
  return Buffer.from(
    zipSync(Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8(xml)]))),
  );
}

/** A one-page PDF whose text layer says `line`, with a correct cross-reference table. */
function pdfSaying(line: string): Buffer {
  const content = `BT /F1 12 Tf 72 720 Td (${line}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

describe('DocumentAttachmentReaderAdapter', () => {
  it('reads an invoice PDF’s text layer, page by page', async () => {
    const reading = await reader.read({
      filename: 'invoice-42.pdf',
      mimeType: 'application/pdf',
      bytes: pdfSaying('Total due: 1,250.00 EUR'),
    });
    expect(reading).toMatchObject({ kind: 'text', format: 'PDF, 1 page(s)', truncated: false });
    expect(reading.kind === 'text' && reading.text).toContain('Total due: 1,250.00 EUR');
  });

  it('reads a Word document’s paragraphs as lines', async () => {
    const reading = await reader.read({
      filename: 'contract.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      bytes: office({
        'word/document.xml':
          '<w:document><w:body><w:p><w:r><w:t>Term: 12 months</w:t></w:r></w:p><w:p><w:r><w:t>Fee &amp; VAT</w:t></w:r></w:p></w:body></w:document>',
      }),
    });
    expect(reading).toMatchObject({ kind: 'text', text: 'Term: 12 months\nFee & VAT' });
  });

  it('reads each sheet of a spreadsheet as CSV, shared strings resolved', async () => {
    const reading = await reader.read({
      filename: 'q3.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      bytes: office({
        'xl/workbook.xml':
          '<workbook><sheets><sheet name="Sales" sheetId="1"/></sheets></workbook>',
        'xl/sharedStrings.xml': '<sst><si><t>Region</t></si><si><t>Spain, north</t></si></sst>',
        'xl/worksheets/sheet1.xml':
          '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Total</t></is></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>1250.5</v></c></row></sheetData></worksheet>',
      }),
    });
    expect(reading).toMatchObject({
      kind: 'text',
      text: '--- Sheet Sales ---\nRegion,Total\n"Spain, north",1250.5',
    });
  });

  it('hands an image back as an image, for the chat to show', async () => {
    await expect(
      reader.read({ filename: 'photo.jpg', mimeType: 'image/jpeg', bytes: Buffer.from([0xff]) }),
    ).resolves.toEqual({ kind: 'image', mimeType: 'image/jpeg' });
  });

  it('leaves archives and programs closed, and says a damaged file could not be read', async () => {
    await expect(
      reader.read({ filename: 'all.zip', mimeType: 'application/zip', bytes: Buffer.from('PK') }),
    ).resolves.toMatchObject({ kind: 'unreadable' });
    await expect(
      reader.read({
        filename: 'setup.exe',
        mimeType: 'application/x-msdownload',
        bytes: Buffer.from('MZ'),
      }),
    ).resolves.toMatchObject({ kind: 'unreadable' });
    await expect(
      reader.read({ filename: 'broken.docx', mimeType: '', bytes: Buffer.from('not a zip') }),
    ).resolves.toMatchObject({ kind: 'unreadable', reason: expect.stringContaining('damaged') });
  });
});
