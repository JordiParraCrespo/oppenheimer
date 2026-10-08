import {
  Button,
  Field,
  FieldLabel,
  RadioGroup,
  RadioGroupItem,
} from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import {
  type CreateShareLinkDto,
  createShareLinkSchema,
  shareLinkAccessSchema,
  shareLinkAudienceSchema,
  shareLinkLifetimeSchema,
} from '@oppenheimer/shared/schemas/session-share';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ShareLifetimeField } from '../components/share-lifetime-field';
import { SharePeopleField } from '../components/share-people-field';
import { ShareWriteWarning } from '../components/share-write-warning';
import { type ShareLinkValues, shareLinkInput } from '../lib/share-links';

/**
 * The form's own shape over the shared vocabulary: people are typed as one
 * block of text and "never" is a lifetime the request spells as `null`. What
 * it may hold is the API's own schema, asked of the request the form would
 * send, so the cap on people, the email check and the cap on lifetime are
 * one rule on both sides. Each failure lands on the field it is about, with
 * its message handed in translated.
 */
function shareLinkFormSchema(messages: {
  people: string;
  lifetime: string;
}): z.ZodType<ShareLinkValues> {
  return z
    .object({
      access: shareLinkAccessSchema,
      audience: shareLinkAudienceSchema,
      people: z.string(),
      lifetime: z.union([shareLinkLifetimeSchema, z.literal('never')]),
    })
    .superRefine((values, ctx) => {
      const parsed = createShareLinkSchema.safeParse(shareLinkInput(values));
      if (parsed.success) return;
      const fields = new Set(parsed.error.issues.map((issue) => issue.path[0]));
      for (const field of ['people', 'lifetime'] as const) {
        if (fields.has(field)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: messages[field] });
        }
      }
    });
}

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
    resolver: useZodResolver(
      shareLinkFormSchema({
        people: t('sessions.share.peopleInvalid'),
        lifetime: t('sessions.share.lifetimeTooLong'),
      }),
    ),
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

      <ShareLifetimeField
        control={control}
        error={formState.errors.lifetime}
        disabled={isPending}
      />

      <ShareWriteWarning control={control} />

      <div className="flex justify-end">
        <Button type="submit" pending={isPending} pendingLabel={t('sessions.share.creating')}>
          {t('sessions.share.create')}
        </Button>
      </div>
    </form>
  );
}
