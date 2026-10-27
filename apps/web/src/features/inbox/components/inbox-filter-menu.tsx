import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuValue,
  IconButton,
} from '@oppenheimer/design-system-web';
import { SlidersVertical } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import type { InboxFilter } from '../lib/inbox-filter';
import { ALL_PROJECTS, INBOX_TYPES, type InboxTypeFilter } from '../lib/inbox-search';

export interface InboxFacetOption {
  value: string;
  label: string;
  count: number;
}

/**
 * The filter button beside the count and its menu (the frame's
 * `.op-filtermenu`): Type and Project, each option with its count, then Show
 * done and Clear filters. Lit while open or while anything is narrowed.
 * Props only: the list owns the filter, because it draws what it narrows.
 */
export function InboxFilterMenu({
  filter,
  typeCounts,
  projects,
  showDone,
  dirty,
  onTypeChange,
  onProjectChange,
  onShowDoneChange,
  onClear,
}: {
  filter: InboxFilter;
  typeCounts: Record<InboxTypeFilter, number>;
  /** Every project with an item, No project last, and All first. */
  projects: InboxFacetOption[];
  showDone: boolean;
  dirty: boolean;
  onTypeChange: (type: InboxTypeFilter) => void;
  onProjectChange: (project: string | null) => void;
  onShowDoneChange: (show: boolean) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const projectValue = filter.project ?? ALL_PROJECTS;
  const projectLabel =
    filter.project === null
      ? t('inbox.filter.any')
      : (projects.find((option) => option.value === filter.project)?.label ?? '');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconButton
            size="xs"
            variant="quiet"
            aria-label={t('inbox.filter.label')}
            data-dirty={dirty || undefined}
          />
        }
      >
        <SlidersVertical />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="min-w-57.5">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {t('inbox.filter.type')}
            <DropdownMenuValue>
              {filter.type === 'all' ? t('inbox.filter.any') : t(`inbox.type.${filter.type}`)}
            </DropdownMenuValue>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={filter.type}
              onValueChange={(next) => onTypeChange(next as InboxTypeFilter)}
            >
              {INBOX_TYPES.map((type) => (
                <DropdownMenuRadioItem key={type} value={type}>
                  {t(`inbox.type.${type}`)}
                  <DropdownMenuShortcut className="figures">
                    {typeCounts[type]}
                  </DropdownMenuShortcut>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {t('inbox.filter.project')}
            <DropdownMenuValue>{projectLabel}</DropdownMenuValue>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={projectValue}
              onValueChange={(next) =>
                onProjectChange(next === ALL_PROJECTS ? null : (next as string))
              }
            >
              {projects.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                  <DropdownMenuShortcut className="figures">{option.count}</DropdownMenuShortcut>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuCheckboxItem checked={showDone} onCheckedChange={onShowDoneChange}>
          {t('inbox.filter.showDone')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled={!dirty} onClick={onClear}>
          {t('inbox.filter.clear')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
