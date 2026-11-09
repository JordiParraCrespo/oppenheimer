import {
  Field,
  FieldLabel,
  FieldSelect,
  Input,
  SettingsGroup,
  SettingsRow,
  Skeleton,
  Textarea,
} from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { BOT_SECTIONS } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { BotChatHistorySkeleton } from './bot-chat-history-skeleton';

function noop() {}

/** How many choices each part of the face picker offers: hat, eyes, mouth. */
const FACE_PARTS = [
  { key: 'faceHat', count: 6 },
  { key: 'faceEyes', count: 4 },
  { key: 'faceMouth', count: 3 },
] as const;

const PILL_WIDTHS = ['w-22', 'w-28', 'w-16', 'w-24'];

/**
 * Settings → Profile before the bot answers, laid out as `BotProfile` draws
 * it: the card with Name and Description as their real fields, off, the
 * colour's preview and eight swatches, the face's three rows of choices and
 * the sidebar group with its label and hint written; then Shows in with its
 * label and hint, its pills as bars; Created with its date a bar; and Chat
 * history under its heading, in its own placeholder.
 */
export function BotProfileSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-7">
      <LoadingStatus />
      <SettingsGroup inert>
        <div className="px-5 py-4">
          <Field>
            <FieldLabel htmlFor="bot-name-loading">{t('bots.settings.profile.name')}</FieldLabel>
            <div className="relative">
              <Input id="bot-name-loading" disabled />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-3 top-0 flex h-(--control-h-md) items-center"
              >
                <Skeleton shape="sm" className="h-3 w-28" />
              </span>
            </div>
          </Field>
        </div>
        <div className="border-t border-border-subtle px-5 py-4">
          <Field>
            <FieldLabel htmlFor="bot-description-loading">
              {t('bots.settings.profile.description')}
            </FieldLabel>
            <div className="relative">
              <Textarea id="bot-description-loading" rows={2} disabled />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-3 top-2.5 flex flex-col"
              >
                <span className="flex h-5 items-center">
                  <Skeleton shape="sm" className="h-3 w-3/4" />
                </span>
                <span className="flex h-5 items-center">
                  <Skeleton shape="sm" className="h-3 w-2/5" />
                </span>
              </span>
            </div>
          </Field>
        </div>
        <div
          aria-hidden
          className="flex items-center gap-10 border-t border-border-subtle px-5 py-5"
        >
          <div className="flex shrink-0 flex-col items-center gap-2">
            {/* A block stands in here: the 72px preview of the bot's face, round like it. */}
            <Skeleton shape="pill" className="size-18" />
            <span className="flex h-5 items-center">
              <Skeleton shape="sm" className="h-3 w-16" />
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <span className="text-[12px] text-fg-muted">{t('bots.settings.profile.color')}</span>
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 8 }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a swatch's place is its identity.
                <Skeleton key={index} shape="pill" className="size-8" />
              ))}
            </div>
          </div>
        </div>
        <div aria-hidden className="flex flex-col gap-3 border-t border-border-subtle px-5 py-5">
          <span className="text-[14px] font-medium">{t('bots.settings.profile.face')}</span>
          <div className="flex flex-col gap-4">
            {FACE_PARTS.map(({ key, count }) => (
              <div key={key} className="flex flex-col gap-2">
                <span className="text-[12px] text-fg-muted">
                  {t(`bots.settings.profile.${key}`)}
                </span>
                <div className="flex flex-wrap gap-3">
                  {Array.from({ length: count }, (_, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a choice's place is its identity.
                    <Skeleton key={index} shape="sm" className="size-9" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <SettingsRow
          label={t('bots.settings.profile.group')}
          hint={
            <>
              {t('bots.settings.profile.groupHint')} ·{' '}
              <span className="text-link">{t('bots.settings.profile.newGroup')}</span>
            </>
          }
          control="field"
        >
          <FieldSelect
            aria-label={t('bots.settings.profile.group')}
            disabled
            value={null}
            onValueChange={noop}
            options={[]}
            placeholder={<Skeleton shape="sm" className="h-3 w-24" />}
            searchPlaceholder={t('bots.settings.profile.searchGroups')}
            emptyText={() => null}
          />
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup aria-hidden>
        <SettingsRow
          label={t('bots.settings.profile.showsIn')}
          hint={t('bots.settings.profile.showsInHint')}
        >
          <div className="flex flex-wrap gap-1.5">
            {BOT_SECTIONS.map((section, index) => (
              <Skeleton
                key={section}
                shape="pill"
                className={`h-7.5 ${PILL_WIDTHS[index % PILL_WIDTHS.length]}`}
              />
            ))}
          </div>
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup aria-hidden>
        <SettingsRow label={t('bots.settings.profile.created')}>
          <span className="flex h-5 items-center">
            <Skeleton shape="sm" className="h-3 w-24" />
          </span>
        </SettingsRow>
      </SettingsGroup>
      <section className="flex flex-col gap-2.5">
        <h2 className="eyebrow m-0 px-1">{t('bots.settings.profile.history')}</h2>
        <BotChatHistorySkeleton />
      </section>
    </div>
  );
}
