import { AgentModelSelect, type AgentOption, type Engine } from '@oppenheimer/design-system-web';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import { useTranslation } from 'react-i18next';
import { type EffortChoice, toEffortStops } from '../lib/session-options';

/**
 * The composer's engine button: the agent, its model and how hard it thinks,
 * as one button so the foot row stays one line
 * (`product/versions/mvp/design/version1/NewSessionComposer.dc.html`). Its
 * popup has a tab per agent and one of Favourites, the models the reader
 * starred, from any agent; picking a model picks its agent, so the pair is
 * always valid. An agent with no listed models, the plain terminal, is one
 * row. The list is the shared catalog's (`lib/session-options.ts`). Whether
 * this host has the agent on `PATH` is a hint, never a gate, so no row is
 * disabled.
 *
 * `effort` is the draft's choice for the current model (`effortChoiceFor`);
 * a model with no notion of effort passes null, and the popup has no
 * slider. This is the one place that knows the effort levels' and the
 * favourites' words.
 */
export function AgentSelect({
  agents,
  value,
  onValueChange,
  favourites,
  onFavouritesChange,
  effort,
  onEffortChange,
  disabled,
}: {
  agents: AgentOption[];
  value: Engine;
  onValueChange: (value: Engine) => void;
  favourites: readonly string[];
  onFavouritesChange: (favourites: string[]) => void;
  /** The current model's levels and the one shown; none for a model without effort. */
  effort: Pick<EffortChoice, 'levels' | 'value'> | null;
  onEffortChange: (value: SessionEffort) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <AgentModelSelect
      agents={agents}
      value={value}
      onValueChange={onValueChange}
      favourites={favourites}
      onFavouritesChange={onFavouritesChange}
      effort={
        effort
          ? {
              value: effort.value,
              onValueChange: onEffortChange,
              stops: toEffortStops(effort.levels, {
                none: t('sessions.new.effort.none'),
                minimal: t('sessions.new.effort.minimal'),
                low: t('sessions.new.effort.low'),
                medium: t('sessions.new.effort.medium'),
                high: t('sessions.new.effort.high'),
                xhigh: t('sessions.new.effort.xhigh'),
                max: t('sessions.new.effort.max'),
                ultra: t('sessions.new.effort.ultra'),
              }),
            }
          : undefined
      }
      disabled={disabled}
      aria-label={t('sessions.new.agent.label')}
      searchPlaceholder={t('sessions.new.agent.search')}
      emptyText={(query) => t('sessions.new.agent.empty', { query })}
      labels={{
        favourites: t('sessions.new.agent.favourites'),
        favouritesEmpty: t('sessions.new.agent.favouritesEmpty'),
        addFavourite: (model) => t('sessions.new.agent.addFavourite', { model }),
        removeFavourite: (model) => t('sessions.new.agent.removeFavourite', { model }),
        effort: t('sessions.new.effort.label'),
        faster: t('sessions.new.effort.faster'),
        smarter: t('sessions.new.effort.smarter'),
        effortHint: t('sessions.new.effort.hint'),
      }}
    />
  );
}
