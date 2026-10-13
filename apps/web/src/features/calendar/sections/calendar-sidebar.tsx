import { CalendarLayerItem, SidebarListHead } from '@oppenheimer/design-system-web';
import { CalendarDays, CircleCheck, User, Zap } from '@oppenheimer/design-system-web/icons';
import { getRouteApi } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CALENDAR_LAYERS,
  type CalendarLayer,
  hiddenLayers,
  toggleLayer,
} from '../lib/calendar-search';
import { GoogleAccountsCard } from './google-accounts-card';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/** Each layer's glyph: the month draws its entries with the same. */
const ICON: Record<CalendarLayer, ReactNode> = {
  events: <User />,
  google: <CalendarDays />,
  tasks: <CircleCheck />,
  automations: <Zap />,
};

/**
 * The calendar's sidebar list (the 2026-10-13 `Tasks` frame): Calendars, a
 * toggle per layer kept in the address so a link shows the same month, and
 * the Google accounts.
 */
export function CalendarSidebar() {
  const { t } = useTranslation();
  // `useMatch`, not `useSearch`: the shell mounts this sidebar and outlives
  // the calendar, so a navigation away renders it once more with the
  // calendar's match already gone.
  const off = calendar.useMatch({ shouldThrow: false, select: (match) => match.search.off });
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
      <GoogleAccountsCard />
    </div>
  );
}
