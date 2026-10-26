import type { BotTurnRequest } from '../bot-engine';
import { OpenAiBotEngine, type ResponsesEndpoint } from './openai-bot-engine';

/** xAI's API, which serves the Responses API the OpenAI Agents SDK speaks. */
const XAI_API_URL = 'https://api.x.ai/v1';

/**
 * Provider `xai`: the OpenAI engine pointed at xAI's API on the workspace's
 * xAI key. Grok's models take the same `reasoning.effort` the engine sends;
 * one that refuses it (Grok Build 0.1) is listed in the catalog with no
 * effort, so none is sent.
 */
export class XaiBotEngine extends OpenAiBotEngine {
  protected override endpoint(request: BotTurnRequest): ResponsesEndpoint | string {
    return { baseUrl: request.baseUrl ?? XAI_API_URL, modelSettings: {} };
  }
}
