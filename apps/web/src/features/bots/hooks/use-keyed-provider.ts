import { useModelProviders } from '@oppenheimer/frontend-consumer/react';
import type { BotProvider } from '@oppenheimer/shared/schemas/bot';
import { useEffect, useEffectEvent, useRef } from 'react';
import { keyedProviderFor } from '@/features/bots/lib/bot-engine';

/**
 * A bot left on a provider with no key, while another provider has one (a
 * bot made before the API picked a keyed provider, or whose key was
 * removed), moves to that provider at its default model, saved through
 * `onMove`. The chat that owns the bot and its save calls it; the model
 * button only draws what it is given.
 */
export function useKeyedProvider(
  provider: BotProvider,
  onMove: (next: { provider: BotProvider; model: null }) => void,
): void {
  const { data: target } = useModelProviders({
    select: (rows) =>
      keyedProviderFor(
        rows.filter((row) => row.configured).map((row) => row.provider),
        provider,
      ),
  });
  const tried = useRef<string | null>(null);
  const move = useEffectEvent((to: BotProvider) => onMove({ provider: to, model: null }));

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
