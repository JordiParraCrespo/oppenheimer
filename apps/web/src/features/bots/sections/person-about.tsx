import { Button, Kbd, Textarea } from '@oppenheimer/design-system-web';
import { useSavePersonAbout, useSuspensePersonMemory } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatMediumDate, useLocale } from '@oppenheimer/frontend-web';
import { PERSON_ABOUT_MAX } from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const SAVE_SHORTCUT =
  typeof navigator !== 'undefined' && /^Mac/.test(navigator.platform) ? '⌘S' : 'Ctrl S';

/**
 * What the person writes about themselves for their bots: a box seeded with
 * what they saved, and under it when it was saved (or that the draft has
 * unsaved changes), Discard and Save (⌘S or Ctrl+S in the box). Every bot
 * of theirs reads it from its next turn.
 */
export function PersonAbout() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data: memory, error } = useSuspensePersonMemory();
  const [draft, setDraft] = useState(memory.about);
  const save = useSavePersonAbout();
  const dirty = draft.trim() !== memory.about;
  const submit = () => {
    if (dirty && !save.isPending) save.mutate(draft);
  };

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1 px-1">
        <h2 className="eyebrow m-0">{t('settings.memory.aboutTitle')}</h2>
        <p className="m-0 text-sm text-fg-subtle">{t('settings.memory.aboutHint')}</p>
      </div>
      <ErrorAlert error={error} fallback={t('settings.memory.loadFailed')} />
      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 's' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit();
          }
        }}
        maxLength={PERSON_ABOUT_MAX}
        rows={6}
        aria-label={t('settings.memory.aboutLabel')}
        placeholder={t('settings.memory.aboutPlaceholder')}
      />
      <ErrorAlert
        error={save.error}
        fallback={t('settings.memory.saveFailed')}
        onDismiss={() => save.reset()}
      />
      <div className="flex items-center gap-2">
        <span aria-live="polite" className="flex flex-1 items-center gap-2 text-sm text-fg-subtle">
          {dirty
            ? t('settings.memory.unsaved')
            : memory.aboutUpdatedAt
              ? t('settings.memory.saved', {
                  date: formatMediumDate(memory.aboutUpdatedAt, locale),
                })
              : t('settings.memory.neverSaved')}
          {dirty ? <Kbd className="max-sm:hidden">{SAVE_SHORTCUT}</Kbd> : null}
        </span>
        {dirty ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={save.isPending}
            onClick={() => {
              setDraft(memory.about);
              save.reset();
            }}
          >
            {t('settings.memory.discard')}
          </Button>
        ) : null}
        <Button
          size="sm"
          disabled={!dirty}
          pending={save.isPending}
          pendingLabel={t('settings.memory.saving')}
          onClick={submit}
        >
          {t('settings.memory.save')}
        </Button>
      </div>
    </section>
  );
}
