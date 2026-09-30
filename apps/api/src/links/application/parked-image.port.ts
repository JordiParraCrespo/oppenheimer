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
 * Where an image waits for the runner that will pull it: one store, two states.
 *
 * **Staged**: uploaded by a person for a first task, owned by them and named by its
 * content, so the same bytes staged twice are one id and a retried create names what
 * the first named. **Parked**: owned by a host. `session.image` and `session.create`
 * travel without bytes, keeping control frames small so one paste never queues ahead
 * of every pane on the host, and the runner pulls each once over HTTPS
 * (`GET /hosts/self/images/{imageId}`).
 *
 * A claim parks staged images for a session **before** its row is written, and the
 * log records the parked ids, so a create reaching its host late (a dropped link, a
 * reconnect) still names waiting images. Nothing here is durable past its expiry.
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
