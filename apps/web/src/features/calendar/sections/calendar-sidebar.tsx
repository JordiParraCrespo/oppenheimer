import { CalendarLayerItem, SidebarListHead } from '@oppenheimer/design-system-web';
import { CalendarDays, CircleCheck, CircleDot, Zap } from '@oppenheimer/design-system-web/icons';
import { getRouteApi, useMatch } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CALENDAR_LAYERS,
  type CalendarLayer,
  hiddenLayers,
  toggleLayer,
} from '../lib/calendar-search';
import { GoogleCalendarCard } from './google-calendar-card';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/** Each layer's glyph: the month draws its entries with the same. */
const ICON: Record<CalendarLayer, ReactNode> = {
  events: <CircleDot />,
  google: <CalendarDays />,
  tasks: <CircleCheck />,
  automations: <Zap />,
};

/**
 * The calendar's sidebar list (`20-plan-calendar.md` §1): a toggle per layer,
 * kept in the address so a link shows the same month, and the Google
 * Calendar card.
 */
export function CalendarSidebar() {
  const { t } = useTranslation();
  // Drawn by the shell, and for a moment after the calendar's match is gone
  // while the board's sidebar loads: read it if it is there.
  const off = useMatch({
    from: '/_authenticated/plan/calendar',
    shouldThrow: false,
    select: (match) => match.search.off,
  });
  const navigate = calendar.useNavigate();
  const hidden = hiddenLayers(off);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SidebarListHead label={t('calendar.sidebar.layers')} />
      <div className="flex flex-col gap-0.5 px-3 pb-4">
        {CALENDAR_LAYERS.map((layer) => (
          <CalendarLayerItem
            key={layer}
            icon={ICON[layer]}
            checked={!hidden.has(layer)}
            onCheckedChange={() =>
              navigate({
                search: (previous) => ({ ...previous, off: toggleLayer(previous.off, layer) }),
                replace: true,
              })
            }
          >
            {t(`calendar.layers.${layer}`)}
          </CalendarLayerItem>
        ))}
      </div>
      <GoogleCalendarCard />
    </div>
  );
}
