import { Composer, FieldError } from '@oppenheimer/design-system-web';
import {
  SESSION_CREATE_MAX_IMAGES,
  SESSION_IMAGE_MAX_BYTES,
  SESSION_IMAGE_MEDIA_TYPES,
} from '@oppenheimer/shared/protocol';
import type { ClipboardEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
 * What a file *is* is the API's to judge by its bytes: a browser's label is
 * often empty for a pasted screenshot, so a file is refused here only for size
 * or count, with the reason under the field, never silently dropped. A paste
 * with no image is left to the field.
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
      if (file.size > SESSION_IMAGE_MAX_BYTES) {
        reason = t('sessions.new.composer.attachTooLarge', { name: file.name });
      } else if (files.length + accepted.length >= SESSION_CREATE_MAX_IMAGES) {
        reason = t('sessions.new.composer.attachTooMany', { max: SESSION_CREATE_MAX_IMAGES });
      } else {
        accepted.push({ id: crypto.randomUUID(), file });
      }
    }
    setRefusal(reason);
    if (accepted.length > 0) setFiles((held) => [...held, ...accepted]);
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    // Only what could be an image; an unlabelled file is a screenshot more
    // often than not. Nothing is prevented: text pasted with it still lands
    // in the field, and a textarea inserts nothing for a file.
    const images = Array.from(event.clipboardData.files).filter(
      (file) => file.type === '' || file.type.startsWith('image/'),
    );
    if (images.length > 0) hold(images);
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={picker}
        type="file"
        multiple
        accept={SESSION_IMAGE_MEDIA_TYPES.join(',')}
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
