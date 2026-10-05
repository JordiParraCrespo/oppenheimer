import type { SessionFileMediaType } from '@oppenheimer/shared/protocol';

/** A file (an image, a PDF, text) waiting for its host to pull it. */
export interface ParkedFile {
  hostId: string;
  sessionId: string;
  mediaType: SessionFileMediaType;
  data: Buffer;
}

/** Whose upload a staged file is: only its uploader, in that workspace, can name it. */
export interface StagedFileOwner {
  organizationId: string;
  userId: string;
}

/** A file uploaded for a session that does not exist yet. */
export interface StagedFile extends StagedFileOwner {
  mediaType: SessionFileMediaType;
  data: Buffer;
}

/**
 * What a staged file became once a session claimed it: the id its host pulls.
 * `imageId` is the wire's name for it (`session.create`'s `images[]`), and the
 * name the log keeps on `prompt.first`, so it stays.
 */
export interface ClaimedFile {
  imageId: string;
  mediaType: SessionFileMediaType;
}

/**
 * Where a file waits for the runner that will pull it: one store, two states.
 *
 * **Staged**: uploaded by a person for a first task, owned by them and named by its
 * content and type, so the same bytes staged twice as one type are one id and a retried create names what
 * the first named. **Parked**: owned by a host. `session.image` and `session.create`
 * travel without bytes, keeping control frames small so one paste never queues ahead
 * of every pane on the host, and the runner pulls each once over HTTPS
 * (`GET /hosts/self/images/{imageId}`).
 *
 * A claim parks staged files for a session **before** its row is written, and the
 * log records the parked ids, so a create reaching its host late (a dropped link, a
 * reconnect) still names waiting files. Nothing here is durable past its expiry.
 */
export interface ParkedFilePort {
  park(commandId: string, file: ParkedFile): Promise<void>;
  /**
   * Keeps an upload for its owner and answers its id. Refuses (`undefined`)
   * when the owner already has as many waiting as one person may.
   */
  stage(file: StagedFile): Promise<string | undefined>;
  /**
   * Parks a copy of each staged file for one session on one host, in order.
   * The staged copies stay until they expire, so a create that fails after
   * this can be sent again. `undefined` when one is no longer staged.
   */
  claim(
    ids: readonly string[],
    owner: StagedFileOwner,
    target: { hostId: string; sessionId: string },
  ): Promise<ClaimedFile[] | undefined>;
  /**
   * Hand a file over **once**, and only to the host it was parked for. A
   * host asking for another host's file gets nothing, and the file stays
   * for its own.
   */
  collect(imageId: string, hostId: string): Promise<ParkedFile | undefined>;
}
