import {
  Button,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  PillGroup,
  PillGroupItem,
  RadioGroup,
  RadioGroupCard,
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
} from '@oppenheimer/design-system-web';
import {
  EyeIcon,
  GlobeIcon,
  MailIcon,
  TerminalIcon,
  UsersIcon,
} from '@oppenheimer/design-system-web/icons';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import {
  SESSION_SHARE_ACCESS,
  SESSION_SHARE_AUDIENCES,
} from '@oppenheimer/shared/schemas/session-share';
import { useTranslation } from 'react-i18next';
import { SHARE_DEFAULTS, SHARE_LIFETIME_CHOICES } from '../lib/share-session';

const AUDIENCE_ICONS = { people: UsersIcon, link: GlobeIcon } as const;
const ACCESS_ICONS = { read: EyeIcon, write: TerminalIcon } as const;
const noop = () => {};

/**
 * The Share dialog while the session and its share are read: the form a
 * session not yet shared opens on, its labels and choices written and every
 * control disabled on the form's defaults, with bars only where the read
 * answers (the session's name and host under the title, the "Ends …" line).
 */
export function ShareSessionSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex min-h-0 flex-col">
      <LoadingStatus />
      <DialogHeader>
        <DialogTitle>{t('sessions.share.title')}</DialogTitle>
        <DialogDescription render={<div />} className="flex items-center gap-1.5">
          <span className="flex h-5 items-center">
            <Skeleton shape="sm" className="h-3 w-28" />
          </span>
          <span className="flex h-5 items-center">
            <Skeleton shape="sm" className="h-3 w-20" />
          </span>
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className="flex flex-col gap-5.5">
          <Field>
            <FieldLabel>{t('sessions.share.who')}</FieldLabel>
            <SegmentedControl
              size="md"
              aria-label={t('sessions.share.who')}
              value={SHARE_DEFAULTS.audience}
              onValueChange={noop}
              disabled
            >
              {SESSION_SHARE_AUDIENCES.map((option) => {
                const Icon = AUDIENCE_ICONS[option];
                return (
                  <SegmentedControlItem key={option} value={option}>
                    <Icon className="size-3.25" />
                    {t(`sessions.share.audiences.${option}`)}
                  </SegmentedControlItem>
                );
              })}
            </SegmentedControl>
            <Input
              disabled
              leading={<MailIcon className="size-[15px]" />}
              placeholder={t('sessions.share.peoplePlaceholder')}
              aria-label={t('sessions.share.who')}
            />
          </Field>
          <Field>
            <FieldLabel>{t('sessions.share.permission')}</FieldLabel>
            <RadioGroup
              aria-label={t('sessions.share.permission')}
              value={SHARE_DEFAULTS.access}
              onValueChange={noop}
              disabled
              columns={2}
            >
              {SESSION_SHARE_ACCESS.map((option) => {
                const Icon = ACCESS_ICONS[option];
                return (
                  <RadioGroupCard
                    key={option}
                    value={option}
                    icon={<Icon />}
                    tone={option === 'write' ? 'danger' : 'default'}
                    label={t(`sessions.share.access.${option}.label`)}
                    description={t(`sessions.share.access.${option}.hint`)}
                  />
                );
              })}
            </RadioGroup>
          </Field>
          <Field>
            <FieldLabel>{t('sessions.share.duration')}</FieldLabel>
            <PillGroup
              aria-label={t('sessions.share.duration')}
              value={SHARE_DEFAULTS.lifetime}
              onValueChange={noop}
              disabled
            >
              {SHARE_LIFETIME_CHOICES.map((choice) => (
                <PillGroupItem key={choice} value={choice}>
                  {t(`sessions.share.lifetimes.${choice}`)}
                </PillGroupItem>
              ))}
            </PillGroup>
            <div className="flex h-4 items-center">
              <Skeleton shape="sm" className="h-2.5 w-48" />
            </div>
          </Field>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" disabled>
          {t('common.cancel')}
        </Button>
        <Button type="button" variant="primary" disabled>
          {t('sessions.share.submit.people')}
        </Button>
      </DialogFooter>
    </div>
  );
}
