import {
  DropdownMenu,
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
import type { FilterOption, SessionFilters, SessionSort } from '../lib/session-filters';

/** The facets, in the order the artboard's menu lists them. */
const FACETS = ['repository', 'agent', 'host'] as const;

/** The orders it offers, likewise. */
const SORTS: SessionSort[] = ['recent', 'oldest', 'name'];

/**
 * The filter button beside the session count, and the menu it opens.
 *
 * Both are the artboard's `.op-iconbtn-sm` and `.op-filtermenu`: a 24px
 * square-cornered button carrying a 15px glyph, lit while the menu is open
 * *or* while anything is being hidden, over a 230px menu of three facets, an
 * order and a way back to all of them. Each facet names its current value on
 * the row and opens its choices beside it.
 *
 * Props only — the sidebar owns the filters, because it is the thing that
 * renders what they narrow.
 */
export function SessionsFilterMenu({
  filters,
  options,
  dirty,
  onChange,
  onClear,
}: {
  filters: SessionFilters;
  options: Record<(typeof FACETS)[number], FilterOption[]>;
  dirty: boolean;
  onChange: (patch: Partial<SessionFilters>) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const labelFor = (facet: (typeof FACETS)[number]) =>
    options[facet].find((option) => option.value === filters[facet])?.label ?? '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconButton
            size="xs"
            variant="quiet"
            aria-label={t('sessions.filters.label')}
            data-dirty={dirty || undefined}
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
