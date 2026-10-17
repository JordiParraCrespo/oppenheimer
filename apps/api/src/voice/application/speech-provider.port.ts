import type { BotProvider, VoiceProvider } from '@oppenheimer/shared';
import type { TurnCredential } from '../../bots/application/turn-credentials.port';
import type { VoiceClip } from '../infrastructure/speech-to-text.port';

/** A model the polish may run on: a bot provider and the workspace's credential for it. */
export interface PolishModel {
  provider: BotProvider;
  credential: TurnCredential;
}

/**
 * What a provider hands over for one dictation: its own access (opaque to
 * everyone but the provider) and the model credential the polish may run on,
 * when the provider brings one (a ChatGPT sign-in does; a speech server key
 * does not, and the polish then runs on the deployment's LLM).
 */
export interface SpeechGrant<A = unknown> {
  access: A;
  polishOn: PolishModel | null;
}

/**
 * One way to hear a workspace's dictation (`product/next-steps/voice.md`).
 * Adding a provider is a class implementing this, its id in
 * `VOICE_PROVIDERS` (`@oppenheimer/shared`), and its place in
 * `SpeechProviderRegistry`'s list in `voice.module.ts`; the resolver, the
 * fallback, the status the console reads and the polish need nothing else.
 *
 * - `availableFor` is cheap (a row read, a config read) and never calls the
 *   provider: the console asks it on every visit to decide whether to show
 *   the mic.
 * - `grantFor` is the credential for one call, refreshed if it must be; it
 *   may throw (a lapsed sign-in), which counts as this provider failing.
 * - `transcribe` throws `VOICE_006` for anything that is not a transcript and
 *   `VOICE_007` for a rate limit, through its gateway's `UpstreamLimiter`.
 */
export interface SpeechProvider<A = unknown> {
  readonly id: VoiceProvider;
  availableFor(organizationId: string): Promise<boolean>;
  grantFor(organizationId: string, now: Date): Promise<SpeechGrant<A>>;
  transcribe(clip: VoiceClip, grant: SpeechGrant<A>): Promise<string>;
}
