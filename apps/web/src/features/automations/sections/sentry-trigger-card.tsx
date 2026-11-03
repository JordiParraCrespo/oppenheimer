import { TokenSentence, TriggerCard } from '@oppenheimer/design-system-web';
import { Bug } from '@oppenheimer/design-system-web/icons';
import { eventLabel } from '@oppenheimer/frontend-web';
import {
  externalEventDefinition,
  SENTRY_EVENT_TYPES,
  type SentryEventType,
} from '@oppenheimer/shared/automations';
import { useTranslation } from 'react-i18next';
import { ChoiceToken } from '../components/choice-token';
import { FilterToken } from '../components/filter-token';
import type { SentryCard } from '../lib/automation-draft';

/**
 * A Sentry trigger as a sentence: "[New Sentry issue] in [any project]", or
 * "[Sentry alert fired] for rule [Errors in production]". It listens on the
 * workspace's Sentry connection; under it, where the run works, since an
 * error names no repository.
 */
export function SentryTriggerCard({
  card,
  repository,
  onChange,
  onRemove,
}: {
  card: SentryCard;
  /** The automation's first repository's short name, where a run works; null before one is picked. */
  repository: string | null;
  onChange: (card: SentryCard) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const field = externalEventDefinition('sentry', card.event)?.filterField;
  const rule = field === 'rule';

  return (
    <TriggerCard
      icon={<Bug />}
      onRemove={onRemove}
      removeLabel={t('automations.editor.removeTrigger')}
      preview={
        <span>
          {repository
            ? t('automations.editor.sentryWhere', { repository })
            : t('automations.editor.sentryWhereNone')}
        </span>
      }
    >
      <TokenSentence>
        <ChoiceToken
          size="md"
          label={eventLabel(card.event, t)}
          value={card.event}
          options={SENTRY_EVENT_TYPES.map((event) => ({
            value: event,
            label: eventLabel(event, t),
            description: t(`automations.event.${event}.desc`),
          }))}
          onValueChange={(value) => {
            const event = value as SentryEventType;
            const sameField = externalEventDefinition('sentry', event)?.filterField === field;
            onChange({ ...card, event, filter: sameField ? card.filter : { op: 'any' } });
          }}
        />
        <span>{t(rule ? 'automations.editor.forRule' : 'automations.editor.inProject')}</span>
        <FilterToken
          key={`${card.event}-${field}`}
          filter={card.filter}
          mono={!rule}
          anyLabel={t(rule ? 'automations.editor.anyRule' : 'automations.editor.anyProject')}
          placeholder={t(
            rule ? 'automations.editor.rulePlaceholder' : 'automations.editor.projectPlaceholder',
          )}
          onFilterChange={(filter) => onChange({ ...card, filter })}
        />
      </TokenSentence>
    </TriggerCard>
  );
}
