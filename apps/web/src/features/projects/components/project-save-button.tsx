import { Button } from '@oppenheimer/design-system-web';
import { type Control, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { type ProjectFormValues, projectBlock } from '../lib/project-draft';

/**
 * The project dialog's Save: off until the project is whole — a name, and a
 * default among its repositories whenever it holds any. It is the one thing that reads
 * the name as it is typed, so the subscription is here and a keystroke
 * renders this button and the name field, not the dialog.
 */
export function ProjectSaveButton({
  control,
  editing,
  pending,
}: {
  control: Control<ProjectFormValues>;
  editing: boolean;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const [name, rows] = useWatch({ control, name: ['name', 'rows'] });
  const block = projectBlock(name ?? '', rows);

  return (
    <Button
      type="submit"
      disabled={block !== null}
      pending={pending}
      pendingLabel={editing ? t('projects.dialog.saving') : t('projects.dialog.creating')}
    >
      {editing ? t('projects.dialog.save') : t('projects.dialog.create')}
    </Button>
  );
}
