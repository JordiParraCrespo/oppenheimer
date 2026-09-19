import { randomUUID } from 'node:crypto';
import {
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
  Entity,
} from '@oppenheimer/backend-ddd';

/** Who wrote the entry. A host and the control plane are not the same witness. */
export type SessionEventSource = 'runner' | 'api';

/**
 * The payload cap, in bytes of its JSON form.
 *
 * It is the protocol's own `maxLength` on `events.append`, which is why the
 * number is repeated here rather than derived: the wire carries the payload as a
 * JSON *string* so the cap survives into the Go generated from the same schema,
 * and the control plane holds the same line for anything that arrives another way.
 * An event **never carries pane text** — PTY bytes go to the browser and to the
 * runner's ring buffer, never to Postgres.
 */
export const SESSION_EVENT_PAYLOAD_MAX_BYTES = 8 * 1024;

export interface WorkSessionEventProps {
  sessionId: string;
  /** Assigned by the control plane under a row lock, so the log has no gaps. */
  seq: number;
  /**
   * The writer's own key: `<runId>:<n>` from a runner, the command id from the
   * API. It depends on nothing the control plane hands out, so it survives any
   * reconnect, and `uq (sessionId, idempotencyKey)` is what makes a replayed
   * batch append only what was not yet seen.
   */
  idempotencyKey: string;
  source: SessionEventSource;
  kind: string;
  /** Parsed, and stored as jsonb. The wire's text stops at the boundary. */
  payload: unknown;
  occurredAt: Date;
  recordedAt: Date;
}

export interface CreateWorkSessionEventProps {
  sessionId: string;
  seq: number;
  idempotencyKey: string;
  source: SessionEventSource;
  kind: string;
  payload?: unknown;
  occurredAt?: Date;
  recordedAt?: Date;
}

/**
 * One entry of a session's append-only log, which is the truth per session.
 *
 * The entity has no mutators at all: an entry is a fact that happened, and the
 * only thing a log accepts is another entry. `seq` is not on the wire — a buggy
 * or hostile host must not be able to create gaps or regress the log — and
 * `occurredAt` is the writer's clock while `recordedAt` is ours, so a host with
 * a skewed clock cannot reorder anybody's history.
 */
export class WorkSessionEventEntity extends Entity<WorkSessionEventProps> {
  static create(create: CreateEntityProps<WorkSessionEventProps>): WorkSessionEventEntity {
    return new WorkSessionEventEntity(create);
  }

  static createNew(props: CreateWorkSessionEventProps): WorkSessionEventEntity {
    const now = new Date();
    return new WorkSessionEventEntity({
      id: randomUUID(),
      props: {
        sessionId: props.sessionId,
        seq: props.seq,
        idempotencyKey: props.idempotencyKey,
        source: props.source,
        kind: props.kind,
        payload: props.payload ?? {},
        occurredAt: props.occurredAt ?? now,
        recordedAt: props.recordedAt ?? now,
      },
    });
  }

  get sessionId(): string {
    return this.props.sessionId;
  }

  get seq(): number {
    return this.props.seq;
  }

  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  get source(): SessionEventSource {
    return this.props.source;
  }

  get kind(): string {
    return this.props.kind;
  }

  get payload(): unknown {
    return this.props.payload;
  }

  get occurredAt(): Date {
    return this.props.occurredAt;
  }

  get recordedAt(): Date {
    return this.props.recordedAt;
  }

  public validate(): void {
    if (!this.props.sessionId?.trim()) {
      throw new ArgumentNotProvidedException('A session event must belong to a session');
    }
    if (!this.props.kind?.trim()) {
      throw new ArgumentNotProvidedException('A session event must have a kind');
    }
    if (!this.props.idempotencyKey?.trim()) {
      throw new ArgumentNotProvidedException('A session event must carry an idempotency key');
    }
    if (payloadBytes(this.props.payload) > SESSION_EVENT_PAYLOAD_MAX_BYTES) {
      throw new ArgumentInvalidException(
        `A session event payload must be at most ${SESSION_EVENT_PAYLOAD_MAX_BYTES} bytes`,
      );
    }
  }
}

/** The payload's size as the wire measures it: the bytes of its JSON form. */
export function payloadBytes(payload: unknown): number {
  return Buffer.byteLength(JSON.stringify(payload ?? null), 'utf8');
}
