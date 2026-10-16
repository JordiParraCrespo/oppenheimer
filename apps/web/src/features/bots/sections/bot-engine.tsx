import { useModelProviders } from '@oppenheimer/frontend-consumer/react';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import type { BotProvider } from '@oppenheimer/shared/schemas/bot';
import { BotEngineChips } from '@/features/bots/components/bot-engine-chips';

/**
 * The composer's engine chips, offering only the providers the workspace has
 * a key or a sign-in for (Settings → Model providers). It reads them here,
 * the lowest reader, so the list arriving re-renders the chips and not the
 * chat; until it does, only the bot's own provider is offered.
 */
export function BotEngine({
  provider,
  model,
  effort,
  onModelChange,
  onEffortChange,
}: {
  provider: BotProvider;
  model: string | null;
  effort: SessionEffort | null;
  onModelChange: (next: { provider: BotProvider; model: string | null }) => void;
  onEffortChange: (effort: SessionEffort) => void;
}) {
  const { data: configured = [] } = useModelProviders({
    select: (rows) => rows.filter((row) => row.configured).map((row) => row.provider),
  });

  return (
    <BotEngineChips
      provider={provider}
      configured={configured}
      model={model}
      effort={effort}
      onModelChange={onModelChange}
      onEffortChange={onEffortChange}
    />
  );
}
