import {
  BotEngine,
  type BotEngineEvent,
  type BotProvider,
  type BotTurnRequest,
} from './bot-engine';
import { ClaudeBotEngine } from './claude/claude-bot-engine';
import { ChatgptBotEngine } from './openai/chatgpt-bot-engine';
import { OpenAiBotEngine } from './openai/openai-bot-engine';
import { XaiBotEngine } from './openai/xai-bot-engine';
import { failed, guardTurn } from './turn';

/** Sends each turn to the engine its provider runs on. */
class ProviderBotEngine extends BotEngine {
  constructor(private readonly engines: Record<BotProvider, BotEngine>) {
    super();
  }

  run(request: BotTurnRequest): AsyncIterable<BotEngineEvent> {
    const engine = Object.hasOwn(this.engines, request.provider)
      ? this.engines[request.provider]
      : undefined;
    if (!engine) {
      return guardTurn(request, () => [failed(`Unknown provider: ${String(request.provider)}`)]);
    }
    return engine.run(request);
  }
}

/** The engine for every provider: `anthropic` and `glm` on Claude, `openai`, `chatgpt` and `xai` on OpenAI. */
export function createBotEngine(): BotEngine {
  const claude = new ClaudeBotEngine();
  return new ProviderBotEngine({
    anthropic: claude,
    glm: claude,
    openai: new OpenAiBotEngine(),
    chatgpt: new ChatgptBotEngine(),
    xai: new XaiBotEngine(),
  });
}

/** The providers that run on the OpenAI engine (the Responses API). */
const OPENAI_ENGINE_PROVIDERS: ReadonlySet<BotProvider> = new Set(['openai', 'chatgpt', 'xai']);

/**
 * What a provider's engine lets a bot do on its own, beside the tools the
 * request brings, in words for the prompt. The Claude engine keeps web
 * search (run on the provider's side) and a to-do list (`BUILT_IN_TOOLS`);
 * the OpenAI engine (`openai`, and `chatgpt` and `xai` on it) runs the
 * request's tools and nothing else.
 */
export function engineCapabilities(provider: BotProvider): readonly string[] {
  return OPENAI_ENGINE_PROVIDERS.has(provider)
    ? []
    : ['Search the web (web search).', 'Keep a short to-do list of your own steps for this turn.'];
}
