/**
 * Where a report's pictures live: the deployment's storage, under each
 * picture's key. The files are private; nothing serves them but the report's
 * own content route.
 */
export interface InboxReportFilesPort {
  store(key: string, file: Buffer, mimeType: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  /** Deletes the file; one already gone is not an error. */
  remove(key: string): Promise<void>;
}
