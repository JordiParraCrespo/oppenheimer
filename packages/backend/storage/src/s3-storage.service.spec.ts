import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { S3StorageService } from './s3-storage.service';

function storage() {
  const config = {
    get: (key: string) =>
      ({
        'storage.s3Bucket': 'bucket',
        'storage.s3Region': 'auto',
        'storage.s3Endpoint': 'https://s3.example.com',
        'storage.s3AccessKeyId': 'id',
        'storage.s3SecretAccessKey': 'secret',
      })[key],
  } as unknown as ConfigService;
  return new S3StorageService(config);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('S3StorageService', () => {
  it('puts the object and resolves to its key, as the local back-end does', async () => {
    const send = vi.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);

    await expect(storage().upload(Buffer.from('x'), 'avatars/u/1.png', 'image/png')).resolves.toBe(
      'avatars/u/1.png',
    );

    const [command] = send.mock.calls[0] as [PutObjectCommand];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'bucket',
      Key: 'avatars/u/1.png',
      ContentType: 'image/png',
    });
  });

  it('signs a URL for the key with getUrl', async () => {
    const url = await storage().getUrl('avatars/u/1.png', 60);

    expect(url).toContain('avatars/u/1.png');
    expect(url).toContain('X-Amz-Expires=60');
  });
});
