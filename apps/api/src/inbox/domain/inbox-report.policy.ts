import {
  INBOX_REPORT_IMAGE_MIME_TYPES,
  INBOX_REPORT_IMAGE_NAME_MAX,
  type InboxReportImageMimeType,
} from '@oppenheimer/shared';

/** Whether `mimeType` is one of the picture types a report carries. */
export function isInboxReportImageMimeType(mimeType: string): mimeType is InboxReportImageMimeType {
  return (INBOX_REPORT_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * A picture's name as it is kept: its last path segment, without control
 * characters, cut to `INBOX_REPORT_IMAGE_NAME_MAX`. A name is only shown.
 */
export function inboxReportImageName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  const printable = [...base].filter((char) => {
    const code = char.charCodeAt(0);
    return code >= 0x20 && code !== 0x7f;
  });
  return printable.join('').trim().slice(0, INBOX_REPORT_IMAGE_NAME_MAX);
}
