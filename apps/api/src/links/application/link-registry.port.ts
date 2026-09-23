import type { ProtocolMessage } from '@oppenheimer/shared/protocol';

/**
 * A live runner link, as the rest of the control plane sees it: something a
 * control message or a PTY frame can be sent down, and a table of the
 * attachments open on it.
 *
 * The socket itself stays inside the relay module. What crosses this port is
 * already-shaped protocol messages (`@oppenheimer/shared/protocol`) and bytes,
 * which is what lets the dispatcher and the tests exist without `ws`.
 */
export interface AttachmentSink {
  /** One PTY read, bare bytes. */
  deliver(bytes: Uint8Array): void;
  /** The attachment ended from the runner's side, or the link went away. */
  closed(reason: AttachmentClosedReason, detail?: string): void;
  /** The runner refused the command that opened this attachment. */
  refused(code: string, detail?: string): void;
}

export type AttachmentClosedReason = 'link_lost' | 'runner_closed';

/** A session command this link sent, remembered so a refusal of it can be recorded. */
export interface SentSessionCommand {
  type: string;
  sessionId: string;
}

export interface RunnerLink {
  readonly hostId: string;
  /** The runner's process id for idempotency keys; new on every runner start. */
  readonly runId: string;
  /** Bumped per accepted link on this host; frames from an older epoch are dropped. */
  readonly epoch: number;
  /**
   * Queue a control frame. It is the same union inbound frames are parsed with,
   * so what this process sends is what the shared package says it sends.
   * `false` when the socket is no longer writable.
   */
  send(message: ProtocolMessage): boolean;
  /** Queue a PTY frame for the runner: attachment id then bytes. */
  sendBinary(attachmentId: number, bytes: Uint8Array): boolean;
  /**
   * Take an attachment id on this link for `sink`, and remember which command
   * opened it so a `command.failed` for that command reaches the sink.
   */
  openAttachment(sink: AttachmentSink, commandId: string): number;
  /** Forget an attachment; the id is free once the runner has been told. */
  closeAttachment(attachmentId: number): void;
  attachment(attachmentId: number): AttachmentSink | undefined;
  /** The number of attachments open, for the heartbeat log and the tests. */
  readonly attachmentCount: number;
  /**
   * The session command this link sent under `commandId`, forgotten as it is
   * read: what a `command.failed` no attachment claims was a refusal of.
   */
  takeSessionCommand(commandId: string): SentSessionCommand | undefined;
}

export interface LinkRegistryPort {
  /**
   * A host's link came up. Returns the link it replaces, if the host already
   * held one: the caller closes the older socket, so a runner restarting fast
   * never fights its own ghost for attachment ids.
   */
  register(link: RunnerLink): RunnerLink | undefined;
  /** A link went away. A no-op when a newer link has already replaced it. */
  unregister(link: RunnerLink): void;
  find(hostId: string): RunnerLink | undefined;
  /** Allocate the epoch for the next link a host presents. */
  nextEpoch(hostId: string): number;
}
