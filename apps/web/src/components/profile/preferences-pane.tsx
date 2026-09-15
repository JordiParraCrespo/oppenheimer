import {
  Alert,
  AlertDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
} from '@oppenheimer/design-system-web';
import { useUpdateUserSettings, useUserSettings } from '@oppenheimer/frontend/react';
import {
  DEFAULT_USER_SETTINGS,
  LOCALES,
  type Locale,
  TABLE_DENSITIES,
  type UpdateUserSettingsDto,
  updateUserSettingsSchema,
} from '@oppenheimer/shared/schemas/profile';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  FieldRow,
  RowControl,
  RowMeta,
  SectionCard,
  SectionHead,
  SectionRow,
} from '@/components/section-ui';
import { useTheme } from '@/components/theme-provider';
import { useErrorMessage } from '@/lib/use-error-message';
import { useZodResolver } from '@/lib/use-zod-resolver';

/**
 * Preferences save on change, one `PUT` per control — the reference design has
 * no save button here, and a preferences pane that needs one is a pane people
 * leave without saving. Every control still goes through the form and its
 * resolver: the endpoint is a full replace, so what is sent is the whole
 * document, validated, rather than the one switch that moved.
 *
 * Theme and language are read from the app rather than from the saved
 * document: both are applied locally the moment they change and persist per
 * device, so the server's copy is the cross-device default, not the truth about
 * what this browser is currently showing.
 */
export function PreferencesPane() {
  const { t, i18n } = useTranslation();
  const resolveError = useErrorMessage();
  const { theme, setTheme } = useTheme();
  const settings = useUserSettings();
  const update = useUpdateUserSettings();

  const saved = settings.data;
  const locale = (LOCALES as readonly string[]).includes(i18n.resolvedLanguage ?? '')
    ? (i18n.resolvedLanguage as Locale)
    : DEFAULT_USER_SETTINGS.locale;

  const { control, handleSubmit, setValue } = useForm<UpdateUserSettingsDto>({
    resolver: useZodResolver(updateUserSettingsSchema),
    // `values`, not `defaultValues`: the document arrives after the first
    // render and every save answers with the whole of it.
    values: {
      theme,
      locale,
      density: saved?.density ?? DEFAULT_USER_SETTINGS.density,
      weeklyDigest: saved?.weeklyDigest ?? DEFAULT_USER_SETTINGS.weeklyDigest,
      productUpdates: saved?.productUpdates ?? DEFAULT_USER_SETTINGS.productUpdates,
    },
  });

  const disabled = settings.isPending || update.isPending;
  const failure = settings.error ?? update.error;

  const submit = handleSubmit((values) => update.mutate(values));

  /** Sets one field and sends the whole document. */
  function save<K extends keyof UpdateUserSettingsDto>(key: K, value: UpdateUserSettingsDto[K]) {
    // `as never`: React Hook Form types `setValue`'s value through a path
    // lookup that cannot be narrowed by a generic key, and the parameter
    // types above already hold the pair to the document's shape.
    setValue(key, value as never, { shouldDirty: true });
    void submit();
  }

  // `Select.Value` renders the raw value unless the root is handed the labels;
  // without these the trigger reads "compact" rather than "Compact".
  const localeLabels = Object.fromEntries(LOCALES.map((value) => [value, t(`language.${value}`)]));
  const densityLabels = Object.fromEntries(
    TABLE_DENSITIES.map((value) => [value, t(`profile.preferences.densities.${value}`)]),
  );

  if (settings.isPending) {
    return (
      <>
        <SectionHead
          title={t('profile.preferences.title')}
          sub={t('profile.preferences.description')}
        />
        <SectionCard>
          <div className="flex flex-col gap-3 p-[18px]">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-5 w-48" />
          </div>
        </SectionCard>
      </>
    );
  }

  return (
    <>
      <SectionHead
        title={t('profile.preferences.title')}
        sub={t('profile.preferences.description')}
      />

      {failure && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{resolveError(failure).message}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={submit} noValidate>
        <SectionCard className="mb-6">
          <SectionRow>
            <RowMeta
              name={t('profile.preferences.darkTheme')}
              description={t('profile.preferences.darkThemeDescription')}
            />
            <RowControl>
              <Switch
                aria-label={t('profile.preferences.darkTheme')}
                checked={theme === 'dark'}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  const next = checked ? 'dark' : 'light';
                  setTheme(next);
                  save('theme', next);
                }}
              />
            </RowControl>
          </SectionRow>

          <FieldRow label={t('profile.preferences.language')}>
            <Controller
              control={control}
              name="locale"
              render={({ field }) => (
                <Select
                  items={localeLabels}
                  value={field.value}
                  disabled={disabled}
                  onValueChange={(next) => {
                    const value = next as Locale;
                    void i18n.changeLanguage(value);
                    save('locale', value);
                  }}
                >
                  <SelectTrigger
                    id="preferences-language"
                    aria-label={t('profile.preferences.language')}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {localeLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FieldRow>

          <FieldRow
            label={t('profile.preferences.density')}
            hint={t('profile.preferences.densityDescription')}
          >
            <Controller
              control={control}
              name="density"
              render={({ field }) => (
                <Select
                  items={densityLabels}
                  value={field.value}
                  disabled={disabled}
                  onValueChange={(next) =>
                    save('density', next as UpdateUserSettingsDto['density'])
                  }
                >
                  <SelectTrigger
                    id="preferences-density"
                    aria-label={t('profile.preferences.density')}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TABLE_DENSITIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {densityLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FieldRow>
        </SectionCard>

        <SectionCard>
          <Controller
            control={control}
            name="weeklyDigest"
            render={({ field }) => (
              <SectionRow>
                <RowMeta
                  name={t('profile.preferences.weeklyDigest')}
                  description={t('profile.preferences.weeklyDigestDescription')}
                />
                <RowControl>
                  <Switch
                    aria-label={t('profile.preferences.weeklyDigest')}
                    checked={field.value}
                    disabled={disabled}
                    onCheckedChange={(checked) => save('weeklyDigest', checked)}
                  />
                </RowControl>
              </SectionRow>
            )}
          />
          <Controller
            control={control}
            name="productUpdates"
            render={({ field }) => (
              <SectionRow>
                <RowMeta
                  name={t('profile.preferences.productUpdates')}
                  description={t('profile.preferences.productUpdatesDescription')}
                />
                <RowControl>
                  <Switch
                    aria-label={t('profile.preferences.productUpdates')}
                    checked={field.value}
                    disabled={disabled}
                    onCheckedChange={(checked) => save('productUpdates', checked)}
                  />
                </RowControl>
              </SectionRow>
            )}
          />
        </SectionCard>
      </form>
    </>
  );
}
