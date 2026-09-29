import {
  BrandGlyph,
  TokenLiveDot,
  TokenSentence,
  TriggerCard,
  useNow,
} from '@oppenheimer/design-system-web';
import { useTriggerPreview } from '@oppenheimer/frontend-consumer/react';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { formatShortDuration } from '@oppenheimer/frontend-web';
import {
  externalEventDefinition,
  GITHUB_EVENT_TYPES,
  type GithubEventType,
} from '@oppenheimer/shared/automations';
import { useTranslation } from 'react-i18next';
import { ChoiceToken } from '../components/choice-token';
import { FilterToken } from '../components/filter-token';
import { MultiToken } from '../components/multi-token';
import { defaultFilter, type GithubCard } from '../lib/automation-draft';
import { eventLabel } from '../lib/trigger-text';

/** The word before the filter, by the attribute the event narrows on. */
const FILTER_WORD = {
  baseBranch: 'automations.editor.targeting',
  branch: 'automations.editor.on',
  label: 'automations.editor.labeled',
} as const;

/**
 * A GitHub trigger as a sentence (the frame's editor): "[Pull request opened]
 * in [xrp-mobile] targeting [main]". Under it, the live line: what the card
 * would have matched in the last week, replayed by the API against what the
 * webhook actually received, and the first two of those events.
 */
export function GithubTriggerCard({
  card,
  repositories,
  onChange,
  onRemove,
}: {
  card: GithubCard;
  /** The automation's repositories: GitHub's id and the short name. */
  repositories: { id: number; name: string }[];
  onChange: (card: GithubCard) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const now = useNow(CORE_CONFIG.clock.minuteMs);
  const definition = externalEventDefinition('github', card.event);
  const { key: _key, ...trigger } = card;
  const preview = useTriggerPreview(card.repositories.length ? trigger : undefined);

  const picked = repositories.filter((repository) => card.repositories.includes(repository.id));
  const reposLabel =
    picked.length === 1
      ? (picked[0]?.name ?? '')
      : picked.length === repositories.length
        ? t('automations.editor.anyOfRepos', { count: picked.length })
        : t('automations.editor.someRepos', { count: picked.length });
  const listeningOn =
    picked.length === 1
      ? (picked[0]?.name ?? '')
      : t('automations.editor.someRepos', { count: picked.length });

  const matches = preview.data?.matches ?? [];
  const summary = preview.data
    ? preview.data.count
      ? t('automations.editor.listening', { repos: listeningOn, count: preview.data.count })
      : t('automations.editor.listeningNone', { repos: listeningOn })
    : null;

  return (
    <TriggerCard
      icon={<BrandGlyph name="github" size={14} />}
      onRemove={onRemove}
      removeLabel={t('automations.editor.removeTrigger')}
      preview={
        summary ? (
          <div className="flex w-full flex-col gap-1.5">
            <span className="flex items-center gap-2">
              <TokenLiveDot />
              <span>{summary}</span>
            </span>
            {matches.slice(0, 2).map((match) => (
              <span
                key={`${match.repository}${match.ref}${match.occurredAt.getTime()}`}
                className="flex min-w-0 gap-2 text-xs"
              >
                <span className="figures shrink-0 text-fg">
                  {picked.length > 1 ? `${match.repository}${match.ref ?? ''}` : match.ref}
                </span>
                <span className="min-w-0 flex-1 truncate">{match.title}</span>
                <span className="shrink-0 text-fg-subtle">
                  {[match.actor, formatShortDuration(now - match.occurredAt.getTime(), t)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            ))}
          </div>
        ) : undefined
      }
    >
      <TokenSentence>
        <ChoiceToken
          size="md"
          label={eventLabel(card.event, t)}
          value={card.event}
          options={GITHUB_EVENT_TYPES.map((event) => ({
            value: event,
            label: eventLabel(event, t),
            description: t(`automations.event.${event}.desc`),
          }))}
          onValueChange={(value) => {
            const event = value as GithubEventType;
            onChange({ ...card, event, filter: defaultFilter(event) });
          }}
        />
        <span>{t('automations.editor.in')}</span>
        <MultiToken
          mono={picked.length === 1}
          label={reposLabel}
          heading={t('automations.editor.reposHead')}
          lastLabel={t('automations.editor.atLeastOne')}
          value={card.repositories.map(String)}
          options={repositories.map((repository) => ({
            value: String(repository.id),
            label: repository.name,
          }))}
          onValueChange={(ids) => onChange({ ...card, repositories: ids.map(Number) })}
        />
        {definition?.filterField ? (
          <>
            <span>{t(FILTER_WORD[definition.filterField])}</span>
            <FilterToken
              key={card.event}
              filter={card.filter}
              mono={definition.filterField !== 'label'}
              anyLabel={
                definition.filterField === 'label'
                  ? t('automations.editor.anyLabel')
                  : t('automations.editor.anyBranch')
              }
              placeholder={
                definition.filterField === 'label'
                  ? t('automations.editor.labelPlaceholder')
                  : t('automations.editor.branchPlaceholder')
              }
              onFilterChange={(filter) => onChange({ ...card, filter })}
            />
          </>
        ) : null}
      </TokenSentence>
    </TriggerCard>
  );
}
