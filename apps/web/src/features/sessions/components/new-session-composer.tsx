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
 * The composer of New session: the first task, the images attached to it, and
 * the foot row of controls that says how it will be run.
 *
 * **The task's text and its files live here**, in the lowest component that
 * reads them. That is the point of this file existing at all: the sections
 * above hold the chips and the lists they draw, and text held up there would
 * re-render the host chip, the repository picker and the branch pane on every
 * keystroke. What leaves this component is the finished sentence and its
 * files, once.
 *
 * Files come from the paperclip or from pasting an image into the field. A
 * file a session cannot take — not a PNG, JPEG, GIF or WebP by its label, over
 * the size cap, or past the count — is refused here with the reason under the
 * field, never silently dropped; the API judges the bytes again.
 *
 * `scope` is the band over the field and `tools` and `engine` are the foot
 * row's two slots — where the work happens on top, scope of action on the
 * left, who drives it on the right — and they are passed in rather than built
 * here because each is a chip bound to the New session draft's store.
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
  /** The scope chips, in the band fused to the top of the field. */
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
      if (!(SESSION_IMAGE_MEDIA_TYPES as readonly string[]).includes(file.type)) {
        reason = t('sessions.new.composer.attachNotImage', { name: file.name });
      } else if (file.size > SESSION_IMAGE_MAX_BYTES) {
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
    const pasted = Array.from(event.clipboardData.files);
    if (pasted.length === 0) return;
    // An image pasted into the task is an attachment, not text.
    event.preventDefault();
    hold(pasted);
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
          // and its files where their author can fix them and send again, which
          // is the whole reason not to clear on the way out.
        }}
      />
      {refusal ? <FieldError className="mx-4.5">{refusal}</FieldError> : null}
    </div>
  );
}
