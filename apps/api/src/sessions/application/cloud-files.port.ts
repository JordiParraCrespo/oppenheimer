import type { SessionFileMediaType } from '@oppenheimer/shared/protocol';
import type { SessionLaunchFile } from '../domain/session-launch-file.types';

/** A file of a cloud session's first task, as kept or as served. */
export interface CloudFile {
  mediaType: SessionFileMediaType;
  data: Buffer;
}

/** The session a cloud file belongs to: its files are kept under it. */
export interface CloudFileOwner {
  organizationId: string;
  sessionId: string;
}

/**
 * Where a cloud session's first-task files wait for the cloud's agent.
 *
 * The host only starts a cloud session (`claude --cloud`), so a file saved on
 * it would never reach the agent. Instead the files are **kept** in the
 * deployment's storage, under the session, for as long as the bucket keeps
 * them, and each launch **links** them: a short, unguessable link that serves
 * the file without a credential for a day. A create sent again (a reconnect)
 * mints fresh links to the same files.
 */
export interface CloudFilesPort {
  /** Keeps each file under the session and answers the id it is linked by, in order. */
  keep(owner: CloudFileOwner, files: readonly CloudFile[]): Promise<SessionLaunchFile[]>;
  /** A fresh link to one kept file. */
  link(owner: CloudFileOwner, file: SessionLaunchFile): Promise<string>;
  /**
   * The link `link` would answer, with a token of zeros: the same origin, path
   * and length, so a task is measured with what it will carry before anything
   * is kept or linked. It names no file.
   */
  sampleLink(): string;
  /** The file a live link names; `undefined` for one that expired or never was. */
  open(token: string): Promise<CloudFile | undefined>;
}
