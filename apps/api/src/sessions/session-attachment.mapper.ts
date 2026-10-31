import type { SessionAttachmentDto } from '@oppenheimer/shared';
import type { SessionFileMediaType } from '@oppenheimer/shared/protocol';
import type { CloudTaskFile } from './domain/cloud-task.policy';

/** A file a session's first task carries: the upload's answer, and the links a cloud task lists. */
export class SessionAttachmentMapper {
  /**
   * A cloud session's files as its task lists them: each file's type beside
   * the link it is downloaded from, in order (`cloudTaskWithFiles`).
   */
  static toCloudTaskFiles(
    files: readonly { mediaType: SessionFileMediaType }[],
    urls: readonly string[],
  ): CloudTaskFile[] {
    return files.map((file, i) => ({ url: urls[i] ?? '', mediaType: file.mediaType }));
  }

  /** What `POST /sessions/attachments` answers for an upload it staged. */
  static toResponse(
    id: string,
    mediaType: SessionFileMediaType,
    data: Buffer,
  ): SessionAttachmentDto {
    return { id, mediaType, size: data.length };
  }
}
