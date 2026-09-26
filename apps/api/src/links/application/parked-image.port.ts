import type { SessionImageMediaType } from '@oppenheimer/shared/protocol';

/** An image waiting for its host to pull it. */
export interface ParkedImage {
  hostId: string;
  sessionId: string;
  mediaType: SessionImageMediaType;
  data: Buffer;
}

/**
 * Where a pasted image waits between the upload and the runner's pull.
 *
 * The link carries `session.image` without its bytes — control frames stay
 * small, and one paste must not queue ahead of every pane on the host — so the
 * control plane parks the image under the command's id and the runner pulls it
 * once over HTTPS (`GET /hosts/self/images/{commandId}`). Parked images are
 * short-lived: a paste that is not pulled within a minute or two is for a
 * prompt that has moved on.
 */
export interface ParkedImagePort {
  park(commandId: string, image: ParkedImage): Promise<void>;
  /**
   * Hand an image over **once**, and only to the host it was parked for. A
   * host asking for another host's image gets nothing, and the image stays
   * for its own.
   */
  collect(commandId: string, hostId: string): Promise<ParkedImage | undefined>;
}
