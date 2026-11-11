'use client';

/**
 * Query key factory for the Inbox (`product/versions/mvp/29-inbox.md`). Its
 * items are read through their sources' own keys; what is the Inbox's alone
 * is the caller's marks, announced by `inboxMark.changed`, and the reports
 * sent to it, announced by `inboxReport.changed`. A report's pictures never
 * change under their ids, so they sit beside the list, not under it: an
 * event that refetches the list leaves them alone. Apart from the
 * hooks so the stream's table and the persistence list, which load with the
 * console, do not bring the Inbox's composition with them.
 */
export const inboxKeys = {
  all: ['inbox'] as const,
  marks: () => [...inboxKeys.all, 'marks'] as const,
  reports: () => [...inboxKeys.all, 'reports'] as const,
  reportImages: () => [...inboxKeys.all, 'report-images'] as const,
  reportImage: (reportId: string, imageId: string) =>
    [...inboxKeys.reportImages(), reportId, imageId] as const,
};
