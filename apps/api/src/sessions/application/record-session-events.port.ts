/**
 * One entry as a runner sends it, mirroring `sessionEventSchema` in
 * `@oppenheimer/shared/protocol`.
 *
 * Written out rather than imported: the API compiles with Node's classic module
 * resolution, which does not read a package's `exports` map, so the protocol
 * subpath is not reachable from here — and the module that owns the link is the one
 * that parses the wire message with the schema itself before calling this. What
 * crosses this boundary is therefore already validated; this interface is the shape
 * of what was validated.
 *
 * `seq` is deliberately absent: it is the control plane's to assign, under a row
 * lock, so a buggy or hostile host cannot create gaps or regress the log. `payload`
 * is the JSON **string** the wire carries, which is what makes the 8 KB cap
 * enforceable in TypeScript and in the Go generated from the same schema.
 */
export interface RunnerSessionEvent {
  idempotencyKey: string;
  kind: string;
  payload: string;
  /** ISO 8601, the writer's clock. */
  occurredAt: string;
}

/**
 * How the module that owns the runner link hands a batch of a runner's events to
 * the module that owns the log.
 *
 * The batch shape is the wire's, deliberately: `events.append` is what a runner
 * sends, and re-describing it here would be a second vocabulary for one message.
 * `seq` is absent from it, because `seq` is the control plane's to assign — under a
 * row lock, so a buggy or hostile host cannot create gaps or regress the log.
 */
export interface RunnerEventBatch {
  /**
   * A WebSocket cannot tell "persisted before the disconnect" from "never arrived",
   * so the handshake is explicit: the runner keeps the batch until an acknowledgement
   * naming this id accounts for every key in it.
   */
  batchId: string;
  sessionId: string;
  events: RunnerSessionEvent[];
  /**
   * The host that presented the credential. The caller has already authenticated
   * it; this is what lets the log refuse a host reporting about somebody else's
   * session.
   */
  hostId: string;
}

/**
 * The answer, which is the only thing that lets a runner drop a batch from memory.
 *
 * `accepted` lists the keys now durable — the rows that landed **and** the rows a
 * previous attempt had already landed, since both mean "stop resending this". A key
 * in neither list was not accounted for, so the runner resends the batch.
 */
export interface RunnerEventAck {
  batchId: string;
  accepted: string[];
  rejected: { idempotencyKey: string; reason: string }[];
}

export interface RecordSessionEventsPort {
  record(batch: RunnerEventBatch): Promise<RunnerEventAck>;
}
