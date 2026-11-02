import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  cleanPolished,
  VOICE_POLISH_SYSTEM_PROMPT,
  voicePolishMessage,
} from '../domain/voice-polish.policy';
import type { PolishLlmPort } from '../infrastructure/polish-llm.port';
import { POLISH_LLM } from '../voice.di-tokens';
import type { PolishModel } from './speech-provider.port';

/**
 * Tidies a transcript into writing (`product/next-steps/voice.md`, step 2).
 * Every clip is tidied, a short one too: "fix the login page" should come
 * back as "Fix the login page." the way it would have been typed.
 *
 * **Polish first, the words as heard if it is not quick.** When the
 * provider that heard the clip brings a model credential (a ChatGPT sign-in
 * does), the polish runs on it, through the bot engine the way a bot's
 * conversation summary does; otherwise on the deployment's LLM (`LLM_*`) if
 * it has one. Either way it is one `LlmService` (`POLISH_LLM` picks which).
 * `VOICE_POLISH_MODEL` names the model on a provider's credential; unset, it
 * is that provider's default. It gets `VOICE_POLISH_TIMEOUT_MS`; on no model,
 * a timeout, a refusal or an answer that is not a tidied transcript, the
 * answer is null and the person gets the raw transcript. Nothing here
 * throws: a polish is not worth failing a dictation.
 */
@Injectable()
export class VoicePolishResolver {
  private readonly logger = new Logger(VoicePolishResolver.name);

  constructor(
    @Inject(POLISH_LLM) private readonly llms: PolishLlmPort,
    private readonly config: ConfigService,
  ) {}

  async polish(
    raw: string,
    vocabulary: readonly string[],
    model: PolishModel | null,
  ): Promise<string | null> {
    if (!raw.trim()) return null;
    const llm = this.llms.for(model);
    if (!llm.isConfigured() || !llm.defaultModel) return null;
    try {
      const completion = await llm.complete({
        system: VOICE_POLISH_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: voicePolishMessage(raw, vocabulary) }],
        timeoutMs: this.timeoutMs,
        // On a provider's credential, `VOICE_POLISH_MODEL` and the engine's own
        // settings (low effort, `PolishLlmAdapter`); a bot engine takes no
        // sampling settings. The deployment's LLM keeps its own `LLM_MODEL`.
        ...(model
          ? { model: this.polishModel }
          : // Two minutes of fast speech is about 400 words; the answer is no longer.
            { temperature: 0, maxTokens: 2048 }),
      });
      return cleanPolished(completion.text, raw);
    } catch (error) {
      this.logger.warn(
        `No polish; using the transcript as heard: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private get polishModel(): string | undefined {
    return this.config.get<string>('voice.polishModel');
  }

  private get timeoutMs(): number {
    return this.config.get<number>('voice.polishTimeoutMs') ?? 6_000;
  }
}
