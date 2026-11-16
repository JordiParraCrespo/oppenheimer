import { Button, ChipSelectItem, ChipSelectList, EmptyState } from '@oppenheimer/design-system-web';
import {
  BotIcon,
  ChevronLeftIcon,
  GlobeIcon,
  type LucideIcon,
  MonitorIcon,
  PanelsTopLeftIcon,
  SmartphoneIcon,
  SparklesIcon,
  SquareTerminalIcon,
} from '@oppenheimer/design-system-web/icons';
import type { CodingAgentId } from '@oppenheimer/shared/agents';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PreviewTab } from '../lib/preview-open';
import type { KeptSideItem } from '../lib/side-pane';
import { SideAgentPicker } from './side-agent-picker';
import { SideBotPicker } from './side-bot-picker';
import { SideSessionPicker } from './side-session-picker';

type Choice = 'terminal' | 'agent' | 'session' | 'bot' | PreviewTab;

const ICONS: Record<Choice, LucideIcon> = {
  terminal: SquareTerminalIcon,
  agent: SparklesIcon,
  session: PanelsTopLeftIcon,
  bot: BotIcon,
  browser: GlobeIcon,
  simulator: SmartphoneIcon,
  desktop: MonitorIcon,
};

/**
 * What the side pane offers when nothing in it is shown: the list of what can
 * open beside the session. A terminal opens at once; Agent, Session and Bot
 * slide to a pick, with Back; the previews are the ones this console and
 * deployment can show. The pane shows it while it is empty, and again from
 * the tab strip's plus.
 */
export function SidePaneLauncher({
  sessionId,
  sessionAgent,
  previews,
  terminals,
  bots,
  onOpen,
  onNewWindow,
  opening,
}: {
  sessionId: string;
  /** The agent window 0 runs, which the Agent pick may leave out. */
  sessionAgent: string;
  previews: readonly PreviewTab[];
  /** Whether this session's host can open windows: a shell, or another agent. */
  terminals: boolean;
  /** Whether the screen around the pane can draw a bot's chat. */
  bots: boolean;
  onOpen: (item: KeptSideItem) => void;
  /** Open a window running `agent`; `shell` is a plain terminal. */
  onNewWindow: (agent: CodingAgentId) => void;
  /** What a window is being opened for, while it opens. */
  opening: CodingAgentId | null;
}) {
  const { t } = useTranslation();
  const [pane, setPane] = useState<'root' | 'agent' | 'session' | 'bot'>('root');
  const choices: Choice[] = [
    ...(terminals ? (['terminal', 'agent'] as const) : []),
    'session',
    ...(bots ? (['bot'] as const) : []),
    ...previews,
  ];
  const label = (choice: Choice) =>
    choice === 'terminal' || choice === 'agent' || choice === 'session' || choice === 'bot'
      ? t(`sessions.side.launcher.${choice}`)
      : t(`sessions.preview.${choice}`);
  const choose = (choice: Choice) => {
    if (choice === 'terminal') onNewWindow('shell');
    else if (choice === 'agent' || choice === 'session' || choice === 'bot') setPane(choice);
    else onOpen({ kind: 'preview', tab: choice });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      {pane === 'root' ? (
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Title>{t('sessions.side.launcher.title')}</EmptyState.Title>
            <EmptyState.Description>
              {t('sessions.side.launcher.description')}
            </EmptyState.Description>
          </EmptyState.Header>
          <EmptyState.Content className="w-full text-left">
            <ChipSelectList
              density="menu"
              className="w-full"
              role="listbox"
              aria-label={t('sessions.side.launcher.title')}
            >
              {choices.map((choice) => {
                const Icon = ICONS[choice];
                return (
                  <ChipSelectItem
                    key={choice}
                    density="menu"
                    leading={<Icon className="size-4" />}
                    description={t(`sessions.side.launcher.${choice}Detail`)}
                    disabled={choice === 'terminal' && opening !== null}
                    aria-busy={choice === 'terminal' && opening === 'shell' ? true : undefined}
                    onClick={() => choose(choice)}
                  >
                    {choice === 'terminal' && opening === 'shell'
                      ? t('sessions.side.terminal.opening')
                      : label(choice)}
                  </ChipSelectItem>
                );
              })}
            </ChipSelectList>
          </EmptyState.Content>
        </EmptyState>
      ) : (
        <>
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setPane('root')}>
            <ChevronLeftIcon />
            {t('sessions.side.launcher.back')}
          </Button>
          {pane === 'agent' ? (
            <SideAgentPicker
              sessionAgent={sessionAgent}
              onPick={onNewWindow}
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
        </>
      )}
    </div>
  );
}
