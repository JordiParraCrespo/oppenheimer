import { z } from 'zod';

/**
 * What the console's live stream (`GET /v1/live`) carries: which row changed,
 * never the row. A console that hears one reads that row again through the
 * endpoint it already uses, under its own authorization, so the stream adds
 * no second way to see data (`product/versions/mvp/03-control-plane.md`, "The live stream, as built").
 */
export const liveEventSchema = z.discriminatedUnion('type', [
  /** A session was created, or its lifecycle or turn moved. */
  z.object({ type: z.literal('session.changed'), sessionId: z.string() }),
]);

export type LiveEvent = z.infer<typeof liveEventSchema>;

/** The SSE `event:` name every live event is sent under. */
export const LIVE_EVENT_NAME = 'live';

/**
 * How long one stream lives before the API ends it and the console dials
 * again. A dial is where the caller's session, workspace and flag are judged,
 * so this bounds how long a revoked caller keeps hearing ids.
 */
export const LIVE_STREAM_MAX_AGE_MS = 5 * 60_000;

/** How often an open stream sends a comment, so no proxy idles it out. */
export const LIVE_HEARTBEAT_MS = 25_000;
