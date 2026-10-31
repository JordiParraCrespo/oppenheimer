/**
 * The polish over its one model port, with the real `PolishLlmAdapter` in
 * front of a fake bot engine and a fake deployment `LlmService`: which stack
 * a clip runs on, what it is sent, and that every failure is the raw
 * transcript (null), never a thrown dictation. What a tidied answer may look
 * like is `voice-polish.policy.spec.ts`.
 */
import type { ConfigService } from '@nestjs/config';
import { type BotTurnRequest, FakeBotEngine } from '@oppenheimer/backend-agents';
import {
  type LlmCompletion,
  type LlmCompletionRequest,
  LlmRateLimitError,
  LlmService,
} from '@oppenheimer/backend-llm';
import { botDefaultModel } from '@oppenheimer/shared';
import { VoicePolishResolver } from '../application/voice-polish.resolver';
import { PolishLlmAdapter } from '../infrastructure/polish-llm.adapter';

class FakeDeploymentLlm extends LlmService {
  readonly provider = 'openrouter';
  readonly seen: LlmCompletionRequest[] = [];

  constructor(
    readonly defaultModel: string | undefined,
    private readonly answer: (request: LlmCompletionRequest) => string,
  ) {
    super();
  }

  isConfigured(): boolean {
    return this.defaultModel !== undefined;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletion> {
    this.seen.push(request);
    return {
      text: this.answer(request),
      model: request.model ?? this.defaultModel ?? '',
      provider: this.provider,
      finishReason: 'stop',
      usage: null,
    };
  }
}

function setup(options: {
  engine?: FakeBotEngine;
  deployment?: FakeDeploymentLlm;
  polishModel?: string;
}) {
  const engine = options.engine ?? new FakeBotEngine(() => [{ type: 'text.done', text: 'unused' }]);
  const deployment = options.deployment ?? new FakeDeploymentLlm(undefined, () => 'unused');
  const config = {
    get: (key: string) =>
      key === 'voice.polishModel'
        ? options.polishModel
        : key === 'voice.polishTimeoutMs'
          ? 5_000
          : undefined,
  } as unknown as ConfigService;
  return new VoicePolishResolver(new PolishLlmAdapter(engine, deployment), config);
}

const SIGN_IN = {
  provider: 'chatgpt',
  credential: { apiKey: 'access-token', accountId: 'account-1' },
} as const;

describe('VoicePolishResolver', () => {
  it("runs on the provider's credential through the bot engine, at its default model", async () => {
    let seen: BotTurnRequest | undefined;
    const engine = new FakeBotEngine((turn) => {
      seen = turn;
      return [{ type: 'text.done', text: 'Fix the login page.' }];
    });
    const deployment = new FakeDeploymentLlm('deployment-model', () => 'wrong stack');

    const polished = await setup({ engine, deployment }).polish('fix the login page', [], SIGN_IN);

    expect(polished).toBe('Fix the login page.');
    expect(seen).toMatchObject({
      provider: 'chatgpt',
      apiKey: 'access-token',
      accountId: 'account-1',
      model: botDefaultModel('chatgpt').id,
      effort: 'low',
    });
    expect(deployment.seen).toHaveLength(0);
  });

  it("names VOICE_POLISH_MODEL on the provider's credential", async () => {
    let model: string | undefined;
    const engine = new FakeBotEngine((turn) => {
      model = turn.model;
      return [{ type: 'text.done', text: 'Fix the login page.' }];
    });

    await setup({ engine, polishModel: 'polish-model' }).polish('fix the login page', [], SIGN_IN);

    expect(model).toBe('polish-model');
  });

  it("runs on the deployment's LLM, at its own model, when the provider brought no credential", async () => {
    const deployment = new FakeDeploymentLlm('deployment-model', () => 'Fix the login page.');

    const polished = await setup({ deployment, polishModel: 'polish-model' }).polish(
      'fix the login page',
      [],
      null,
    );

    expect(polished).toBe('Fix the login page.');
    expect(deployment.seen).toHaveLength(1);
    expect(deployment.seen[0]).toMatchObject({
      model: undefined,
      temperature: 0,
      timeoutMs: 5_000,
    });
  });

  it('answers null without a call when the deployment has no LLM', async () => {
    const deployment = new FakeDeploymentLlm(undefined, () => 'never');

    expect(await setup({ deployment }).polish('fix the login page', [], null)).toBeNull();
    expect(deployment.seen).toHaveLength(0);
  });

  it('answers null, not a throw, when the provider refuses for rate', async () => {
    const engine = new FakeBotEngine(() => [
      { type: 'done', reason: 'failed', error: '429', rateLimit: { resetAt: null } },
    ]);
    const deployment = new FakeDeploymentLlm('m', () => {
      throw new LlmRateLimitError('openrouter', '429', null);
    });
    const resolver = setup({ engine, deployment });

    expect(await resolver.polish('fix the login page', [], SIGN_IN)).toBeNull();
    expect(await resolver.polish('fix the login page', [], null)).toBeNull();
  });
});
