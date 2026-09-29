import type { SessionImageMediaType } from '@oppenheimer/shared/protocol';

/** An image waiting for its host to pull it. */
export interface ParkedImage {
  hostId: string;
  sessionId: string;
  mediaType: SessionImageMediaType;
  data: Buffer;
}

/** Whose upload a staged image is: only its uploader, in that workspace, can name it. */
export interface StagedImageOwner {
  organizationId: string;
  userId: string;
}

/** An image uploaded for a session that does not exist yet. */
export interface StagedImage extends StagedImageOwner {
  mediaType: SessionImageMediaType;
  data: Buffer;
}

/** What a staged image became once a session claimed it: the id its host pulls. */
export interface ClaimedImage {
  imageId: string;
  mediaType: SessionImageMediaType;
}

/**
 * Where an image waits for the runner that will pull it — one store, in two
 * states.
 *
 * **Staged** is an image a person uploaded for a first task, owned by them and
 * named by its content, so the same bytes staged twice are one image with one
 * id and a retry of the create names what the first try named. **Parked** is an
 * image a host owns: the link carries `session.image` and `session.create`
 * without their bytes — control frames stay small, and one paste must not queue
 * ahead of every pane on the host — so the runner pulls each once over HTTPS
 * (`GET /hosts/self/images/{imageId}`).
 *
 * A claim copies staged images to parked ones for a session **before** its row
 * is written, and the session's log records the parked ids, so a create that
 * reaches its host late — a dropped link, a reconnect — still names images
 * that are waiting. Nothing here is durable past its expiry.
 */
export interface ParkedImagePort {
  park(commandId: string, image: ParkedImage): Promise<void>;
  /**
   * Keeps an upload for its owner and answers its id. Refuses (`undefined`)
   * when the owner already has as many waiting as one person may.
   */
  stage(image: StagedImage): Promise<string | undefined>;
  /**
   * Parks a copy of each staged image for one session on one host, in order.
   * The staged copies stay until they expire, so a create that fails after
   * this can be sent again. `undefined` when one is no longer staged.
   */
  claim(
    ids: readonly string[],
    owner: StagedImageOwner,
    target: { hostId: string; sessionId: string },
  ): Promise<ClaimedImage[] | undefined>;
  /**
   * Hand an image over **once**, and only to the host it was parked for. A
   * host asking for another host's image gets nothing, and the image stays
   * for its own.
   */
  collect(imageId: string, hostId: string): Promise<ParkedImage | undefined>;
}
