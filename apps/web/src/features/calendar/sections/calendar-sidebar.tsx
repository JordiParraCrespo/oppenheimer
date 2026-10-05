import { Checkbox, cn, SidebarListHead } from '@oppenheimer/design-system-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LAYER_TONE } from '../components/calendar-chip';
import { CALENDAR_LAYERS, hiddenLayers, toggleLayer } from '../lib/calendar-search';
import { GoogleCalendarCard } from './google-calendar-card';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/**
 * The calendar's sidebar list (`20-plan-calendar.md` §1): a toggle per layer,
 * kept in the address so a link shows the same month, and the Google
 * Calendar card.
 */
export function CalendarSidebar() {
  const { t } = useTranslation();
  const { off } = calendar.useSearch();
  const navigate = calendar.useNavigate();
  const hidden = hiddenLayers(off);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SidebarListHead label={t('calendar.sidebar.layers')} />
      <div className="flex flex-col gap-0.5 px-3 pb-4">
        {CALENDAR_LAYERS.map((layer) => (
          // biome-ignore lint/a11y/noLabelWithoutControl: the checkbox inside is the control.
          <label
            key={layer}
            className="flex h-8 cursor-pointer items-center gap-2.5 rounded-sm px-2 text-sm hover:bg-hover-surface"
          >
            <Checkbox
              checked={!hidden.has(layer)}
              onCheckedChange={() =>
                navigate({
                  search: (previous) => ({ ...previous, off: toggleLayer(previous.off, layer) }),
                  replace: true,
                })
              }
            />
            <span className={cn('size-1.5 rounded-pill', LAYER_TONE[layer])} aria-hidden />
            <span className="text-fg">{t(`calendar.layers.${layer}`)}</span>
          </label>
        ))}
      </div>
      <GoogleCalendarCard />
    </div>
  );
}
