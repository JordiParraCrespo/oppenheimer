import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BotEngine } from '@oppenheimer/backend-agents';
import { LlmService } from '@oppenheimer/backend-llm';
import { botDefaultModel } from '@oppenheimer/shared';

import {
  cleanPolished,
  VOICE_POLISH_SYSTEM_PROMPT,
  voicePolishMessage,
} from '../domain/voice-polish.policy';
import { VOICE_POLISH_ENGINE } from '../voice.di-tokens';
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
 * it has one. `VOICE_POLISH_MODEL` names the model on a provider's
 * credential; unset, it is that provider's default. It gets `VOICE_POLISH_TIMEOUT_MS`; on no model,
 * a timeout, a refusal or an answer that is not a tidied transcript, the
 * answer is null and the person gets the raw transcript. Nothing here
 * throws: a polish is not worth failing a dictation.
 */
@Injectable()
export class VoicePolishResolver {
  private readonly logger = new Logger(VoicePolishResolver.name);

  constructor(
    @Inject(VOICE_POLISH_ENGINE) private readonly engine: BotEngine,
    private readonly llm: LlmService,
    private readonly config: ConfigService,
  ) {}

  async polish(
    raw: string,
    vocabulary: readonly string[],
    model: PolishModel | null,
  ): Promise<string | null> {
    if (!raw.trim()) return null;
    const message = voicePolishMessage(raw, vocabulary);
    try {
      const answer = model
        ? await this.onProviderModel(model, message)
        : await this.onDeploymentLlm(message);
      return answer === null ? null : cleanPolished(answer, raw);
    } catch (error) {
      this.logger.warn(
        `No polish; using the transcript as heard: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async onProviderModel(
    { provider, credential }: PolishModel,
    message: string,
  ): Promise<string> {
    const model = this.polishModel ?? botDefaultModel(provider).id;
    const scratchDir = await mkdtemp(join(tmpdir(), 'voice-polish-'));
    try {
      return await this.engine.complete({
        provider,
        apiKey: credential.apiKey,
        accountId: credential.accountId,
        model,
        // Tidying is not reasoning; a model that takes no effort setting ignores it.
        effort: 'low',
        systemPrompt: VOICE_POLISH_SYSTEM_PROMPT,
        message,
        signal: AbortSignal.timeout(this.timeoutMs),
        scratchDir,
      });
    } finally {
      await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async onDeploymentLlm(message: string): Promise<string | null> {
    if (!this.llm.isConfigured() || !this.llm.defaultModel) return null;
    const completion = await this.llm.complete({
      system: VOICE_POLISH_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
      temperature: 0,
      // Two minutes of fast speech is about 400 words; the answer is no longer.
      maxTokens: 2048,
      timeoutMs: this.timeoutMs,
    });
    return completion.text;
  }

  private get polishModel(): string | undefined {
    return this.config.get<string>('voice.polishModel');
  }

  private get timeoutMs(): number {
    return this.config.get<number>('voice.polishTimeoutMs') ?? 6_000;
  }
}
