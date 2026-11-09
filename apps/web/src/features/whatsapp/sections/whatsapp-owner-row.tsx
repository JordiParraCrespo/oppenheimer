import { Button, SettingsListRow, useNow } from '@oppenheimer/design-system-web';
import type { WhatsappAccountEntity } from '@oppenheimer/frontend-consumer';
import {
  useConfirmWhatsappOwner,
  useRequestWhatsappOwner,
} from '@oppenheimer/frontend-consumer/react';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { ErrorAlert, useLocale } from '@oppenheimer/frontend-web';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WhatsappOwnerCodeForm } from '@/features/whatsapp/forms/whatsapp-owner-code-form';
import { WhatsappOwnerNumberForm } from '@/features/whatsapp/forms/whatsapp-owner-number-form';
import { type OwnerStep, ownerStep } from '@/features/whatsapp/lib/owner-row';

/**
 * The reader's own number on one of theirs
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §1): the only
 * number answered there. They name it, this number sends it a six-digit
 * code, and they enter the code here, so a mistyped number never becomes
 * theirs. Once confirmed the row shows it, with Change; a new number keeps
 * the old one answered until its own code is entered. Sending needs the
 * host online; entering the code does not.
 */
export function WhatsappOwnerRow({ account }: { account: WhatsappAccountEntity }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const resolveError = useErrorMessage();
  const now = useNow(CORE_CONFIG.clock.everyHalfMinuteMs);
  const [changing, setChanging] = useState(false);
  const request = useRequestWhatsappOwner({ onSuccess: () => setChanging(false) });
  const confirm = useConfirmWhatsappOwner();
  const step = ownerStep({
    ownerState: account.ownerState,
    codeExpired: account.codeExpired(now),
    changing,
  });
  const failure = (error: Error | null, fallback: string) =>
    error ? resolveError(error, fallback).message : undefined;
  const send = (phone: string) => {
    confirm.reset();
    request.mutate({ id: account.id, phone });
  };
  const change = () => {
    request.reset();
    setChanging(true);
  };
  const pending = account.ownerPendingNumber ?? '';
  const time = account.ownerCodeExpiresAt
    ? new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(account.ownerCodeExpiresAt)
    : '';

  const line =
    step === 'number'
      ? changing
        ? null
        : t('settings.whatsapp.owner.none')
      : step === 'code'
        ? t('settings.whatsapp.owner.codeSent', { number: pending, time })
        : step === 'expired'
          ? t('settings.whatsapp.owner.expired', { number: pending })
          : t('settings.whatsapp.owner.confirmed', { number: account.ownerNumber });
  const replacing =
    account.ownerNumber && step !== 'confirmed'
      ? t('settings.whatsapp.owner.replacing', { number: account.ownerNumber })
      : null;
  const meta =
    !account.hostOnline && (step === 'number' || step === 'expired')
      ? t('settings.whatsapp.owner.hostOffline')
      : [line, replacing].filter(Boolean).join(' ');

  // One entry per step: a new step is a new entry, not another arm.
  const otherNumber = (
    <Button size="sm" variant="ghost" onClick={change}>
      {t('settings.whatsapp.owner.otherNumber')}
    </Button>
  );
  const actions: Record<OwnerStep, ReactNode> = {
    number: (
      <WhatsappOwnerNumberForm
        pending={request.isPending}
        disabled={!account.hostOnline}
        error={failure(request.error, t('settings.whatsapp.owner.failed'))}
        onSubmit={send}
        onCancel={account.ownerState === 'none' ? undefined : () => setChanging(false)}
      />
    ),
    code: (
      <>
        <WhatsappOwnerCodeForm
          key={account.ownerCodeExpiresAt?.getTime()}
          pending={confirm.isPending}
          error={failure(confirm.error, t('settings.whatsapp.owner.failed'))}
          onSubmit={(code) => confirm.mutate({ id: account.id, code })}
        />
        <Button
          size="sm"
          variant="ghost"
          pending={request.isPending}
          pendingLabel={t('settings.whatsapp.owner.sending')}
          disabled={!account.hostOnline}
          onClick={() => send(pending)}
        >
          {t('settings.whatsapp.owner.resend')}
        </Button>
        {otherNumber}
      </>
    ),
    expired: (
      <>
        {otherNumber}
        <Button
          size="sm"
          variant="secondary"
          pending={request.isPending}
          pendingLabel={t('settings.whatsapp.owner.sending')}
          disabled={!account.hostOnline}
          onClick={() => send(pending)}
        >
          {t('settings.whatsapp.owner.resend')}
        </Button>
      </>
    ),
    confirmed: (
      <Button size="sm" variant="ghost" onClick={change}>
        {t('settings.whatsapp.owner.change')}
      </Button>
    ),
  };

  return (
    <SettingsListRow
      align="center"
      data-testid="whatsapp-owner"
      meta={meta}
      actions={actions[step]}
    >
      {t('settings.whatsapp.owner.title')}
      {step === 'number' ? null : (
        <ErrorAlert
          error={request.error}
          fallback={t('settings.whatsapp.owner.failed')}
          onDismiss={request.reset}
        />
      )}
    </SettingsListRow>
  );
}
