import { Composer, FieldError } from '@oppenheimer/design-system-web';
import {
  dictateInto,
  dictationSlots,
  useDictation,
  type VoiceInput,
} from '@oppenheimer/frontend-web';
import { SESSION_CREATE_MAX_FILES, SESSION_FILE_ACCEPT } from '@oppenheimer/shared/protocol';
import type { ClipboardEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHeldFiles } from '../hooks/use-held-files';
import { useReceiveDrops } from '../hooks/use-new-session-drop';

/**
 * The composer of New session. **The task's text and files live here**, the
 * lowest component that reads them: held higher, every keystroke would
 * re-render the host chip, the repository picker and the branch pane. They
 * leave once, on submit.
 *
 * Every way in — the paperclip, a paste, a drop on the screen's pane, which
 * hands its files here (`useReceiveDrops`) — goes through `useHeldFiles`,
 * the rule the chat's composer holds files by too. A file it refuses, for
 * its type, its size or the count, is said under the field, never silently
 * dropped. A paste with no file is left to the field.
 *
 * `scope`, `tools` and `engine` are passed in because each is a chip bound to
 * the New session draft's store.
 *
 * `voice` is dictation (`product/next-steps/voice.md`, the kit's
 * `useDictation`): while anyone can hear the workspace the mic is on, the
 * recording takes the composer's foot, and what is heard is added to the end
 * of the draft, to be read before it is sent. A refused microphone or a
 * failed transcription is said under the field, like a refused file.
 */
export function NewSessionComposer({
  onSubmit,
  busy,
  disabled,
  taskOptional,
  scope,
  tools,
  engine,
  voice,
}: {
  onSubmit: (text: string, files: File[]) => void;
  busy?: boolean;
  disabled?: boolean;
  /** The session starts on no task (the blank terminal): send is on with the field empty. */
  taskOptional?: boolean;
  scope?: ReactNode;
  tools?: ReactNode;
  engine?: ReactNode;
  voice: VoiceInput;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const { files, refusal, hold, release } = useHeldFiles(SESSION_CREATE_MAX_FILES);
  const picker = useRef<HTMLInputElement>(null);
  const dictation = useDictation({
    voice,
    onText: dictateInto(setDraft),
  });

  useReceiveDrops(hold);

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    // Nothing is prevented: text pasted with a file still lands in the field,
    // and a textarea inserts nothing for a file.
    const pasted = Array.from(event.clipboardData.files);
    if (pasted.length > 0) hold(pasted);
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={picker}
        type="file"
        multiple
        accept={SESSION_FILE_ACCEPT}
        className="hidden"
        aria-label={t('sessions.new.composer.attach')}
        onChange={(event) => {
          const picked = Array.from(event.currentTarget.files ?? []);
          // Cleared so choosing the same file again still fires a change.
          event.currentTarget.value = '';
          hold(picked);
        }}
      />
      <Composer
        value={draft}
        onValueChange={setDraft}
        busy={busy}
        disabled={disabled}
        allowEmpty={taskOptional}
        placeholder={t(
          taskOptional
            ? 'sessions.new.composer.placeholderOptional'
            : 'sessions.new.composer.placeholder',
        )}
        labels={{
          send: t('sessions.new.composer.send'),
          stop: t('sessions.new.composer.stop'),
          attach: t('sessions.new.composer.attach'),
          removeAttachment: (name) => t('sessions.new.composer.removeAttachment', { name }),
        }}
        attachments={files.map(({ id, file }) => ({ id, name: file.name }))}
        onRemoveAttachment={(id) => release([id])}
        onAttach={() => picker.current?.click()}
        onPaste={onPaste}
        dictation={dictationSlots(dictation)}
        scope={scope}
        tools={tools}
        engine={engine}
        onSubmit={(text) => {
          const task = text.trim();
          // A file rides a written task: the text is optional only with none held.
          if (!task && (!taskOptional || files.length > 0)) return;
          onSubmit(
            task,
            files.map(({ file }) => file),
          );
          // Deliberately not cleared. A successful submit navigates to the new
          // session and this unmounts with it; a failed one leaves the sentence
          // and its files where their author can fix them and send again.
        }}
      />
      {refusal ? (
        <FieldError className="mx-4.5">
          {refusal.reason === 'tooMany'
            ? t('sessions.new.composer.attachTooMany', { max: refusal.max })
            : refusal.reason === 'tooLarge'
              ? t('sessions.new.composer.attachTooLarge', { name: refusal.name })
              : t('sessions.new.composer.attachNotSupported', { name: refusal.name })}
        </FieldError>
      ) : null}
    </div>
  );
}
