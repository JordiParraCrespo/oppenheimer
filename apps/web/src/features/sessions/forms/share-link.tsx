import {
  Button,
  Field,
  FieldLabel,
  FieldSelect,
  RadioGroup,
  RadioGroupItem,
} from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import {
  type CreateShareLinkDto,
  shareLinkAccessSchema,
  shareLinkAudienceSchema,
  shareLinkLifetimeSchema,
} from '@oppenheimer/shared/schemas/session-share';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { SharePeopleField } from '../components/share-people-field';
import { ShareWriteWarning } from '../components/share-write-warning';
import { peopleOf, type ShareLinkValues, shareLinkInput } from '../lib/share-links';

/**
 * The form's own shape over the shared vocabulary: people are typed as one
 * block of text and become the request's list on submit, and "never" is a
 * lifetime the request spells as `null`. Whether that list holds at least one
 * email and nothing else is this form's check, so its message is handed in
 * translated.
 */
function shareLinkFormSchema(peopleMessage: string): z.ZodType<ShareLinkValues> {
  return z
    .object({
      access: shareLinkAccessSchema,
      audience: shareLinkAudienceSchema,
      people: z.string(),
      lifetime: z.union([shareLinkLifetimeSchema, z.literal('never')]),
    })
    .refine(
      (values) => {
        if (values.audience !== 'people') return true;
        const people = peopleOf(values.people);
        return (
          people.length > 0 && people.every((email) => z.string().email().safeParse(email).success)
        );
      },
      { path: ['people'], message: peopleMessage },
    );
}

const LIFETIMES = ['1h', '1d', '7d', '30d', 'never'] as const;

/**
 * What a new link lets its holder do, who may hold it, and for how long.
 * Defaults to the narrowest useful link: watching, for signed-in accounts,
 * for a day.
 */
export function ShareLinkForm({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (input: CreateShareLinkDto) => void;
}) {
  const { t } = useTranslation();
  const { control, register, handleSubmit, formState } = useForm<ShareLinkValues>({
    resolver: useZodResolver(shareLinkFormSchema(t('sessions.share.peopleInvalid'))),
    defaultValues: { access: 'read', audience: 'accounts', people: '', lifetime: '1d' },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(shareLinkInput(values)))}
      noValidate
      className="flex flex-col gap-5"
    >
      <Field>
        <FieldLabel>{t('sessions.share.access')}</FieldLabel>
        <Controller
          control={control}
          name="access"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} disabled={isPending}>
              <RadioGroupItem
                value="read"
                label={t('sessions.share.read')}
                description={t('sessions.share.readHint')}
              />
              <RadioGroupItem
                value="write"
                label={t('sessions.share.write')}
                description={t('sessions.share.writeHint')}
              />
            </RadioGroup>
          )}
        />
      </Field>

      <Field>
        <FieldLabel>{t('sessions.share.audience')}</FieldLabel>
        <Controller
          control={control}
          name="audience"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} disabled={isPending}>
              <RadioGroupItem
                value="people"
                label={t('sessions.share.people')}
                description={t('sessions.share.peopleHint')}
              />
              <RadioGroupItem
                value="accounts"
                label={t('sessions.share.accounts')}
                description={t('sessions.share.accountsHint')}
              />
              <RadioGroupItem
                value="anyone"
                label={t('sessions.share.anyone')}
                description={t('sessions.share.anyoneHint')}
              />
            </RadioGroup>
          )}
        />
      </Field>

      <SharePeopleField
        control={control}
        field={register('people')}
        error={formState.errors.people}
        disabled={isPending}
      />

      <Field>
        <FieldLabel>{t('sessions.share.lifetime')}</FieldLabel>
        <Controller
          control={control}
          name="lifetime"
          render={({ field }) => (
            <FieldSelect
              aria-label={t('sessions.share.lifetime')}
              placeholder={t('sessions.share.lifetime')}
              searchPlaceholder={t('sessions.share.lifetimeSearch')}
              emptyText={() => t('sessions.share.lifetimeNone')}
              value={field.value}
              onValueChange={field.onChange}
              disabled={isPending}
              options={LIFETIMES.map((lifetime) => ({
                value: lifetime,
                label: t(`sessions.share.lifetimes.${lifetime}`),
              }))}
            />
          )}
        />
      </Field>

      <ShareWriteWarning control={control} />

      <div className="flex justify-end">
        <Button type="submit" pending={isPending} pendingLabel={t('sessions.share.creating')}>
          {t('sessions.share.create')}
        </Button>
      </div>
    </form>
  );
}
