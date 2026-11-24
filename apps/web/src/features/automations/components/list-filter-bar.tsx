import type { SearchListOption } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import {
  type ListFilters,
  STATUS_TABS,
  type StatusTab,
  type TriggerSource,
} from '../lib/list-filters';
import { FilterClear } from './filter-clear';
import { FilterRow } from './filter-row';
import { SearchChoiceToken } from './search-choice-token';
import { TriggerFacet } from './trigger-facet';

const ALL = '__all__';

/**
 * The filter row of the Automations and Bot routines tabs: the status pills
 * with their counts, the owner facet (a project, a bot) searchable over the
 * owners the caller lists, the Trigger facet over the sources the caller says
 * are used, and Clear while a filter is on. The table above it only says what
 * its owner is called and which owners and sources it has; an owner whose
 * name has not loaded yet is listed as "…", never as its id.
 */
export function ListFilterBar({
  filters,
  counts,
  owner,
  sources,
}: {
  filters: ListFilters;
  counts: Record<StatusTab, number>;
  owner: {
    allLabel: string;
    searchPlaceholder: string;
    options: SearchListOption[];
  };
  sources: readonly TriggerSource[];
}) {
  const { t } = useTranslation();
  const { state } = filters;
  const picked = owner.options.find((option) => option.value === state.owner)?.label;
  return (
    <FilterRow
      tabs={STATUS_TABS}
      value={state.status}
      label={(tab) => t(`automations.filter.${tab}`)}
      count={(tab) => counts[tab]}
      onValueChange={filters.setStatus}
    >
      <SearchChoiceToken
        label={picked ?? owner.allLabel}
        value={state.owner ?? ALL}
        dirty={state.owner !== null}
        searchPlaceholder={owner.searchPlaceholder}
        emptyText={(query) => t('common.search.noMatch', { query })}
        options={[{ value: ALL, label: owner.allLabel }, ...owner.options]}
        onValueChange={(value) => filters.setOwner(value === ALL ? null : value)}
      />
      <TriggerFacet value={state.trigger} sources={sources} onValueChange={filters.setTrigger} />
      {filters.dirty ? (
        <FilterClear onClick={filters.clear}>{t('automations.runs.clear')}</FilterClear>
      ) : null}
    </FilterRow>
  );
}
