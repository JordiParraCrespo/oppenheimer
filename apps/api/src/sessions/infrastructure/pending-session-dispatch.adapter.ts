import { Injectable } from '@nestjs/common';
import type {
  SessionDispatchOutcome,
  SessionDispatchPort,
} from '../application/session-dispatch.port';

/**
 * The dispatcher until there is a link to dispatch over.
 *
 * It **writes nothing**, and that is the whole of its design. One user action is
 * one entry in the log, appended by the command handler in the same transaction
 * as the row change it implies; a dispatcher that also appended would make every
 * click two entries in two transactions, so a crash between them leaves a session
 * that is owed a stop and is not stopped.
 *
 * `delivered: false` with the `host_offline` hint is an honest answer rather than
 * a placeholder: with no relay every host genuinely holds no link, and the console
 * reading that hint will read the same hint for a real offline host later. When a
 * dispatcher can actually fail to send, *that* is when a `session.dispatch_pending`
 * entry means something — written by the relay, about a send it attempted.
 */
@Injectable()
export class PendingSessionDispatchAdapter implements SessionDispatchPort {
  async create(): Promise<SessionDispatchOutcome> {
    return OFFLINE;
  }

  async stop(): Promise<SessionDispatchOutcome> {
    return OFFLINE;
  }

  async restart(): Promise<SessionDispatchOutcome> {
    return OFFLINE;
  }

  async close(): Promise<SessionDispatchOutcome> {
    return OFFLINE;
  }

  async addCheckout(): Promise<SessionDispatchOutcome> {
    return OFFLINE;
  }

  async removeCheckout(): Promise<SessionDispatchOutcome> {
    return OFFLINE;
  }
}

const OFFLINE: SessionDispatchOutcome = { delivered: false, hints: ['host_offline'] };
