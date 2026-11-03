import type { SessionWakeSource } from '../domain/session-prompt.policy';

/**
 * A line to type into a session for its own agent, once it is at its prompt
 * (`product/next-steps/agent-tools.md` §3–4). `wakeId` names the wake across
 * its attempts: the prompt it types is claimed by it, so it types once.
 */
export interface SessionWake {
  sessionId: string;
  wakeId: string;
  source: SessionWakeSource;
  text: string;
  /** How many times it found the agent busy; 0 for the first try. */
  attempt: number;
}

/** Where a wake waits for its time: a durable job, so it survives a restart. */
export interface SessionWakesPort {
  schedule(wake: SessionWake, at: Date, correlationId: string | null): Promise<void>;
}
