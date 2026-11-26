import {
  AccessList,
  AccessRow,
  Avatar,
  Badge,
  Button,
  Separator,
} from '@oppenheimer/design-system-web';
import {
  ClockIcon,
  EyeIcon,
  GlobeIcon,
  LockIcon,
  TerminalIcon,
} from '@oppenheimer/design-system-web/icons';
import { useSuspenseSessionShare } from '@oppenheimer/frontend-consumer/react';
import { useProfile } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import type {
  SessionShareAccess,
  SessionShareAudience,
} from '@oppenheimer/shared/schemas/session-share';
import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ShareLinkCopy } from '../components/share-link-copy';
import { ShareMenuSelect } from '../components/share-menu-select';
import { ShareSettingRow } from '../components/share-setting-row';
import { ShareTimeLeft } from '../components/share-time-left';
import { ShareWriteWarning } from '../components/share-write-warning';
import { useShareSessionPanel } from '../hooks/use-share-session-panel';
import {
  initialsOf,
  lifetimeAllowed,
  SHARE_LIFETIME_CHOICES,
  type ShareLifetimeChoice,
  shareUrl,
} from '../lib/share-session';
import { ShareInvite } from './share-invite';

/**
 * Share, in the popover off the session bar's Share button or the dialog a
 * session row's menu opens: one panel, whatever the session's share.
 *
 * Invite people by email on the first line. Under it, who has access (with ×
 * to take someone off, and the link as a row of its own), then the three
 * settings as quiet menus: who may open it, what they may do, and when it
 * ends. Write access is a shell on the host as the sharer, so picking it
 * asks to be understood first. The foot copies the link and stops sharing.
 * What each pick does is `useShareSessionPanel`'s; this draws it.
 *
 * Read under Suspense, in `ShareSession`'s `QueryState.Data`; a refetch that
 * fails keeps the panel and says so above it.
 */
export function ShareSessionPanel({
  sessionId,
  Title,
}: {
  sessionId: string;
  /** The surface's own title, so it names the popover or the dialog it is in. */
  Title: ComponentType<{ className?: string; children: ReactNode }>;
}) {
  const { t } = useTranslation();
  const me = useProfile().data?.id;
  const { session, share, hosts, error } = useSuspenseSessionShare(sessionId);
  const panel = useShareSessionPanel(sessionId, share);
  const { shown, access, asked, busy } = panel;
  const host = hosts.find((row) => row.id === session.hostId)?.name ?? t('sessions.share.thisHost');
  const role = t(`sessions.share.roles.${share?.access ?? access}`);

  const audienceOptions = [
    {
      value: 'people' as const,
      label: t('sessions.share.audiences.people'),
      description:
        share?.audience === 'link'
          ? t('sessions.share.audienceHints.peopleFromLink')
          : t('sessions.share.audienceHints.people'),
      icon: <LockIcon />,
      disabled: share?.audience === 'link',
    },
    {
      value: 'link' as const,
      label: t('sessions.share.audiences.link'),
      description: t('sessions.share.audienceHints.link'),
      icon: <GlobeIcon />,
    },
  ];
  const accessOptions = [
    {
      value: 'read' as const,
      label: t('sessions.share.access.read.label'),
      description: t('sessions.share.access.read.hint'),
      icon: <EyeIcon />,
    },
    {
      value: 'write' as const,
      label: t('sessions.share.access.write.label'),
      description:
        shown.audience === 'link'
          ? t('sessions.share.writeLocked')
          : t('sessions.share.access.write.hint'),
      icon: <TerminalIcon />,
      disabled: shown.audience === 'link',
      warning: true,
    },
  ];
  const lifetimeOptions = SHARE_LIFETIME_CHOICES.map((choice) => ({
    value: choice,
    label: t(`sessions.share.lifetimes.${choice}`),
    disabled: !lifetimeAllowed(access, choice),
  }));
  const who =
    share && share.audience === 'people'
      ? share.people.length === 1
        ? share.people[0]
        : t('sessions.share.writeWarningCount', { count: share.people.length })
      : '';

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-col gap-0.5 px-4 pt-3.5 pb-3">
        <div className="flex items-center gap-2">
          <Title className="text-[14px] font-medium">{t('sessions.share.title')}</Title>
          {share ? <Badge variant="active">{t('sessions.share.live')}</Badge> : null}
        </div>
        <p className="truncate text-[12px] text-fg-subtle">
          <span className="font-mono">{session.name}</span> · {t('sessions.share.on', { host })}
        </p>
      </div>
      <div className="flex min-h-0 flex-col gap-3.5 overflow-y-auto px-4 pb-3.5">
        <ErrorAlert error={error} fallback={t('sessions.share.loadFailed')} />
        <ErrorAlert
          error={panel.writeError}
          fallback={share ? t('sessions.share.updateFailed') : t('sessions.share.failed')}
        />
        {share || shown.audience === 'people' ? (
          <ShareInvite
            listed={share?.people ?? []}
            busy={busy}
            inviting={panel.inviting}
            ready={Boolean(share) || access !== 'write' || panel.ack}
            writeHost={share?.access === 'write' ? host : null}
            linkShared={share?.audience === 'link'}
            onInvite={panel.invite}
          />
        ) : null}
        {share ? (
          <AccessList aria-label={t('sessions.share.whoHasAccess')}>
            {share.sharedBy ? (
              <AccessRow
                avatar={
                  <Avatar size="sm" variant="accent">
                    {initialsOf(share.sharedBy.name)}
                  </Avatar>
                }
                name={share.sharedBy.name}
                sub={
                  share.sharedBy.id === me
                    ? t('sessions.share.you', { email: share.sharedBy.email })
                    : share.sharedBy.email
                }
                role={t('sessions.share.roles.owner')}
              />
            ) : null}
            {share.audience === 'link' ? (
              <AccessRow
                avatar={
                  <Avatar size="sm">
                    <GlobeIcon className="size-3" />
                  </Avatar>
                }
                name={t('sessions.share.anyoneRow')}
                sub={t('sessions.share.anyoneRowHint')}
                role={role}
                removeLabel={t('sessions.share.removeAccess')}
                onRemove={busy ? undefined : panel.stopSharing}
              />
            ) : (
              share.people.map((email) => (
                <AccessRow
                  key={email}
                  avatar={<Avatar size="sm">{initialsOf(email)}</Avatar>}
                  name={email}
                  sub={t('sessions.share.outside')}
                  role={role}
                  removeLabel={t('sessions.share.removeAccess')}
                  onRemove={busy ? undefined : () => panel.remove(email)}
                />
              ))
            )}
          </AccessList>
        ) : null}
        <div className="flex flex-col">
          <ShareSettingRow
            icon={shown.audience === 'link' ? <GlobeIcon /> : <LockIcon />}
            label={t('sessions.share.generalAccess')}
            hint={t(`sessions.share.audienceHints.${shown.audience}`)}
            control={
              <ShareMenuSelect<SessionShareAudience>
                label={t('sessions.share.generalAccess')}
                value={shown.audience}
                current={t(`sessions.share.audiencesShort.${shown.audience}`)}
                options={audienceOptions}
                disabled={busy}
                onChange={(audience) => panel.change({ audience })}
              />
            }
          />
          <ShareSettingRow
            icon={access === 'write' ? <TerminalIcon /> : <EyeIcon />}
            label={t('sessions.share.permission')}
            hint={t(`sessions.share.accessHints.${access}`)}
            control={
              <ShareMenuSelect<SessionShareAccess>
                label={t('sessions.share.permission')}
                value={access}
                current={t(`sessions.share.access.${access}.label`)}
                options={accessOptions}
                disabled={busy}
                onChange={panel.pickAccess}
              />
            }
          />
          <ShareSettingRow
            icon={<ClockIcon />}
            label={t('sessions.share.expires')}
            hint={
              access === 'write'
                ? t('sessions.share.expiresWrite')
                : t('sessions.share.expiresRead')
            }
            control={
              <ShareMenuSelect<ShareLifetimeChoice>
                label={t('sessions.share.expires')}
                value={shown.lifetime}
                current={
                  share && !asked ? (
                    <ShareTimeLeft at={share.expiresAt} />
                  ) : (
                    t(`sessions.share.lifetimes.${shown.lifetime}`)
                  )
                }
                options={lifetimeOptions}
                disabled={busy}
                onChange={(lifetime) => panel.change({ lifetime })}
              />
            }
          />
        </div>
        {panel.writing ? (
          <ShareWriteWarning who={who} host={host} ack={panel.ack} onAck={panel.setAck}>
            {asked ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={panel.giving}
                  onClick={panel.cancelWrite}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={!panel.ack}
                  pending={panel.giving}
                  pendingLabel={t('sessions.share.submitting')}
                  onClick={() => share && panel.giveWrite(share, asked)}
                >
                  {t('sessions.share.submit.write')}
                </Button>
              </>
            ) : null}
          </ShareWriteWarning>
        ) : null}
      </div>
      <Separator />
      <div className="flex min-h-12 items-center gap-2 px-4 py-2.5">
        {share ? (
          <>
            <ShareLinkCopy url={shareUrl(window.location.origin, share.slug)} />
            <span className="flex-1" />
            <Button
              type="button"
              variant="destructive-ghost"
              size="sm"
              pending={panel.stopping}
              pendingLabel={t('sessions.share.stopping')}
              disabled={busy && !panel.stopping}
              onClick={panel.stopSharing}
            >
              {t('sessions.share.stop')}
            </Button>
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 text-[12px] text-fg-subtle">
              {t('sessions.share.notShared')}
            </span>
            {shown.audience === 'link' ? (
              <Button
                type="button"
                size="sm"
                pending={panel.giving}
                pendingLabel={t('sessions.share.submitting')}
                onClick={panel.createLink}
              >
                {t('sessions.share.submit.link')}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
