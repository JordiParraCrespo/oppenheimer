import {
  BotAvatar,
  ChipSelectCombobox,
  ChipSelectItem,
  ChipSelectList,
  ChipSelectPopup,
  ChipSelectSearch,
  IconButton,
  Link,
  Popover,
  PopoverTrigger,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useBots } from '@oppenheimer/frontend-consumer/react';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { Link as RouterLink } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SECTION_NAMES } from '@/features/bots/lib/section-names';

/** The rows drawn while the bots load, by the width of each name: a short list's worth, so the popup opens at about its height. */
const LOADING_ROWS = ['w-28', 'w-36', 'w-24'];

/**
 * The plus on a section's Bots heading: a search over every bot, each with
 * a check for whether this section lists it, and a foot that says what the
 * check means, with New bot in the link blue (the one way to make a bot
 * from here) and the way to Employees, where bots are grouped, ordered and
 * deleted. A check flips the bot's placement at once and the popup stays
 * open for the next. The bots read arrives whole, as Employees' own search
 * has it, so the search filters it here, on the name and the description.
 *
 * The heading owns the open state (the empty line opens it too) and the
 * writes, so their failures show under the heading once the popup is closed.
 * `saving` is each placement in flight, by bot: that bot's check shows it and
 * holds still until it lands, and the others stay clickable.
 */
export function SectionBotsMenu({
  section,
  open,
  onOpenChange,
  creating,
  onCreate,
  saving,
  onPlace,
}: {
  section: BotSection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creating: boolean;
  onCreate: () => void;
  saving: ReadonlyMap<string, readonly BotSection[]>;
  onPlace: (bot: BotEntity, shown: boolean) => void;
}) {
  const { t } = useTranslation();
  const bots = useBots();
  const [query, setQuery] = useState('');
  const where = t(SECTION_NAMES[section]);
  const term = query.trim().toLowerCase();
  const visible = (bots.data ?? []).filter(
    (bot) => bot.name.toLowerCase().includes(term) || bot.description.toLowerCase().includes(term),
  );
  const shows = (bot: BotEntity) => (saving.get(bot.id) ?? bot.sections).includes(section);
  const toggle = (bot: BotEntity) => {
    if (!saving.has(bot.id)) onPlace(bot, !shows(bot));
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger
        render={
          <IconButton
            variant="quiet"
            size="xs"
            aria-label={t('bots.section.manage', { section: where })}
            title={t('bots.section.manage', { section: where })}
          />
        }
      >
        <Plus />
      </PopoverTrigger>
      {/* The popup's own padding is the one inset: the boxed search and the
          footer stand on the rows' grid inside it, so they line up with the rows. */}
      <ChipSelectPopup density="menu" align="end" width={272}>
        <ChipSelectCombobox query={query} onQueryChange={setQuery} autoHighlight="always">
          <ChipSelectSearch
            density="menu"
            variant="boxed"
            leadingSize="avatar"
            placeholder={t('bots.sidebar.search')}
            aria-label={t('bots.sidebar.search')}
          />
          {bots.isPending ? <LoadingStatus /> : null}
          <ChipSelectList
            density="menu"
            aria-multiselectable
            aria-label={t('bots.section.manage', { section: where })}
            rows={8}
            total={bots.data?.length ?? LOADING_ROWS.length}
            aria-busy={bots.isPending || undefined}
            empty={!bots.isPending && (bots.isError || visible.length === 0)}
            emptyText={
              bots.isError
                ? t('bots.sidebar.loadFailed')
                : term
                  ? t('bots.sidebar.noMatch', { query: query.trim() })
                  : t('bots.sidebar.emptyTitle')
            }
          >
            {bots.isPending
              ? LOADING_ROWS.map((width) => (
                  <ChipSelectItem
                    key={width}
                    density="menu"
                    aria-hidden
                    disabled
                    tabIndex={-1}
                    leading={<Skeleton shape="pill" className="size-5" />}
                    leadingSize="avatar"
                  >
                    <span className="flex h-5 items-center">
                      <Skeleton shape="sm" className={`h-3 ${width}`} />
                    </span>
                  </ChipSelectItem>
                ))
              : null}
            {visible.map((bot) => (
              <ChipSelectItem
                key={bot.id}
                density="menu"
                selected={shows(bot)}
                leading={
                  <BotAvatar option={{ initials: bot.initials }} size={20} face={bot.face} />
                }
                leadingSize="avatar"
                data-disabled={saving.has(bot.id) || undefined}
                aria-disabled={saving.has(bot.id) || undefined}
                onClick={() => toggle(bot)}
              >
                {bot.name}
              </ChipSelectItem>
            ))}
          </ChipSelectList>
        </ChipSelectCombobox>
        <div className="mt-1 flex flex-col gap-2 border-t border-border-subtle px-2.5 pt-2.5 pb-1.5 text-xs text-fg-subtle">
          <p>{t('bots.section.checkedHint', { section: where })}</p>
          <div className="flex items-center gap-4">
            <Link
              className="inline-flex items-center gap-1 font-medium"
              render={<button type="button" />}
              onClick={() => {
                onOpenChange(false);
                onCreate();
              }}
            >
              <Plus className="size-3.5" />
              {creating ? t('bots.sidebar.creating') : t('bots.sidebar.new')}
            </Link>
            <Link muted render={<RouterLink to="/bots" />} onClick={() => onOpenChange(false)}>
              {t('bots.section.manageAll', { employees: t('nav.employees') })}
            </Link>
          </div>
        </div>
      </ChipSelectPopup>
    </Popover>
  );
}
