import type { BotProvider } from '@oppenheimer/shared/schemas/bot';
import { useEffect, useEffectEvent, useRef } from 'react';
import { keyedProviderFor } from '@/features/bots/lib/bot-engine';

/**
 * A bot on a provider with no key, while another provider has one, moves to
 * that provider at its default model, so the composer never sits on a model
 * it cannot send to while one it can is a pick away.
 */
export function useKeyedProvider(
  provider: BotProvider,
  configured: readonly BotProvider[] | undefined,
  onModelChange: (next: { provider: BotProvider; model: string | null }) => void,
): void {
  const target = configured ? keyedProviderFor(configured, provider) : undefined;
  const tried = useRef<string | null>(null);
  const move = useEffectEvent((to: BotProvider) => onModelChange({ provider: to, model: null }));

  // Saves the bot on the server. Each move is asked once, so a refused save
  // that snaps the bot back is said above the box, not retried in a loop.
  useEffect(() => {
    if (!target) return;
    const step = `${provider}>${target}`;
    if (tried.current === step) return;
    tried.current = step;
    move(target);
  }, [provider, target]);
}
