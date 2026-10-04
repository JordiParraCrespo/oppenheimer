import type { SessionFileMediaType } from '@oppenheimer/shared/protocol';

/**
 * One image a first task carries: the id its host pulls it by, and what it is.
 *
 * Only the id travels on `session.create`; the bytes wait in the image store
 * until the runner pulls them. The pair is recorded on the log's
 * `prompt.first`, beside the task's text, so a create sent again after a
 * reconnect names the same images.
 */
export interface SessionLaunchImage {
  imageId: string;
  mediaType: SessionFileMediaType;
}
