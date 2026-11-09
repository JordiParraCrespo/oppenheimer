import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuValue,
  IconButton,
  SearchList,
} from '@oppenheimer/design-system-web';
import { SlidersVertical } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * The filter button beside Search bots, and its menu: Show bots, a check per
 * bot under a search, which hides a bot from the sidebar or shows it again,
 * and Show all bots. The button is lit while a bot is hidden. Props only:
 * the sidebar owns the hidden bots, because it draws what they narrow.
 */
export function BotsFilterMenu({
  bots,
  hidden,
  onShownChange,
  onShowAll,
}: {
  bots: readonly { id: string; name: string }[];
  hidden: readonly string[];
  onShownChange: (id: string, shown: boolean) => void;
  onShowAll: () => void;
}) {
  const { t } = useTranslation();
  const options = bots.map((bot) => ({ value: bot.id, label: bot.name }));
  // `hidden` may hold ids of bots since deleted.
  const hiddenCount = bots.filter((bot) => hidden.includes(bot.id)).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconButton
            size="xs"
            variant="quiet"
            aria-label={t('bots.sidebar.filters')}
            data-dirty={hiddenCount > 0 || undefined}
          />
        }
      >
        <SlidersVertical />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-57.5">
        {/* The menu stays open so several bots can be toggled in one go. */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={bots.length === 0}>
            {t('bots.sidebar.shown')}
            <DropdownMenuValue>
              {hiddenCount === 0
                ? t('bots.sidebar.shownAll')
                : t('bots.sidebar.shownSome', {
                    shown: bots.length - hiddenCount,
                    total: bots.length,
                  })}
            </DropdownMenuValue>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-68 p-0">
            <SearchList
              aria-label={t('bots.sidebar.shown')}
              options={options}
              value={options
                .filter((option) => !hidden.includes(option.value))
                .map((option) => option.value)}
              onPick={(option, shown) => onShownChange(option.value, shown)}
              searchPlaceholder={t('bots.sidebar.search')}
              emptyText={(query) => t('common.search.noMatch', { query })}
            />
            <DropdownMenuSeparator className="mx-0" />
            <div className="p-1 pt-0">
              <DropdownMenuItem
                disabled={hiddenCount === 0}
                onClick={onShowAll}
                closeOnClick={false}
              >
                {t('bots.sidebar.showAll')}
              </DropdownMenuItem>
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
