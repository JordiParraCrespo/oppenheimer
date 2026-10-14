import { SettingsShell } from '@oppenheimer/design-system-web';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { BotSettingsScreen } from '@/features/bots/screens/bot-settings';
import { ConsoleRail } from '@/features/sessions/sections/console-rail';

/**
 * `/bots/$botId/settings/…`: a bot's settings (`design/version1/BotSettings.dc.html`).
 * Un-nested from `/bots` (`bots_`) and `shell: 'own'`, because the design
 * draws them beside the console's rail with no Employees sidebar: the rail,
 * then the bar saying whose settings these are over the pages' list and the
 * page. The rail still lights Employees (`useConsoleList` reads the route).
 */
export const Route = createFileRoute('/_authenticated/bots_/$botId/settings')({
  staticData: { shell: 'own' },
  component: BotSettingsLayout,
});

function BotSettingsLayout() {
  const { botId } = Route.useParams();
  return (
    <SettingsShell>
      <ConsoleRail />
      <BotSettingsScreen key={botId} botId={botId}>
        <Outlet />
      </BotSettingsScreen>
    </SettingsShell>
  );
}
