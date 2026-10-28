import {
  BotAvatar,
  ChipSelectItem,
  ChipSelectList,
  ChipSelectPopup,
  IconButton,
  Input,
  Link,
  Popover,
  PopoverTrigger,
} from '@oppenheimer/design-system-web';
import { Plus, Search } from '@oppenheimer/design-system-web/icons';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useBots } from '@oppenheimer/frontend-consumer/react';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { Link as RouterLink } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SECTION_NAMES } from '@/features/bots/lib/section-names';

/**
 * The plus on a section's Bots heading (`28-bots-in-sections.md`, slice D):
 * a search over every bot, each with a check for whether this section lists
 * it, and a foot that says what the check means, with New bot in the link
 * blue (the one way to make a bot from here) and the way to Employees, where bots are grouped, ordered and deleted. A check flips the bot's placement at once and the popup stays
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
  const [active, setActive] = useState(0);
  const where = t(SECTION_NAMES[section]);
  const term = query.trim().toLowerCase();
  const visible = (bots.data ?? []).filter(
    (bot) => bot.name.toLowerCase().includes(term) || bot.description.toLowerCase().includes(term),
  );
  const shows = (bot: BotEntity) => (saving.get(bot.id) ?? bot.sections).includes(section);
  const toggle = (bot: BotEntity) => {
    if (!saving.has(bot.id)) onPlace(bot, !shows(bot));
  };

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, visible.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const bot = visible[active];
      if (bot) toggle(bot);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        setActive(0);
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
      <ChipSelectPopup density="menu" align="end" width={272} className="p-0">
        <div className="px-1.5 pt-1.5 pb-1">
          <Input
            size="md"
            quiet
            // biome-ignore lint/a11y/noAutofocus: the search is the reason the popup opened
            autoFocus
            leading={<Search className="size-3.5" />}
            // Puts the placeholder over the bots' names, past their 20px avatars.
            inputClassName="pl-1"
            value={query}
            placeholder={t('bots.sidebar.search')}
            aria-label={t('bots.sidebar.search')}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        <ChipSelectList
          density="menu"
          role="listbox"
          aria-multiselectable
          aria-label={t('bots.section.manage', { section: where })}
          rows={8}
          total={bots.data?.length ?? 0}
          loading={bots.isPending}
          loadingText={t('common.loading')}
          empty={bots.isError || visible.length === 0}
          emptyText={
            bots.isError
              ? t('bots.sidebar.loadFailed')
              : term
                ? t('bots.sidebar.noMatch', { query: query.trim() })
                : t('bots.sidebar.emptyTitle')
          }
          className="px-1.5 pb-1.5"
        >
          {visible.map((bot, index) => (
            <ChipSelectItem
              key={bot.id}
              density="menu"
              selected={shows(bot)}
              highlighted={index === active}
              leading={<BotAvatar option={bot} size={20} color={bot.avatarColor} />}
              data-disabled={saving.has(bot.id) || undefined}
              aria-disabled={saving.has(bot.id) || undefined}
              onMouseEnter={() => setActive(index)}
              onClick={() => toggle(bot)}
            >
              {bot.name}
            </ChipSelectItem>
          ))}
        </ChipSelectList>
        <div className="flex flex-col gap-2 border-t border-border-subtle px-4 py-3 text-xs text-fg-subtle">
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
