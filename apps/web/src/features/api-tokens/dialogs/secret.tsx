import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHero,
  DialogHeroPlate,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { Cpu } from '@oppenheimer/design-system-web/icons';
import { CodeBox } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The one and only time a secret exists outside the server.
 *
 * Dismissed by an explicit click rather than by clicking away, so it cannot be
 * lost to a stray tap on the backdrop.
 */
export function SecretDialog({
  title,
  subtitle,
  secret,
  onClose,
}: {
  title: string;
  subtitle: string;
  secret: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <SettingsDialog
      icon={<Cpu />}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <Button type="button" onClick={onClose}>
          {t('settings.api.close')}
        </Button>
      }
    >
      <CodeBox value={secret} />
    </SettingsDialog>
  );
}

/** The design's modal shell: icon tile, title, subtitle, body, divided footer. */
function SettingsDialog({
  icon,
  title,
  subtitle,
  children,
  footer,
  onClose,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHero gradient="blueLilac">
          <DialogHeroPlate>{icon}</DialogHeroPlate>
        </DialogHero>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        {/* The body is the only part that scrolls, so a long one (the permission
            list) never pushes the footer off-screen. */}
        <DialogBody>{children}</DialogBody>
        <DialogFooter className="border-t border-border-subtle pt-5">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
