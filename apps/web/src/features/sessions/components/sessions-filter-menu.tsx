import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuValue,
  IconButton,
  SearchList,
} from '@oppenheimer/design-system-web';
import { Plus, SlidersVertical } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import {
  ALL,
  type FilterOption,
  facetLabel,
  isMultiFacet,
  pickFacet,
  type SessionFacet,
  type SessionFilters,
  type SessionSort,
} from '../lib/session-filters';
import { FacetSearchSub } from './facet-search-sub';
import { SearchListFoot } from './search-list-foot';

const SORTS: SessionSort[] = ['custom', 'recent', 'oldest', 'name'];

/**
 * Which projects the sidebar draws: every project in the Project facet's
 * options with a check, the ones in `hidden` without, or none under Pinned
 * only. Hiding is not filtering, so Clear filters leaves it.
 */
export interface ProjectVisibility {
  hidden: readonly string[];
  /** How many projects are hidden; `hidden` may hold ids of projects since deleted. */
  hiddenCount: number;
  onShownChange: (id: string, shown: boolean) => void;
  onShowAll: () => void;
  pinnedOnly: boolean;
  onPinnedOnlyChange: (pinnedOnly: boolean) => void;
}

/**
 * The filter button beside the session count and its menu (the artboard's
 * `.op-iconbtn-sm` and `.op-filtermenu`). The button is lit while the menu is
 * open *or* while anything is hidden, by a filter, a hidden project or
 * Pinned only. Props
 * only: the sidebar owns the filters and the hidden projects, because it
 * renders what they narrow.
 */
export function SessionsFilterMenu({
  filters,
  options,
  dirty,
  visibility,
  onChange,
  onClear,
  onNewProject,
}: {
  filters: SessionFilters;
  options: Record<SessionFacet, FilterOption[]>;
  dirty: boolean;
  visibility: ProjectVisibility;
  onChange: (patch: Partial<SessionFilters>) => void;
  onClear: () => void;
  /** Opens the New project dialog, from the foot of the Project facet. */
  onNewProject: () => void;
}) {
  const { t } = useTranslation();
  const projects = options.project.filter((option) => option.value !== ALL);
  const labelFor = (facet: SessionFacet) =>
    facetLabel(filters, facet, options, (count) => t('sessions.filters.several', { count }));
  const pick = (facet: SessionFacet) => (value: string, selected: boolean) =>
    onChange(pickFacet(filters, facet, value, selected));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconButton
            size="xs"
            variant="quiet"
            aria-label={t('sessions.filters.label')}
            data-dirty={dirty || visibility.hiddenCount > 0 || visibility.pinnedOnly || undefined}
          />
        }
      >
        <SlidersVertical />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="min-w-57.5">
        {/* Project, Repository and Host grow with the workspace and are
            searched; the agents are a short fixed list of radio rows.
            A facet that takes several values draws each row as a check. */}
        <FacetSearchSub
          label={t('sessions.filters.project')}
          current={labelFor('project')}
          options={options.project}
          value={filters.project}
          multiple={isMultiFacet('project')}
          searchPlaceholder={t('common.search.projects')}
          onPick={pick('project')}
        >
          <SearchListFoot>
            <DropdownMenuItem onClick={onNewProject}>
              <Plus />
              {t('sessions.filters.newProject')}
            </DropdownMenuItem>
          </SearchListFoot>
        </FacetSearchSub>
        <FacetSearchSub
          label={t('sessions.filters.repository')}
          current={labelFor('repository')}
          options={options.repository}
          value={filters.repository}
          multiple={isMultiFacet('repository')}
          searchPlaceholder={t('common.search.repositories')}
          onPick={pick('repository')}
        />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {t('sessions.filters.agent')}
            <DropdownMenuValue>{labelFor('agent')}</DropdownMenuValue>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={filters.agent[0] ?? ALL}
              onValueChange={(agent) => pick('agent')(agent as string, true)}
            >
              {options.agent.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <FacetSearchSub
          label={t('sessions.filters.host')}
          current={labelFor('host')}
          options={options.host}
          value={filters.host}
          multiple={isMultiFacet('host')}
          searchPlaceholder={t('common.search.hosts')}
          onPick={pick('host')}
        />

        <DropdownMenuSeparator />

        {/* A check per project, under a search; the menu stays open so
            several can be toggled in one go. */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={projects.length === 0}>
            {t('sessions.filters.shown')}
            <DropdownMenuValue>
              {visibility.hiddenCount === 0
                ? t('sessions.filters.shownAll')
                : t('sessions.filters.shownSome', {
                    shown: projects.length - visibility.hiddenCount,
                    total: projects.length,
                  })}
            </DropdownMenuValue>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-68 p-0">
            <SearchList
              aria-label={t('sessions.filters.shown')}
              options={projects}
              value={projects
                .filter((project) => !visibility.hidden.includes(project.value))
                .map((project) => project.value)}
              onPick={(project, shown) => visibility.onShownChange(project.value, shown)}
              searchPlaceholder={t('common.search.projects')}
              emptyText={(query) => t('common.search.noMatch', { query })}
            />
            <SearchListFoot>
              <DropdownMenuItem
                disabled={visibility.hiddenCount === 0}
                onClick={visibility.onShowAll}
                closeOnClick={false}
              >
                {t('sessions.filters.showAll')}
              </DropdownMenuItem>
            </SearchListFoot>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuCheckboxItem
          checked={visibility.pinnedOnly}
          onCheckedChange={(checked) => visibility.onPinnedOnlyChange(checked)}
        >
          {t('sessions.filters.pinnedOnly')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {/* Ordering is not filtering, so the artboard divides it from the
            facets above and from the reset below. */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {t('sessions.filters.sort')}
            <DropdownMenuValue>{t(`sessions.sort.${filters.sort}`)}</DropdownMenuValue>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={filters.sort}
              onValueChange={(next) => onChange({ sort: next as SessionSort })}
            >
              {SORTS.map((sort) => (
                <DropdownMenuRadioItem key={sort} value={sort}>
                  {t(`sessions.sort.${sort}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled={!dirty} onClick={onClear}>
          {t('sessions.filters.clear')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
