import { ChipSelectItem, ChipSelectList } from '@oppenheimer/design-system-web';
import { Check, Cloud } from '@oppenheimer/design-system-web/icons';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { pickedEnvironment } from '../lib/session-options';

/** An environment id as ChatGPT shows it: one word (`asenvcfg_…`), as long as the API takes. */
const ENVIRONMENT_ID = /^\S{1,128}$/;

/**
 * The place chip's Environments pane for Codex's cloud. There is no list to
 * ask for: Codex cloud has no API that names an account's environments, so the
 * pane offers Default (Codex's default environment, with the repository), the
 * id already picked on this host, and the id typed in the search as "Use …",
 * which the person copies from ChatGPT Settings → Codex Cloud. A pick is kept
 * with the host it was made on, whose ChatGPT account starts the task.
 */
export function NewSessionCodexEnvironments({
  hostId,
  query,
  onDone,
}: {
  hostId: string;
  /** The pane's search, settled by the chip. */
  query: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { control } = useNewSessionDraft();
  const { field } = useController({ control, name: 'codexEnvironment' });

  const picked = pickedEnvironment(field.value, hostId);
  const typed = query.trim();
  const offer = ENVIRONMENT_ID.test(typed) && typed !== picked?.id ? typed : null;

  /** A row's right side: a short note, then the check. */
  function meta(text: string | null, selected: boolean) {
    return (
      <span className="flex min-w-0 shrink items-center gap-1.5 text-xs text-fg-subtle">
        {text ? <span className="truncate">{text}</span> : null}
        <span className="flex w-3.5 shrink-0 items-center justify-center text-link">
          {selected ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
        </span>
      </span>
    );
  }

  function pick(id: string | null) {
    field.onChange(id ? { hostId, id, label: id } : null);
    onDone();
  }

  return (
    <ChipSelectList role="listbox" aria-label={t('sessions.new.codexEnvironment.label')}>
      <ChipSelectItem
        selected={!picked}
        leading={<Cloud />}
        trailing={meta(t('sessions.new.codexEnvironment.defaultHint'), !picked)}
        onClick={() => pick(null)}
      >
        {t('sessions.new.codexEnvironment.default')}
      </ChipSelectItem>
      {picked ? (
        <ChipSelectItem
          selected
          leading={<Cloud />}
          trailing={meta(null, true)}
          onClick={() => pick(picked.id)}
        >
          {picked.label}
        </ChipSelectItem>
      ) : null}
      {offer ? (
        <ChipSelectItem
          selected={false}
          leading={<Cloud />}
          trailing={meta(null, false)}
          onClick={() => pick(offer)}
        >
          {t('sessions.new.codexEnvironment.use', { id: offer })}
        </ChipSelectItem>
      ) : null}
      <p className="truncate px-2.5 pt-2 pb-1 text-xs text-fg-subtle">
        {t('sessions.new.codexEnvironment.hint')}
      </p>
    </ChipSelectList>
  );
}
