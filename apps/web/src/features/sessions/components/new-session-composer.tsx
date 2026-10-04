import { Composer, FieldError } from '@oppenheimer/design-system-web';
import { SESSION_CREATE_MAX_FILES, SESSION_FILE_MAX_BYTES } from '@oppenheimer/shared/protocol';
import type { ClipboardEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReceiveDrops } from '../hooks/use-new-session-drop';
import { isSessionFile, SESSION_FILE_ACCEPT } from '../lib/session-files';

/** One file the composer holds, keyed so two files with one name stay two chips. */
interface HeldFile {
  id: string;
  file: File;
}

/**
 * The composer of New session. **The task's text and files live here**, the
 * lowest component that reads them: held higher, every keystroke would
 * re-render the host chip, the repository picker and the branch pane. They
 * leave once, on submit.
 *
 * Every way in — the paperclip, a paste, a drop on the screen's pane, which
 * hands its files here (`useReceiveDrops`) — goes through `hold` and one
 * rule, `isSessionFile`, shared with the running session's terminal: an
 * image, a PDF or text, or no type at all (a pasted screenshot often has
 * none; the API judges the bytes). A file is refused for that, for size or for count,
 * with the reason under the field, never silently dropped. A paste with no
 * file is left to the field.
 *
 * `scope`, `tools` and `engine` are passed in because each is a chip bound to
 * the New session draft's store.
 */
export function NewSessionComposer({
  onSubmit,
  busy,
  disabled,
  scope,
  tools,
  engine,
}: {
  onSubmit: (text: string, files: File[]) => void;
  busy?: boolean;
  disabled?: boolean;
  scope?: ReactNode;
  tools?: ReactNode;
  engine?: ReactNode;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<HeldFile[]>([]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  function hold(incoming: File[]) {
    const accepted: HeldFile[] = [];
    let reason: string | null = null;
    for (const file of incoming) {
      if (!isSessionFile(file)) {
        reason = t('sessions.new.composer.attachNotSupported', { name: file.name });
      } else if (file.size > SESSION_FILE_MAX_BYTES) {
        reason = t('sessions.new.composer.attachTooLarge', { name: file.name });
      } else if (files.length + accepted.length >= SESSION_CREATE_MAX_FILES) {
        reason = t('sessions.new.composer.attachTooMany', { max: SESSION_CREATE_MAX_FILES });
      } else {
        accepted.push({ id: crypto.randomUUID(), file });
      }
    }
    setRefusal(reason);
    if (accepted.length > 0) setFiles((held) => [...held, ...accepted]);
  }

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
        placeholder={t('sessions.new.composer.placeholder')}
        labels={{
          send: t('sessions.new.composer.send'),
          stop: t('sessions.new.composer.stop'),
          attach: t('sessions.new.composer.attach'),
          removeAttachment: (name) => t('sessions.new.composer.removeAttachment', { name }),
        }}
        attachments={files.map(({ id, file }) => ({ id, name: file.name }))}
        onRemoveAttachment={(id) => {
          setRefusal(null);
          setFiles((held) => held.filter((file) => file.id !== id));
        }}
        onAttach={() => picker.current?.click()}
        onPaste={onPaste}
        scope={scope}
        tools={tools}
        engine={engine}
        onSubmit={(text) => {
          const task = text.trim();
          if (!task) return;
          onSubmit(
            task,
            files.map(({ file }) => file),
          );
          // Deliberately not cleared. A successful submit navigates to the new
          // session and this unmounts with it; a failed one leaves the sentence
          // and its files where their author can fix them and send again.
        }}
      />
      {refusal ? <FieldError className="mx-4.5">{refusal}</FieldError> : null}
    </div>
  );
}
