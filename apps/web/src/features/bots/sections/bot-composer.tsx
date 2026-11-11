import { ChatComposer, FieldError } from '@oppenheimer/design-system-web';
import type { BotWaitingMessage } from '@oppenheimer/frontend-consumer';
import {
  useBotActiveTurn,
  useBotGoal,
  useBotLoop,
  useBotWaitingMessages,
  useCancelBotTurn,
  useModelProviders,
  useSendBotMessage,
  useVoiceDictation,
} from '@oppenheimer/frontend-consumer/react';
import {
  dictateInto,
  dictationSlots,
  ErrorAlert,
  useDictation,
  usePaneDrop,
} from '@oppenheimer/frontend-web';
import {
  BOT_MESSAGE_MAX,
  BOT_PROVIDER_CATALOG,
  type BotProvider,
  botModelOf,
  botTakesImages,
} from '@oppenheimer/shared/schemas/bot';
import { useNavigate } from '@tanstack/react-router';
import type { ClipboardEvent, KeyboardEvent, ReactNode } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BotComposerImage } from '@/features/bots/components/bot-composer-image';
import { BotSlashMenu } from '@/features/bots/components/bot-slash-menu';
import { useBotDraft } from '@/features/bots/hooks/use-bot-draft';
import { useBotImages } from '@/features/bots/hooks/use-bot-images';
import { useBotPastes } from '@/features/bots/hooks/use-bot-pastes';
import { useBuiltInCommand } from '@/features/bots/hooks/use-built-in-command';
import { useComposerFocus } from '@/features/bots/hooks/use-composer-focus';
import { useSentHistory } from '@/features/bots/hooks/use-sent-history';
import { useSlashMenu } from '@/features/bots/hooks/use-slash-menu';
import { botDraft, fillBotDraft, setBotDraft } from '@/features/bots/lib/bot-drafts';
import { BOT_IMAGE_ACCEPT, heldImagesBlock } from '@/features/bots/lib/bot-images';
import { composerTopOf } from '@/features/bots/lib/composer-top';
import { BotComposerTop } from '@/features/bots/sections/bot-composer-top';

/**
 * The bot's composer. Send says it to the bot; while a turn is queued or
 * running the button is Stop until something is written. While a turn runs,
 * Enter steers it (Codex's `turn/steer`): the turn takes the message at its
 * next tool call, and runs it after itself if it reaches none; Alt+Enter
 * queues it for after instead, and a message with images always waits,
 * since the running turn would not read them. Each message waiting shows
 * over the box (`ChatQueuedRow`), a steer marked as one: Remove takes it
 * back, Edit takes it back into the field, and the first one's Send now
 * stops the turn under way so it runs next. A message that carried images is not taken back to edit: they were
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
 * `/<name> ` for its input to follow. With the menu shut, Up at the start of
 * the field brings back what you sent before and Down walks back to your
 * draft (`useSentHistory`); while it does, the box's caption says which
 * one ("History 1/2").
 *
 * Images ride the message (`25-bots.md` §3.1): the paperclip, a paste, or a
 * drop anywhere on the chat's pane (`usePaneDrop`) holds them as tiles over
 * the text, each uploaded at once (`useBotImages`). A message may be images
 * alone. A file it will not hold, or one the API refused, is said under the
 * field; while one uploads or failed, or the bot's model reads no images,
 * send is off and says why, and nothing written is lost.
 *
 * A long paste (over 1,000 characters or 10 lines) goes into the field as one
 * label, `[Pasted text #1 +1000 lines]`, the way Claude Code and Codex hold
 * one: the field stays readable around it, and the send puts the text back
 * in the label's place (`useBotPastes`). Backspace or Delete takes a label out
 * whole. A message longer than the bot takes keeps send off and says so.
 * A built-in command the console runs itself (`/goal clear`, `/loop stop`, `/usage`, which
 * puts the usage card in the chat) sends nothing,
 * and one that cannot be sent as typed (`/goal` with no condition) keeps send
 * off and says why on the box's top edge (`useBuiltInCommand`).
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
  const recall = useSentHistory(botId, draft, setDraft);
  const pastes = useBotPastes(botId, draft, setDraft);
  const active = useBotActiveTurn(botId);
  // How many wait decides whether the queue takes the top edge; `BotComposerTop` draws them.
  const waiting = useBotWaitingMessages(botId).length;
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
      pastes.clear();
      images.clear();
    },
  });
  const cancel = useCancelBotTurn();
  const builtIn = useBuiltInCommand(botId, draft);
  // Whether there is a goal or a loop decides whether the box has a top edge (`BotComposerTop` draws it).
  const { data: goal } = useBotGoal(botId);
  const { data: loop } = useBotLoop(botId);
  const noKey = keyed === false ? t('bots.chat.noKey', { provider: providerLabel }) : undefined;
  const imagesBlock = heldImagesBlock(images.images, takesImages);
  const length = pastes.content.trim().length;
  const tooLong =
    length > BOT_MESSAGE_MAX ? t('bots.chat.tooLong', { length, max: BOT_MESSAGE_MAX }) : undefined;
  const blocked =
    noKey ??
    tooLong ??
    (imagesBlock ? t(`bots.chat.images.${imagesBlock}`, { model: modelLabel }) : undefined) ??
    builtIn.notice;
  const failure = send.error ?? cancel.error ?? builtIn.error;
  const running = active?.status === 'running';
  const message = (steer: boolean) => ({
    id: botId,
    content: pastes.content,
    attachmentIds: images.images.flatMap((image) =>
      image.attachmentId ? [image.attachmentId] : [],
    ),
    steer: steer && images.images.length === 0,
  });
  const dictation = useDictation({
    voice: useVoiceDictation(() => [name]),
    onText: dictateInto((next) => setBotDraft(botId, next(botDraft(botId)))),
  });

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

  // A built-in the console runs itself (`/goal clear`) sends the bot nothing.
  function submit(steer: boolean) {
    recall.reset();
    if (builtIn.runLocally(() => setBotDraft(botId, ''))) return;
    send.mutate(message(steer));
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    // Text pasted with an image still lands in the field, as itself or as a long paste's label.
    const pasted = Array.from(event.clipboardData.files);
    if (pasted.length > 0) images.hold(pasted);
    pastes.onPaste(event);
  }

  // A long paste's label is taken out whole first; the rest of the keys belong
  // to the `/` menu while it is open, else to the walk through what you sent.
  function onKeyDownCapture(event: KeyboardEvent<HTMLDivElement>) {
    if (pastes.onKeyDownCapture(event)) return;
    if (slash.open) slash.onKeyDownCapture(event);
    else recall.onKeyDownCapture(event);
  }

  const top = composerTopOf({
    waiting,
    noKey: Boolean(noKey),
    command: Boolean(builtIn.notice),
    goal: Boolean(goal),
    loop: Boolean(loop),
  });

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
        fallback={
          send.error
            ? t('bots.chat.sendFailed')
            : builtIn.error
              ? builtIn.failure
              : t('bots.chat.stopFailed')
        }
        onDismiss={() => {
          send.reset();
          cancel.reset();
          builtIn.reset();
        }}
      />
      <div className="relative">
        {slash.open ? (
          <BotSlashMenu
            builtIns={slash.groups.builtIns}
            skills={slash.groups.skills}
            highlighted={slash.highlighted}
            onPick={slash.pick}
          />
        ) : null}
        <ChatComposer
          onKeyDownCapture={onKeyDownCapture}
          value={draft}
          onValueChange={setDraft}
          inputRef={field}
          onSubmit={() => submit(running)}
          onAltSubmit={running ? () => submit(false) : undefined}
          onStop={() => active && cancel.mutate({ id: botId, turnId: active.id })}
          busy={
            (active !== null || send.isPending) && draft.trim() === '' && images.images.length === 0
          }
          caption={recall.at ? t('bots.chat.history', recall.at) : undefined}
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
          placeholder={
            running
              ? t('bots.chat.placeholderRunning', { name })
              : t('bots.chat.placeholder', { name })
          }
          tools={tools}
          engine={engine}
          above={
            top ? (
              <BotComposerTop
                botId={botId}
                top={top}
                runningTurnId={active?.status === 'running' ? active.id : null}
                noKey={noKey}
                notice={builtIn.notice}
                onAddKey={() => navigate({ to: '/settings/model-providers' })}
                onCancel={(turnId) => cancel.mutate({ id: botId, turnId })}
                onTakeBack={takeBack}
              />
            ) : undefined
          }
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
