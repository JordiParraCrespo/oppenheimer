import { Glass } from '@oppenheimer/design-system-mobile';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { ArrowUp } from '@oppenheimer/design-system-mobile/icons';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useAnswerSessionDecision } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { DecisionCard } from '../components/decision-card';
import { KeyRow } from '../components/key-row';
import { permissionAnswer, questionAnswer, togglePick } from '../lib/decision-answer';
import type { TerminalKey } from '../lib/terminal-keys';
import { withCtrl } from '../lib/terminal-keys';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/**
 * The glass at the foot of a session: what the agent waits on (answered
 * through the API, as the Inbox answers it), the keys a phone keyboard lacks,
 * and the reply line. A reply is typed into the agent's terminal the way a
 * person would, then Enter; while ctrl is held the next letter typed goes as
 * its control code instead.
 */
export function SessionDock({
  session,
  sendKeys,
  sendReply,
  onHeight,
}: {
  session: SessionEntity;
  sendKeys: (data: string) => void;
  sendReply: (text: string) => void;
  onHeight: (height: number) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [ctrl, setCtrl] = useState(false);
  const decision = session.isLive ? session.decision : null;
  const [answering, setAnswering] = useState<{ id: string; step: number; picks: number[][] }>({
    id: '',
    step: 0,
    picks: [],
  });
  const answer = useAnswerSessionDecision();

  // Picks belong to the decision they were made for; a new one starts over.
  const current =
    decision && answering.id === decision.id
      ? answering
      : { id: decision?.id ?? '', step: 0, picks: [] };

  const submit = (picks: number[][]) => {
    if (decision?.kind !== 'question') return;
    const body = questionAnswer(decision, picks);
    if (body) answer.mutate({ sessionId: session.id, answer: body });
  };

  const pick = (index: number) => {
    if (!decision) return;
    if (decision.kind === 'permission') {
      answer.mutate({ sessionId: session.id, answer: permissionAnswer(decision.id, index) });
      return;
    }
    const question = decision.questions[current.step];
    if (!question) return;
    const picks = [...current.picks];
    picks[current.step] = togglePick(picks[current.step] ?? [], index, question.multiSelect);
    if (question.multiSelect) {
      setAnswering({ ...current, picks });
      return;
    }
    advance(picks);
  };

  const advance = (picks: number[][]) => {
    if (decision?.kind !== 'question') return;
    if (current.step + 1 < decision.questions.length) {
      setAnswering({ id: decision.id, step: current.step + 1, picks });
      return;
    }
    setAnswering({ id: decision.id, step: current.step, picks });
    submit(picks);
  };

  const key = (pressed: TerminalKey) => {
    if (pressed.id === 'ctrl') {
      setCtrl((held) => !held);
      return;
    }
    if (pressed.sends) sendKeys(pressed.sends);
    setCtrl(false);
  };

  const type = (next: string) => {
    if (ctrl && next.length === draft.length + 1) {
      sendKeys(withCtrl(next.slice(-1)));
      setCtrl(false);
      return;
    }
    setDraft(next);
  };

  const send = () => {
    if (!draft.trim()) return;
    sendReply(draft);
    setDraft('');
  };

  return (
    <View
      className="absolute inset-x-0 bottom-0 px-3 pb-3"
      onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
      pointerEvents="box-none"
    >
      <Glass className="gap-3 rounded-[28px] pb-3">
        {decision ? (
          <DecisionCard
            decision={decision}
            step={current.step}
            picked={current.picks[current.step] ?? []}
            pending={answer.isPending}
            error={answer.isError ? t('sessions.mobile.answerFailed') : null}
            labels={{
              needsInput: t('sessions.session.state.waiting-on-you'),
              needsApproval: t('sessions.mobile.needsApproval'),
              send: t('inbox.session.send'),
              sending: t('inbox.session.sending'),
            }}
            onPick={pick}
            onSend={() => advance(current.picks)}
          />
        ) : null}
        <View className={decision ? '' : 'pt-3'}>
          <KeyRow ctrl={ctrl} onKey={key} label={t('sessions.mobile.keys')} />
        </View>
        <View className="flex-row items-center gap-2 px-3">
          <TextInput
            value={draft}
            onChangeText={type}
            onSubmitEditing={send}
            placeholder={decision ? t('sessions.mobile.replyToAgent') : t('sessions.mobile.reply')}
            accessibilityLabel={t('sessions.mobile.reply')}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            submitBehavior="submit"
            className="h-11 flex-1 rounded-xl bg-secondary px-3 text-[15px] text-foreground placeholder:text-ink-400"
            style={{ fontFamily: MONO }}
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityLabel={t('sessions.chat.composer.send')}
            className="size-11 items-center justify-center rounded-full bg-primary active:opacity-80 disabled:opacity-40"
          >
            <Icon as={ArrowUp} size={20} className="text-primary-foreground" />
          </Pressable>
        </View>
      </Glass>
    </View>
  );
}
