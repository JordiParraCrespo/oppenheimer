export abstract class StorageService {
  abstract upload(file: Buffer, key: string, mimeType: string): Promise<string>;
  abstract delete(key: string): Promise<void>;
  abstract getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}
