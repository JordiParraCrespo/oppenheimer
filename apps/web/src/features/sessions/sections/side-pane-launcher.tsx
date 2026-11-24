import { Button, Launcher, LauncherItem } from '@oppenheimer/design-system-web';
import {
  BotIcon,
  ChevronLeftIcon,
  GlobeIcon,
  type LucideIcon,
  MessageSquarePlusIcon,
  MonitorIcon,
  PanelsTopLeftIcon,
  SmartphoneIcon,
  SparklesIcon,
  SquareTerminalIcon,
} from '@oppenheimer/design-system-web/icons';
import type { CodingAgentId } from '@oppenheimer/shared/agents';
import { type ComponentProps, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PreviewTab } from '../lib/preview-open';
import type { KeptSideItem, SideEngine } from '../lib/side-pane';
import { SideAgentPicker } from './side-agent-picker';
import { SideBotPicker } from './side-bot-picker';
import { SideSessionPicker } from './side-session-picker';

type Preview = Exclude<PreviewTab, 'browser'>;
type Pane = 'root' | 'chats' | 'agent' | 'session' | 'bot';

const PREVIEW_ICONS: Record<Preview, LucideIcon> = {
  simulator: SmartphoneIcon,
  desktop: MonitorIcon,
};

/**
 * What the side pane offers when nothing in it is shown: large rows centred
 * in the pane. Terminal opens a shell at once; Browser opens the session's
 * dev server; Side chats slides to a second list (another agent in this
 * worktree, another session, a bot), each of which slides to its pick, with
 * Back. The Simulator and the host's Desktop follow when this console and
 * deployment can show them. The pane shows it while it is empty, and again
 * from the tab strip's plus.
 */
export function SidePaneLauncher({
  sessionId,
  session,
  previews,
  terminals,
  bots,
  onOpen,
  onNewTerminal,
  onStartAgent,
  opening,
}: {
  sessionId: string;
  /** The session's own engine, which the Agent pick opens on. */
  session: ComponentProps<typeof SideAgentPicker>['session'];
  previews: readonly PreviewTab[];
  /** Whether this session's host can open windows: a shell, or another agent. */
  terminals: boolean;
  /** Whether the screen around the pane can draw a bot's chat. */
  bots: boolean;
  onOpen: (item: KeptSideItem) => void;
  onNewTerminal: () => void;
  onStartAgent: (engine: SideEngine) => void;
  /** What a window is being opened for, while it opens. */
  opening: CodingAgentId | null;
}) {
  const { t } = useTranslation();
  const [pane, setPane] = useState<Pane>('root');
  const others = previews.filter((tab): tab is Preview => tab !== 'browser');

  if (pane === 'root') {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto py-6">
        <Launcher aria-label={t('sessions.side.launcher.title')}>
          {terminals ? (
            <LauncherItem
              icon={<SquareTerminalIcon />}
              busy={opening === 'shell'}
              disabled={opening !== null}
              onClick={onNewTerminal}
            >
              {opening === 'shell'
                ? t('sessions.side.terminal.opening')
                : t('sessions.side.launcher.terminal')}
            </LauncherItem>
          ) : null}
          {previews.includes('browser') ? (
            <LauncherItem
              icon={<GlobeIcon />}
              onClick={() => onOpen({ kind: 'preview', tab: 'browser' })}
            >
              {t('sessions.preview.browser')}
            </LauncherItem>
          ) : null}
          <LauncherItem icon={<MessageSquarePlusIcon />} onClick={() => setPane('chats')}>
            {t('sessions.side.launcher.sideChats')}
          </LauncherItem>
          {others.map((tab) => {
            const Icon = PREVIEW_ICONS[tab];
            return (
              <LauncherItem
                key={tab}
                icon={<Icon />}
                onClick={() => onOpen({ kind: 'preview', tab })}
              >
                {t(`sessions.preview.${tab}`)}
              </LauncherItem>
            );
          })}
        </Launcher>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => setPane(pane === 'chats' ? 'root' : 'chats')}
      >
        <ChevronLeftIcon />
        {t('sessions.side.launcher.back')}
      </Button>
      {pane === 'chats' ? (
        <div className="flex flex-1 flex-col justify-center pb-12">
          <Launcher aria-label={t('sessions.side.launcher.sideChats')}>
            {terminals ? (
              <LauncherItem
                icon={<SparklesIcon />}
                detail={t('sessions.side.launcher.agentDetail')}
                onClick={() => setPane('agent')}
              >
                {t('sessions.side.launcher.agent')}
              </LauncherItem>
            ) : null}
            <LauncherItem
              icon={<PanelsTopLeftIcon />}
              detail={t('sessions.side.launcher.sessionDetail')}
              onClick={() => setPane('session')}
            >
              {t('sessions.side.launcher.session')}
            </LauncherItem>
            {bots ? (
              <LauncherItem icon={<BotIcon />} onClick={() => setPane('bot')}>
                {t('sessions.side.launcher.bot')}
              </LauncherItem>
            ) : null}
          </Launcher>
        </div>
      ) : pane === 'agent' ? (
        <SideAgentPicker
          session={session}
          onStart={onStartAgent}
          opening={opening === 'shell' ? null : opening}
        />
      ) : pane === 'session' ? (
        <SideSessionPicker
          currentSessionId={sessionId}
          onPick={(id) => onOpen({ kind: 'session', sessionId: id })}
        />
      ) : (
        <SideBotPicker onPick={(id) => onOpen({ kind: 'bot', botId: id })} />
      )}
    </div>
  );
}
