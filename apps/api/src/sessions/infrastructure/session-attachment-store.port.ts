import type { SessionImageMediaType } from '@oppenheimer/shared/protocol';

/** Whose upload it is: only the person who uploaded it, in that workspace, can name it. */
export interface SessionAttachmentOwner {
  organizationId: string;
  userId: string;
}

/** An image uploaded for a session that does not exist yet. */
export interface SessionAttachment extends SessionAttachmentOwner {
  id: string;
  mediaType: SessionImageMediaType;
  data: Buffer;
}

/**
 * Where an image attached to a first task waits between its upload and the
 * `POST /sessions` that names it.
 *
 * The composer uploads each file when the task is sent, and the create reads
 * them back by id. Nothing here is durable: an upload that no create names
 * expires on its own, and once a create has handed them to the host they are
 * removed.
 */
export interface SessionAttachmentStorePort {
  put(attachment: SessionAttachment): Promise<void>;
  /** The attachment, when it is still waiting and belongs to `owner`; never another person's. */
  find(id: string, owner: SessionAttachmentOwner): Promise<SessionAttachment | undefined>;
  remove(ids: readonly string[]): Promise<void>;
}
