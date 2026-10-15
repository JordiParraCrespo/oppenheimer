import { AgentModelSelect, EffortPicker } from '@oppenheimer/design-system-web';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import { useTranslation } from 'react-i18next';
import {
  BOT_AGENT,
  botAgentOptions,
  botEffort,
  botModel,
  effortStops,
} from '@/features/bots/lib/bot-engine';

/**
 * The composer's engine, for a bot: Claude Code's models (a bot runs nothing
 * else) and, when the model has a notion of it, how hard it thinks. Each pick
 * is the bot's from then on; the caller saves it.
 */
export function BotEngineChips({
  model,
  effort,
  disabled,
  onModelChange,
  onEffortChange,
}: {
  model: string | null;
  effort: SessionEffort | null;
  disabled?: boolean;
  onModelChange: (model: string | null) => void;
  onEffortChange: (effort: SessionEffort) => void;
}) {
  const { t } = useTranslation();
  const levels = botEffort(model, effort);

  return (
    <>
      <AgentModelSelect
        agents={botAgentOptions()}
        value={{ agent: BOT_AGENT, model: botModel(model) }}
        onValueChange={(next) => onModelChange(next.model)}
        disabled={disabled}
        aria-label={t('bots.chat.model')}
        searchPlaceholder={t('bots.chat.searchModels')}
        emptyText={(query) => t('bots.chat.noModel', { query })}
      />
      {levels ? (
        <EffortPicker
          value={levels.value}
          onValueChange={onEffortChange}
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
