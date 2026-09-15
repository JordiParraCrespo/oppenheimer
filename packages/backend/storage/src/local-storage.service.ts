import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

@Injectable()
export class LocalStorageService extends StorageService {
  private readonly uploadDir: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.uploadDir = resolve(this.configService.get('storage.uploadDir') || './uploads');
    // Absolute base so a stored file resolves against the API from any web
    // origin (the SPA is served from a different origin in the Tier-1 topology).
    // Trailing slashes are trimmed so keys join cleanly as `${base}/uploads/…`.
    this.publicBaseUrl = (this.configService.get<string>('storage.publicUrl') ?? '').replace(
      /\/+$/,
      '',
    );
  }

  /** The URL a browser loads a stored file from: the API origin plus its key. */
  private toPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/uploads/${key}`;
  }

  /**
   * Resolve a caller-supplied key against the upload directory, guaranteeing the
   * result stays inside it. Keys such as `../../etc/passwd` (or absolute paths)
   * would otherwise escape the sandbox, so we reject anything that resolves
   * outside `uploadDir`.
   */
  private resolveKeyPath(key: string): string {
    const filePath = resolve(this.uploadDir, key);
    const root = this.uploadDir.endsWith(sep) ? this.uploadDir : `${this.uploadDir}${sep}`;
    if (filePath !== this.uploadDir && !filePath.startsWith(root)) {
      throw new BadRequestException('Invalid storage key');
    }
    return filePath;
  }

  async upload(file: Buffer, key: string, _mimeType: string): Promise<string> {
    const filePath = this.resolveKeyPath(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file);
    return this.toPublicUrl(key);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveKeyPath(key);
    await unlink(filePath);
  }

  async getSignedUrl(key: string): Promise<string> {
    return this.toPublicUrl(key);
  }
}
