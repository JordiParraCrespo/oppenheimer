import {
  BotEngine,
  type BotEngineEvent,
  type BotProvider,
  type BotTurnRequest,
} from './bot-engine';
import { ClaudeBotEngine } from './claude/claude-bot-engine';
import { ChatgptBotEngine } from './openai/chatgpt-bot-engine';
import { OpenAiBotEngine } from './openai/openai-bot-engine';
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

/** The engine for every provider: `anthropic` and `glm` on Claude, `openai` and `chatgpt` on OpenAI. */
export function createBotEngine(): BotEngine {
  const claude = new ClaudeBotEngine();
  return new ProviderBotEngine({
    anthropic: claude,
    glm: claude,
    openai: new OpenAiBotEngine(),
    chatgpt: new ChatgptBotEngine(),
  });
}
