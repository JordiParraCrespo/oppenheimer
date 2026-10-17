import { describe, expect, it } from 'vitest';
import { engineCapabilities } from '../bot-engine.factory';
import { BUILT_IN_TOOLS } from '../claude/claude-options';

/**
 * What the prompt may promise of the engine itself. A bot told it can search
 * the web on an engine that cannot would make up what it "found".
 */
describe('engineCapabilities', () => {
  it('promises the Claude engines web search and a to-do list, the built-ins they keep', () => {
    expect(BUILT_IN_TOOLS).toEqual(['WebSearch', 'TodoWrite']);
    for (const provider of ['anthropic', 'glm'] as const) {
      expect(engineCapabilities(provider)).toEqual([
        'Search the web (web search).',
        'Keep a short to-do list of your own steps for this turn.',
      ]);
    }
  });

  it('promises the OpenAI engine nothing of its own', () => {
    expect(engineCapabilities('openai')).toEqual([]);
    expect(engineCapabilities('chatgpt')).toEqual([]);
  });
});
