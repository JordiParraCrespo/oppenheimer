import type { LlmService } from '@oppenheimer/backend-llm';
import type { PolishModel } from '../application/speech-provider.port';

/**
 * The model a dictation's polish runs on, as one `LlmService` whichever stack
 * answers: the workspace's credential through a bot engine when the speech
 * provider brought one (a ChatGPT sign-in), the deployment's LLM (`LLM_*`)
 * otherwise. The resolver asks this once per clip and calls `complete`.
 */
export interface PolishLlmPort {
  for(model: PolishModel | null): LlmService;
}
