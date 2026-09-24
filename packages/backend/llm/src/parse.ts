import type { LlmUsage } from './llm.types';

/** Without a budget a provider picks its own, which can be thousands of tokens. */
export const DEFAULT_MAX_TOKENS = 1024;

/** A JSON value as an object to read fields from, or `undefined`. */
export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Token counts under whichever two keys this provider uses, or `null`. */
export function usageFrom(
  usage: Record<string, unknown> | undefined,
  inputKey: string,
  outputKey: string,
): LlmUsage | null {
  const input = usage?.[inputKey];
  const output = usage?.[outputKey];
  if (typeof input !== 'number' || typeof output !== 'number') return null;
  return { inputTokens: input, outputTokens: output };
}
