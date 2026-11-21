import { Inject, Injectable } from '@nestjs/common';
import { BOT_PROVIDER_CATALOG, POLISH_OFF, type VoiceSettings } from '@oppenheimer/shared';
import type { TurnCredentialsPort } from '../../bots/application/turn-credentials.port';
import { TURN_CREDENTIALS } from '../../bots/bots.di-tokens';
import type { PolishModel } from './speech-provider.port';

/** What a clip is tidied on: no polish at all, or a model (null is the deployment's LLM). */
export type PolishTarget = { polish: false } | { polish: true; model: PolishModel | null };

/**
 * Which model tidies a workspace's transcript, from its choice (Settings →
 * Model providers): `off` is none, the transcript as heard; a bot provider is
 * that provider's credential and the chosen model, read through the bots
 * module's `TURN_CREDENTIALS`; automatic, or a chosen provider whose
 * credential is gone or will not open, is the rule from before there was a
 * choice: the credential the speech provider brought, else the deployment's
 * LLM. A polish is not worth failing a dictation, so nothing here throws.
 */
@Injectable()
export class PolishModelResolver {
  constructor(@Inject(TURN_CREDENTIALS) private readonly credentials: TurnCredentialsPort) {}

  async targetFor(
    organizationId: string,
    settings: Pick<VoiceSettings, 'polishProvider' | 'polishModel'>,
    broughtBySpeech: PolishModel | null,
    now: Date,
  ): Promise<PolishTarget> {
    const { polishProvider: provider, polishModel } = settings;
    if (provider === POLISH_OFF) return { polish: false };
    if (provider !== null) {
      try {
        if (await this.credentials.has(organizationId, provider)) {
          const credential = await this.credentials.forTurn(organizationId, provider, now);
          const listed = BOT_PROVIDER_CATALOG[provider].models.some(
            (row) => row.id === polishModel,
          );
          return {
            polish: true,
            model: {
              provider,
              credential,
              ...(polishModel && listed ? { model: polishModel } : {}),
            },
          };
        }
      } catch {
        // A credential that will not open falls back below, like one that is not there.
      }
    }
    return { polish: true, model: broughtBySpeech };
  }
}
