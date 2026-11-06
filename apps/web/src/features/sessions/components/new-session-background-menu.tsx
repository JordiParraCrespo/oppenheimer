import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
} from '@oppenheimer/design-system-web';
import { ImageIcon } from '@oppenheimer/design-system-web/icons';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The button in New session's top-right corner that sets the image behind
 * it: Choose opens the file picker, Remove appears once there is one.
 */
export function NewSessionBackgroundMenu({
  hasImage,
  onChoose,
  onRemove,
}: {
  hasImage: boolean;
  onChoose: (file: File) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="absolute top-2 right-3.5">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={t('sessions.new.background.choose')}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          // Cleared so choosing the same file again still fires a change.
          event.currentTarget.value = '';
          if (file) onChoose(file);
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <IconButton
              aria-label={t('sessions.new.background.label')}
              title={t('sessions.new.background.label')}
              size="sm"
              variant="quiet"
              className={
                hasImage ? 'rounded-sm bg-canvas-recessed/60 text-fg backdrop-blur-md' : undefined
              }
            />
          }
        >
          <ImageIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-47.5">
          <DropdownMenuItem onClick={() => input.current?.click()}>
            {t('sessions.new.background.choose')}
          </DropdownMenuItem>
          {hasImage ? (
            <DropdownMenuItem onClick={onRemove}>
              {t('sessions.new.background.remove')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
