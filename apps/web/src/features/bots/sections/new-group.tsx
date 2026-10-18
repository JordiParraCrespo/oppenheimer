import { Button } from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { useCreateBotGroup } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GroupNameInput } from '@/features/bots/components/group-name-input';

/**
 * New group, at the foot of the Employees sidebar: the row turns into the new
 * group's name, typed in place with "New group" selected, and Enter adds it
 * last. A name the workspace already has is refused, and says so here.
 */
export function NewGroup() {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  // Settled either way: a refusal closes the field and says why under it.
  const create = useCreateBotGroup({ onSettled: () => setAdding(false) });

  return (
    <div className="mt-2.5 flex flex-col px-3">
      {adding ? (
        <GroupNameInput
          defaultValue={t('bots.sidebar.newGroup')}
          pending={create.isPending}
          onCommit={(name) => create.mutate(name)}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              create.reset();
              setAdding(true);
            }}
          >
            <Plus />
            {t('bots.sidebar.newGroup')}
          </Button>
        </div>
      )}
      <ErrorAlert
        error={create.error}
        fallback={t('bots.sidebar.groupFailed')}
        onDismiss={() => create.reset()}
        className="mt-1"
      />
    </div>
  );
}
