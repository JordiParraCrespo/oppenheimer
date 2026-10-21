/**
 * Where a chat image's bytes live: the deployment's storage (`StorageService`),
 * under the attachment's key. The files are private; nothing serves them but
 * the bot's own content route.
 */
export interface BotAttachmentFilesPort {
  store(key: string, file: Buffer, mimeType: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  /** Deletes the file; one already gone is not an error. */
  remove(key: string): Promise<void>;
}
