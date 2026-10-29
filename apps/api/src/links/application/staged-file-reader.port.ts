import type { StagedFile, StagedFileOwner } from './parked-file.port';

/**
 * A person's staged uploads, read as they are, without parking them for a
 * host: what a session whose files never go to one needs (a cloud session's,
 * which the API keeps in storage instead). The same store as
 * `ParkedFilePort`, so an upload is staged once whichever place it is for.
 */
export interface StagedFileReaderPort {
  /**
   * The staged files, in order. They stay staged until they expire, as after
   * a claim. `undefined` when one is no longer staged, or is not `owner`'s.
   */
  readStaged(ids: readonly string[], owner: StagedFileOwner): Promise<StagedFile[] | undefined>;
}
