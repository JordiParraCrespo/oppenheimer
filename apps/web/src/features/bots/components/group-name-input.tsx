import { Input } from '@oppenheimer/design-system-web';
import { BOT_GROUP_NAME_MAX } from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A group's name typed in place, in the sidebar: a new group's, or a rename.
 * It opens selected, Enter or leaving the field keeps the name, Escape drops
 * it, and an empty name is a cancel rather than a refusal. It owns the draft,
 * so a keystroke renders this field and nothing around it, and it hands the
 * name up once.
 */
export function GroupNameInput({
  defaultValue,
  pending,
  onCommit,
  onCancel,
}: {
  defaultValue: string;
  pending: boolean;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(defaultValue);
  const [done, setDone] = useState(false);

  function commit() {
    if (done) return;
    setDone(true);
    const name = draft.trim();
    if (name) onCommit(name);
    else onCancel();
  }

  return (
    <div className="mx-1.5 flex h-8 items-center px-1">
      <Input
        size="sm"
        value={draft}
        maxLength={BOT_GROUP_NAME_MAX}
        aria-label={t('bots.sidebar.groupName')}
        disabled={pending}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setDone(true);
            onCancel();
          }
        }}
      />
    </div>
  );
}
