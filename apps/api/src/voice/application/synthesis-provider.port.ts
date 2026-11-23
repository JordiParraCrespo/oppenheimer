import type { SynthesisProvider } from '@oppenheimer/shared';

/** The model and voice the workspace chose for this provider; null is the provider's default. */
export interface SynthesisChoice {
  model: string | null;
  voice: string | null;
}

/**
 * One way to speak a workspace's voice note, the synthesis counterpart of
 * `SpeechProvider`: a class implementing this, its id in
 * `SYNTHESIS_PROVIDERS` (`@oppenheimer/shared`), and its place in
 * `SynthesisProviderRegistry`'s list in `voice.module.ts`.
 *
 * - `availableFor` is cheap (a row read, a config read) and never calls the
 *   provider.
 * - `grantFor` is the credential for one call; it may throw, which counts as
 *   this provider failing.
 * - `synthesize` answers the provider's bytes, asked for as Ogg/Opus and not
 *   yet judged; `VOICE_009` for anything that is not audio, `VOICE_010` for a
 *   rate limit, through its gateway's `UpstreamLimiter`.
 */
export interface Synthesizer<A = unknown> {
  readonly id: SynthesisProvider;
  availableFor(organizationId: string): Promise<boolean>;
  grantFor(organizationId: string, now: Date): Promise<A>;
  synthesize(text: string, access: A, choice: SynthesisChoice): Promise<Buffer>;
}
