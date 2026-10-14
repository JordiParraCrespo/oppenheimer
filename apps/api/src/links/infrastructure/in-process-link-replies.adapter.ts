import { Injectable } from '@nestjs/common';
import type { LinkRepliesPort, LinkReply, PendingReply } from '../application/link-replies.port';

interface Waiter {
  hostId: string;
  resolve: (reply: LinkReply | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * The waiters in a map keyed by `commandId`, each with its own timer. A reply
 * nobody waits for any longer (it came after the timeout) is not taken, and
 * goes on to the gateway's ordinary routing, which logs or drops it.
 */
@Injectable()
export class InProcessLinkReplies implements LinkRepliesPort {
  private readonly waiters = new Map<string, Waiter>();

  expect(hostId: string, commandId: string, timeoutMs: number): PendingReply {
    let settle: (reply: LinkReply | null) => void = () => {};
    const reply = new Promise<LinkReply | null>((resolve) => {
      settle = resolve;
    });
    const finish = (value: LinkReply | null) => {
      const waiter = this.waiters.get(commandId);
      if (!waiter) return;
      clearTimeout(waiter.timer);
      this.waiters.delete(commandId);
      waiter.resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    // A pending listing never holds the process open on shutdown.
    timer.unref?.();
    this.waiters.set(commandId, { hostId, resolve: settle, timer });
    return { reply, cancel: () => finish(null) };
  }

  settle(hostId: string, reply: LinkReply): boolean {
    const waiter = this.waiters.get(reply.commandId);
    if (!waiter || waiter.hostId !== hostId) return false;
    clearTimeout(waiter.timer);
    this.waiters.delete(reply.commandId);
    waiter.resolve(reply);
    return true;
  }
}
