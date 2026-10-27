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
} from '@oppenheimer/design-system-web';
import { SlidersVertical } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import {
  ALL,
  FACETS,
  type FilterOption,
  type SessionFacet,
  type SessionFilters,
  type SessionSort,
} from '../lib/session-filters';

const SORTS: SessionSort[] = ['custom', 'recent', 'oldest', 'name'];

/**
 * Which projects the sidebar draws: every project in the Project facet's
 * options with a check, the ones in `hidden` without. Hiding is not
 * filtering, so Clear filters leaves it.
 */
export interface ProjectVisibility {
  hidden: readonly string[];
  /** How many projects are hidden; `hidden` may hold ids of projects since deleted. */
  hiddenCount: number;
  onShownChange: (id: string, shown: boolean) => void;
  onShowAll: () => void;
}

/**
 * The filter button beside the session count and its menu (the artboard's
 * `.op-iconbtn-sm` and `.op-filtermenu`). The button is lit while the menu is
 * open *or* while anything is hidden, by a filter or a hidden project. Props
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
}: {
  filters: SessionFilters;
  options: Record<SessionFacet, FilterOption[]>;
  dirty: boolean;
  visibility: ProjectVisibility;
  onChange: (patch: Partial<SessionFilters>) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const projects = options.project.filter((option) => option.value !== ALL);
  const labelFor = (facet: SessionFacet) =>
    options[facet].find((option) => option.value === filters[facet])?.label ?? '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconButton
            size="xs"
            variant="quiet"
            aria-label={t('sessions.filters.label')}
            data-dirty={dirty || visibility.hiddenCount > 0 || undefined}
          />
        }
      >
        <SlidersVertical />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="min-w-57.5">
        {FACETS.map((facet) => (
          <DropdownMenuSub key={facet}>
            <DropdownMenuSubTrigger>
              {t(`sessions.filters.${facet}`)}
              <DropdownMenuValue>{labelFor(facet)}</DropdownMenuValue>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={filters[facet]}
                onValueChange={(next) => onChange({ [facet]: next as string })}
              >
                {options[facet].map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}

        <DropdownMenuSeparator />

        {/* A check per project; the menu stays open so several can be
            toggled in one go. */}
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
          <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
            {projects.map((project) => (
              <DropdownMenuCheckboxItem
                key={project.value}
                checked={!visibility.hidden.includes(project.value)}
                onCheckedChange={(shown) => visibility.onShownChange(project.value, shown)}
                closeOnClick={false}
              >
                {project.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={visibility.hiddenCount === 0}
              onClick={visibility.onShowAll}
              closeOnClick={false}
            >
              {t('sessions.filters.showAll')}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

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
