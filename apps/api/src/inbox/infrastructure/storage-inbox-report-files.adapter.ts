import { Injectable } from '@nestjs/common';
import { StorageService } from '@oppenheimer/backend-storage';
import type { InboxReportFilesPort } from './inbox-report-files.port';

@Injectable()
export class StorageInboxReportFilesAdapter implements InboxReportFilesPort {
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
      if ((error as { code?: string }).code !== 'ENOENT') throw error;
    }
  }
}
