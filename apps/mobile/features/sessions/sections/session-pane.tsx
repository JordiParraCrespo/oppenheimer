import { useNow } from '@oppenheimer/design-system-mobile';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Clock, GitBranch } from '@oppenheimer/design-system-mobile/icons';
import { SegmentedControl } from '@oppenheimer/design-system-mobile/segmented-control';
import { Text } from '@oppenheimer/design-system-mobile/text';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { formatAge } from '@oppenheimer/frontend-mobile';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { ChatView } from '../components/chat-view';
import { TerminalView } from '../components/terminal-view';
import { useChatOffered } from '../hooks/use-chat-offered';
import { useSessionLink } from '../hooks/use-session-link';
import { SessionDock } from './session-dock';

type PaneView = 'terminal' | 'chat';
const AGE_TICK_MS = 60_000;

/**
 * A live session on the phone: the line with its branch, its age and the
 * Terminal / Chat switch (the system's segmented control, offered as the
 * console offers it: once the host sends the chat, with `session_chat_view`
 * on), the view picked, and the dock over its foot. One stream feeds both views; only the terminal
 * view sizes the host's window.
 */
export function SessionPane({ session }: { session: SessionEntity }) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const link = useSessionLink(session.id);
  const [picked, setPicked] = useState<PaneView>('terminal');
  const chatOffered = useChatOffered(link.chat);
  // Chat goes with the switch: a host that stops sending it leaves the terminal.
  const view: PaneView = chatOffered ? picked : 'terminal';
  const [dockHeight, setDockHeight] = useState(0);
  const now = useNow(AGE_TICK_MS);
  const branch = session.cwdCheckout?.branch ?? session.cloud?.branch ?? null;
  const status =
    link.status === 'connecting'
      ? t('sessions.mobile.connecting')
      : link.status === 'offline'
        ? t('sessions.session.hostLink.status.offline')
        : null;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <View className="flex-row items-center gap-3 border-b border-border-subtle px-4 py-2">
        <View className="min-w-0 flex-1 flex-row items-center gap-3">
          {branch ? (
            <View className="min-w-0 flex-shrink flex-row items-center gap-1">
              <Icon as={GitBranch} size={13} className="text-muted-foreground" />
              <Text variant="caption" numberOfLines={1}>
                {branch}
              </Text>
            </View>
          ) : null}
          <View className="flex-row items-center gap-1">
            <Icon as={Clock} size={13} className="text-muted-foreground" />
            <Text variant="caption">
              {formatAge(session.lastEventAt ?? session.createdAt, now, t)}
            </Text>
          </View>
          {status ? <Text variant="caption">{status}</Text> : null}
        </View>
        {chatOffered ? (
          <View style={{ width: 150 }}>
            <SegmentedControl
              value={view}
              options={[
                { value: 'terminal', label: t('sessions.chat.view.terminal') },
                { value: 'chat', label: t('sessions.chat.view.chat') },
              ]}
              onValueChange={setPicked}
            />
          </View>
        ) : null}
      </View>
      <View className="flex-1">
        {view === 'terminal' ? (
          <TerminalView
            screen={link.screen}
            scheme={colorScheme === 'light' ? 'light' : 'dark'}
            bottomInset={dockHeight}
            label={t('sessions.chat.view.terminal')}
            onSize={link.resize}
          />
        ) : (
          <ChatView
            chat={link.chat}
            bottomInset={dockHeight}
            labels={{
              loading: t('sessions.chat.loading.title'),
              emptyTitle: t('sessions.chat.empty.title'),
              emptyDescription: t('sessions.chat.empty.description'),
              working: t('sessions.chat.turn.working'),
              worked: t('sessions.chat.turn.worked'),
              steps: (count) => t('sessions.mobile.steps', { count }),
              interrupted: t('sessions.chat.turn.stopped'),
            }}
          />
        )}
        <SessionDock
          session={session}
          connected={link.status === 'live'}
          sendKeys={link.send}
          sendReply={(text) => link.chat.send(text)}
          onHeight={setDockHeight}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
