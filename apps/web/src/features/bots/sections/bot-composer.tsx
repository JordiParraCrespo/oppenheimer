import {
  ChatComposer,
  ComposerNotice,
  ComposerStack,
  ComposerStackAction,
  ComposerStackRow,
  FieldError,
} from '@oppenheimer/design-system-web';
import { KeyRound } from '@oppenheimer/design-system-web/icons';
import type { BotWaitingMessage } from '@oppenheimer/frontend-consumer';
import {
  useBotActiveTurn,
  useBotGoal,
  useBotWaitingMessages,
  useCancelBotTurn,
  useModelProviders,
  useSendBotMessage,
  useVoiceDictation,
} from '@oppenheimer/frontend-consumer/react';
import {
  ChatQueuedRow,
  dictateInto,
  dictationSlots,
  ErrorAlert,
  useDictation,
  usePaneDrop,
} from '@oppenheimer/frontend-web';
import {
  BOT_PROVIDER_CATALOG,
  type BotProvider,
  botModelOf,
  botTakesImages,
} from '@oppenheimer/shared/schemas/bot';
import { useNavigate } from '@tanstack/react-router';
import type { ClipboardEvent, ReactNode } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BotComposerImage } from '@/features/bots/components/bot-composer-image';
import { BotSlashMenu } from '@/features/bots/components/bot-slash-menu';
import { useBotDraft } from '@/features/bots/hooks/use-bot-draft';
import { useBotImages } from '@/features/bots/hooks/use-bot-images';
import { useComposerFocus } from '@/features/bots/hooks/use-composer-focus';
import { useSlashMenu } from '@/features/bots/hooks/use-slash-menu';
import { botDraft, fillBotDraft, setBotDraft } from '@/features/bots/lib/bot-drafts';
import { BOT_IMAGE_ACCEPT, heldImagesBlock } from '@/features/bots/lib/bot-images';
import { type ComposerTop, composerTopOf } from '@/features/bots/lib/composer-top';
import { BotGoalNotice } from '@/features/bots/sections/bot-goal-notice';

/**
 * The bot's composer. Send says it to the bot; while a turn is queued or
 * running the button is Stop until something is written, and what is sent
 * then waits for its turn. Each message waiting shows over the box
 * (`ChatQueuedRow`): Remove takes it back, Edit takes it back into the
 * field, and the first one's Send now stops the turn under way so it runs
 * next. A message that carried images is not taken back to edit: they were
 * sent once and the field cannot hold them again. A provider with no key in the workspace keeps
 * send off and says where to add one, fused to the top of the box. It owns
 * the draft alone: the chips in `tools` and `engine` are elements its parent
 * made, so a keystroke renders the field and none of them. The draft is
 * kept per bot (`bot-drafts`), so it survives leaving the chat, and a
 * suggestion in the hello can fill it; the field takes focus on open and
 * after a fill. Enter sends, Shift+Enter starts a new line. The mic dictates
 * into the draft (`useDictation`), added to its end, to be read before it is
 * sent. A draft that is a `/` command being typed opens the menu of the
 * skills it can run over the box (`useSlashMenu`); picking one writes
 * `/<name> ` for its input to follow.
 *
 * Images ride the message (`25-bots.md` §3.1): the paperclip, a paste, or a
 * drop anywhere on the chat's pane (`usePaneDrop`) holds them as tiles over
 * the text, each uploaded at once (`useBotImages`). A message may be images
 * alone. A file it will not hold, or one the API refused, is said under the
 * field; while one uploads or failed, or the bot's model reads no images,
 * send is off and says why, and nothing written is lost.
 */
export function BotComposer({
  botId,
  name,
  provider,
  model,
  tools,
  engine,
}: {
  botId: string;
  name: string;
  provider: BotProvider;
  /** The bot's model; null is its provider's default. */
  model: string | null;
  tools: ReactNode;
  engine: ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [draft, setDraft] = useBotDraft(botId);
  const field = useComposerFocus(botId);
  const slash = useSlashMenu(botId, draft, (next) => fillBotDraft(botId, next));
  const active = useBotActiveTurn(botId);
  const waiting = useBotWaitingMessages(botId);
  const { data: keyed } = useModelProviders({
    select: (rows) => rows.find((row) => row.provider === provider)?.configured,
  });
  const providerLabel = BOT_PROVIDER_CATALOG[provider].label;
  const takesImages = botTakesImages(provider);
  const modelLabel = botModelOf(provider, model)?.label ?? providerLabel;
  const images = useBotImages(botId, takesImages, modelLabel);
  const picker = useRef<HTMLInputElement>(null);
  usePaneDrop(images.hold);
  const send = useSendBotMessage({
    onSuccess: (_turn, sent) => {
      setBotDraft(sent.id, '');
      images.clear();
    },
  });
  const cancel = useCancelBotTurn();
  // The goal is drawn in `above`, fused onto the box, so the box has to know whether there is one.
  const { data: goal } = useBotGoal(botId);
  const noKey = keyed === false ? t('bots.chat.noKey', { provider: providerLabel }) : undefined;
  const imagesBlock = heldImagesBlock(images.images, takesImages);
  const blocked =
    noKey ??
    (imagesBlock ? t(`bots.chat.images.${imagesBlock}`, { model: modelLabel }) : undefined);
  const failure = send.error ?? cancel.error;
  const dictation = useDictation({
    voice: useVoiceDictation(() => [name]),
    onText: dictateInto((next) => setBotDraft(botId, next(botDraft(botId)))),
  });

  const addKey = (
    <ComposerStackAction onClick={() => navigate({ to: '/settings/model-providers' })}>
      {t('bots.chat.addKey')}
    </ComposerStackAction>
  );

  // Edit: the waiting turn is called off, and its words come back into the field.
  function takeBack(message: BotWaitingMessage) {
    cancel.mutate(
      { id: botId, turnId: message.turnId },
      {
        onSuccess: () => {
          const current = botDraft(botId);
          setBotDraft(botId, current ? `${message.text}\n${current}` : message.text);
        },
      },
    );
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    // Nothing is prevented: text pasted with an image still lands in the field.
    const pasted = Array.from(event.clipboardData.files);
    if (pasted.length > 0) images.hold(pasted);
  }

  const top = composerTopOf({
    waiting: waiting.length,
    noKey: Boolean(noKey),
    goal: Boolean(goal),
  });
  const tops: Record<ComposerTop, () => ReactNode> = {
    queue: () => (
      <ComposerStack>
        {noKey ? (
          <ComposerStackRow icon={<KeyRound />} actions={addKey}>
            {noKey}
          </ComposerStackRow>
        ) : null}
        {waiting.map((message, index) => (
          <ChatQueuedRow
            key={message.turnId}
            text={message.text || t('bots.chat.queuedImages', { count: message.images })}
            onSendNow={
              index === 0 && active?.status === 'running'
                ? () => cancel.mutate({ id: botId, turnId: active.id })
                : undefined
            }
            onEdit={message.images === 0 ? () => takeBack(message) : undefined}
            onRemove={() => cancel.mutate({ id: botId, turnId: message.turnId })}
          />
        ))}
      </ComposerStack>
    ),
    noKey: () => (
      <ComposerNotice icon={<KeyRound />} action={addKey}>
        {noKey}
      </ComposerNotice>
    ),
    goal: () => (goal ? <BotGoalNotice botId={botId} goal={goal} /> : null),
  };

  return (
    <>
      <input
        ref={picker}
        type="file"
        multiple
        accept={BOT_IMAGE_ACCEPT}
        className="hidden"
        aria-label={t('bots.chat.images.attach')}
        onChange={(event) => {
          const picked = Array.from(event.currentTarget.files ?? []);
          // Cleared so choosing the same file again still fires a change.
          event.currentTarget.value = '';
          images.hold(picked);
        }}
      />
      <ErrorAlert
        error={failure}
        fallback={send.error ? t('bots.chat.sendFailed') : t('bots.chat.stopFailed')}
        onDismiss={() => {
          send.reset();
          cancel.reset();
        }}
      />
      <div className="relative">
        {slash.open ? (
          <BotSlashMenu items={slash.items} highlighted={slash.highlighted} onPick={slash.pick} />
        ) : null}
        <ChatComposer
          onKeyDownCapture={slash.onKeyDownCapture}
          value={draft}
          onValueChange={setDraft}
          inputRef={field}
          onSubmit={() =>
            send.mutate({
              id: botId,
              content: draft,
              attachmentIds: images.images.flatMap((image) =>
                image.attachmentId ? [image.attachmentId] : [],
              ),
            })
          }
          onStop={() => active && cancel.mutate({ id: botId, turnId: active.id })}
          busy={
            (active !== null || send.isPending) && draft.trim() === '' && images.images.length === 0
          }
          sendBlockedReason={blocked}
          allowEmpty={images.images.length > 0}
          onAttach={() => picker.current?.click()}
          onPaste={onPaste}
          attachments={
            images.images.length > 0
              ? images.images.map((image) => (
                  <BotComposerImage
                    key={image.key}
                    image={image}
                    onRemove={() => images.remove(image.key)}
                  />
                ))
              : undefined
          }
          placeholder={t('bots.chat.placeholder', { name })}
          tools={tools}
          engine={engine}
          above={top ? tops[top]() : undefined}
          dictation={dictationSlots(dictation)}
          labels={{
            send: t('bots.chat.send'),
            stop: t('bots.chat.stop'),
            attach: t('bots.chat.images.attach'),
          }}
        />
      </div>
      {images.problem ? <FieldError className="mx-5">{images.problem}</FieldError> : null}
    </>
  );
}
