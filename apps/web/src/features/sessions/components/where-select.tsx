import {
  ChipSelectItem,
  ChipSelectList,
  ChipSelectPopup,
  ChipSelectTrigger,
  type ChipSelectTriggerVariant,
  Popover,
  PopoverTrigger,
} from '@oppenheimer/design-system-web';
import { Folder, GitBranch } from '@oppenheimer/design-system-web/icons';
import { SESSION_PLACES, type SessionPlace } from '@oppenheimer/shared/schemas/session';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The first chip of New session: where the session runs
 * (`product/versions/mvp/24-session-places.md` §3). Two fixed choices, each
 * said with what it does, so the pane has no search: there is nothing to
 * narrow. Props in, choice out.
 */
export function WhereSelect({
  value,
  onValueChange,
  variant,
}: {
  value: SessionPlace;
  onValueChange: (value: SessionPlace) => void;
  variant?: ChipSelectTriggerVariant;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <ChipSelectTrigger
            icon={value === 'folder' ? <Folder /> : <GitBranch />}
            open={open}
            variant={variant}
            aria-label={t('sessions.new.where.label')}
          >
            {t(`sessions.new.where.${value}.label`)}
          </ChipSelectTrigger>
        }
      />
      <ChipSelectPopup width={300}>
        <ChipSelectList role="listbox" aria-label={t('sessions.new.where.label')}>
          {SESSION_PLACES.map((place) => (
            <ChipSelectItem
              key={place}
              selected={place === value}
              description={t(`sessions.new.where.${place}.description`)}
              onClick={() => {
                onValueChange(place);
                setOpen(false);
              }}
            >
              {t(`sessions.new.where.${place}.label`)}
            </ChipSelectItem>
          ))}
        </ChipSelectList>
      </ChipSelectPopup>
    </Popover>
  );
}
