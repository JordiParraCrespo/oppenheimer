import { AgentModelSelect } from '@oppenheimer/design-system-web';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import type { BotProvider } from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  botEffort,
  botEngineValue,
  botProviderOptions,
  effortStops,
  providerOfMark,
} from '@/features/bots/lib/bot-engine';

/**
 * The composer's engine, for a bot: the models of the providers the
 * workspace has set up (`configured`) and of the bot's own, grouped by
 * provider (a pick sets both), and, when the model has a notion of it, how
 * hard it thinks, named on the same button ("GPT-6.2 Sol Low") and set by the
 * slider at the foot of its popup. Each pick is the bot's from then on; the
 * caller saves it. The effort is held here while the popup is open and handed
 * over once, when it closes: each pick is a save, and sliding across the
 * stops would otherwise be a burst of them that the API's rate limit refuses.
 */
export function BotEngineChips({
  provider,
  configured,
  model,
  effort,
  disabled,
  onModelChange,
  onEffortChange,
}: {
  provider: BotProvider;
  configured: readonly BotProvider[];
  model: string | null;
  effort: SessionEffort | null;
  disabled?: boolean;
  onModelChange: (next: { provider: BotProvider; model: string | null }) => void;
  onEffortChange: (effort: SessionEffort) => void;
}) {
  const { t } = useTranslation();
  const levels = botEffort(provider, model, effort);
  // The pick while the popover is open, not yet saved.
  const [draft, setDraft] = useState<SessionEffort | null>(null);

  return (
    <AgentModelSelect
      agents={botProviderOptions(configured, provider)}
      value={botEngineValue(provider, model)}
      onValueChange={(next) => {
        const picked = providerOfMark(next.agent);
        // A mark no provider is drawn with is no pick: nothing to save.
        if (picked) onModelChange({ provider: picked, model: next.model });
      }}
      effort={
        levels
          ? {
              stops: effortStops(levels.levels, {
                none: t('sessions.new.effort.none'),
                minimal: t('sessions.new.effort.minimal'),
                low: t('sessions.new.effort.low'),
                medium: t('sessions.new.effort.medium'),
                high: t('sessions.new.effort.high'),
                xhigh: t('sessions.new.effort.xhigh'),
                max: t('sessions.new.effort.max'),
                ultra: t('sessions.new.effort.ultra'),
              }),
              value: draft ?? levels.value,
              onValueChange: setDraft,
            }
          : undefined
      }
      onOpenChange={(open) => {
        if (open) return;
        if (levels && draft !== null && draft !== levels.value) onEffortChange(draft);
        setDraft(null);
      }}
      disabled={disabled}
      aria-label={t('bots.chat.model')}
      searchPlaceholder={t('bots.chat.searchModels')}
      emptyText={(query) => t('bots.chat.noModel', { query })}
      labels={{
        moreModels: t('sessions.new.agent.moreModels'),
        effort: t('sessions.new.effort.label'),
        faster: t('sessions.new.effort.faster'),
        smarter: t('sessions.new.effort.smarter'),
        effortHint: t('sessions.new.effort.hint'),
      }}
    />
  );
}
