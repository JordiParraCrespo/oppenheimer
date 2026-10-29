import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@oppenheimer/backend-cache';
import { StorageService } from '@oppenheimer/backend-storage';
import type { SessionFileMediaType } from '@oppenheimer/shared/protocol';
import type { CloudFile, CloudFileOwner, CloudFilesPort } from '../application/cloud-files.port';
import type { SessionLaunchFile } from '../domain/session-launch-file.types';

const LINK = 'cloud-file:';

/**
 * A day: the cloud's agent downloads its files when it starts, within
 * minutes, and may fetch one again later in the session. A link that outlived
 * that would be a credential-free copy of the file for as long as it lasts.
 */
export const CLOUD_FILE_LINK_TTL_SECONDS = 24 * 60 * 60;

/** A token that is never minted: a sample link's, the shape of every other. */
const SAMPLE_TOKEN = '00000000-0000-0000-0000-000000000000';

interface Linked {
  key: string;
  mediaType: SessionFileMediaType;
}

/**
 * `CloudFilesPort` over the deployment's storage (S3 in production) for the
 * bytes and the shared cache for the links.
 *
 * The bytes are served by the API itself (`GET /v1/cloud-files/{token}`), not
 * by a presigned bucket URL: the link is short enough to fit a 2 KB task, the
 * cloud environment only has to allow the API's host, and it works on the
 * local storage driver too. The origin is `CONTROL_PLANE_URL` (or the API's
 * own public URL), the name machines reach the API on.
 */
@Injectable()
export class StorageCloudFilesAdapter implements CloudFilesPort {
  constructor(
    private readonly storage: StorageService,
    private readonly cache: CacheService,
    private readonly configService: ConfigService,
  ) {}

  async keep(owner: CloudFileOwner, files: readonly CloudFile[]): Promise<SessionLaunchFile[]> {
    return Promise.all(
      files.map(async (file) => {
        const imageId = randomUUID();
        await this.storage.upload(file.data, keyOf(owner, imageId), file.mediaType);
        return { imageId, mediaType: file.mediaType };
      }),
    );
  }

  async link(owner: CloudFileOwner, file: SessionLaunchFile): Promise<string> {
    const token = randomUUID();
    await this.cache.set<Linked>(
      LINK + token,
      { key: keyOf(owner, file.imageId), mediaType: file.mediaType },
      CLOUD_FILE_LINK_TTL_SECONDS,
    );
    return this.urlOf(token);
  }

  sampleLink(): string {
    return this.urlOf(SAMPLE_TOKEN);
  }

  async open(token: string): Promise<CloudFile | undefined> {
    const linked = await this.cache.get<Linked>(LINK + token);
    if (!linked) return undefined;
    // A link whose bytes are gone (a bucket's lifecycle rule) names nothing.
    const data = await this.storage.download(linked.key).catch(() => undefined);
    return data ? { mediaType: linked.mediaType, data } : undefined;
  }

  private urlOf(token: string): string {
    return `${this.origin}/api/v1/cloud-files/${token}`;
  }

  private get origin(): string {
    return (this.configService.get<string>('hosts.controlPlaneUrl') ?? '').replace(/\/+$/, '');
  }
}

/** Under the workspace and the session, so a bucket rule or an erasure can find them. */
function keyOf(owner: CloudFileOwner, imageId: string): string {
  return `cloud-files/${owner.organizationId}/${owner.sessionId}/${imageId}`;
}
