import { Injectable } from '@nestjs/common';
import { StorageService } from '@oppenheimer/backend-storage';
import type { BotAttachmentFilesPort } from './bot-attachment-files.port';

@Injectable()
export class StorageBotAttachmentFilesAdapter implements BotAttachmentFilesPort {
  constructor(private readonly storage: StorageService) {}

  async store(key: string, file: Buffer, mimeType: string): Promise<void> {
    await this.storage.upload(file, key, mimeType);
  }

  read(key: string): Promise<Buffer> {
    return this.storage.download(key);
  }

  async remove(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      // The sweep removes the row after the file; a file a previous sweep
      // deleted before it died is already where it should be.
      if ((error as { code?: string }).code !== 'ENOENT') throw error;
    }
  }
}
