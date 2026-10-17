import { AgentModelSelect, EffortPicker } from '@oppenheimer/design-system-web';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import type { BotProvider } from '@oppenheimer/shared/schemas/bot';
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
 * hard it thinks. Each pick is the bot's from then on; the caller saves it.
 * The effort is handed over once, when its popover closes, so sliding
 * across the stops is one save rather than one per stop.
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

  return (
    <>
      <AgentModelSelect
        agents={botProviderOptions(configured, provider)}
        value={botEngineValue(provider, model)}
        onValueChange={(next) => {
          const picked = providerOfMark(next.agent);
          // A mark no provider is drawn with is no pick: nothing to save.
          if (picked) onModelChange({ provider: picked, model: next.model });
        }}
        disabled={disabled}
        aria-label={t('bots.chat.model')}
        searchPlaceholder={t('bots.chat.searchModels')}
        emptyText={(query) => t('bots.chat.noModel', { query })}
      />
      {levels ? (
        <EffortPicker
          value={levels.value}
          onValueCommit={onEffortChange}
          disabled={disabled}
          label={t('sessions.new.effort.label')}
          fasterLabel={t('sessions.new.effort.faster')}
          smarterLabel={t('sessions.new.effort.smarter')}
          hint={t('sessions.new.effort.hint')}
          stops={effortStops(levels.levels, {
            none: t('sessions.new.effort.none'),
            minimal: t('sessions.new.effort.minimal'),
            low: t('sessions.new.effort.low'),
            medium: t('sessions.new.effort.medium'),
            high: t('sessions.new.effort.high'),
            xhigh: t('sessions.new.effort.xhigh'),
            max: t('sessions.new.effort.max'),
            ultra: t('sessions.new.effort.ultra'),
          })}
        />
      ) : null}
    </>
  );
}
