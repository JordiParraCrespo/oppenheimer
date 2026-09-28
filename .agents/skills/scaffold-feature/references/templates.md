# Templates

Code shapes to copy, using a `things` module in the consumer product. Each one
is lifted from the reference file named in its heading. When in doubt, open
that file: the templates follow it, not the other way round.

## Contents

1. Entity and errors (`consumer/src/modules/hosts/`)
2. Repository, service, module, tokens, `ConsumerApp`
3. Query hooks and the key ladder (`consumer/src/react/hosts.queries.ts`, `installations.queries.ts`)
4. Route file (`apps/web/src/routes/_authenticated/settings/hosts/index.tsx`)
5. Screen and section (`features/hosts/screens/hosts-settings.tsx`, `sections/host-list.tsx`)
6. A row that owns its menu's dialog, and the confirm dialog (`sections/host-row.tsx`, the kit's `ConfirmDialog`)
7. Form (`features/hosts/forms/rename-host.tsx`)
8. Leaf subscription (`packages/frontend/web/src/auth/components/password-requirements.tsx`)
9. E2E spec (`e2e/tests/web/settings-hosts.spec.ts`)
10. Render-budget spec (`features/sessions/__tests__/sessions-sidebar-render.spec.tsx`)

---

## 1. Entity and errors

```ts
// packages/frontend/consumer/src/modules/things/thing.entity.ts
/** A thing as the UI needs it. Derived state is a getter, not a field. */
export class ThingEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    /** `null` when the API has not reported it; never a placeholder. */
    public readonly lastSeenAt: Date | null,
    public readonly archivedAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  get status(): 'active' | 'archived' {
    return this.archivedAt ? 'archived' : 'active';
  }
}
```

```ts
// things.errors.ts: client fallbacks only; the server's problem document wins
import type { ErrorDefinition } from '@oppenheimer/frontend-core';

export const ThingsErrors = {
  FETCH_LIST_FAILED: { code: 'THINGS_CLIENT_001', message: 'Failed to load things' },
  CREATE_FAILED: { code: 'THINGS_CLIENT_002', message: 'Failed to create the thing' },
} as const satisfies Record<string, ErrorDefinition>;
```

## 2. Repository, service, module, tokens

```ts
// things.repository.ts
import { heyApiSdk, type ThingResponseDto } from '@oppenheimer/api-client';
import { AppError, MapApiError } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import { ThingEntity } from './thing.entity';
import { ThingsErrors } from './things.errors';

function toEntity(data: ThingResponseDto): ThingEntity {
  return new ThingEntity(
    data.id,
    data.name,
    data.lastSeenAt ? new Date(data.lastSeenAt) : null,
    data.archivedAt ? new Date(data.archivedAt) : null,
    new Date(data.createdAt),
  );
}

@injectable()
export class ThingsRepository {
  @MapApiError(ThingsErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<ThingEntity[]> {
    const { data, error } = await heyApiSdk.findThings();
    // An absent body is a failed read, not an empty collection: `[]` would
    // render "no things" over a request that never succeeded.
    if (error || !data) throw new AppError(ThingsErrors.FETCH_LIST_FAILED);
    return data.map(toEntity);
  }
}
```

```ts
// things.service.ts: the use cases; inject the repository by token
@injectable()
export class ThingsService {
  constructor(@inject(TOKENS.ThingsRepository) private readonly repository: ThingsRepository) {}
  findAll() { return this.repository.findAll(); }
}

// things.module.ts
export const ThingsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.ThingsRepository).to(ThingsRepository).inSingletonScope();
  bind(TOKENS.ThingsService).to(ThingsService).inSingletonScope();
});
```

Then:

- `src/di/tokens.ts`: `ThingsRepository` and `ThingsService` symbols.
- `src/di/consumer-app.ts`: push `ThingsModule` into `consumerModules`, and
  add `get things(): ThingsService`.
- `src/modules/things/index.ts`, plus `export * from './things'` in
  `src/modules/index.ts`.

## 3. Query hooks and the key ladder

```ts
// packages/frontend/consumer/src/react/things.queries.ts
'use client';

import { shareEntities, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  skipToken,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { CreateThingInput, ThingEntity } from '../modules/things/thing.entity';
import { useConsumerApp } from './context';

/**
 * One function per level, each derived from the one above, so any subtree can
 * be named and one invalidation reaches everything under it:
 *
 * ```
 * ['things']                          all
 * ['things', 'list']                  lists() → list()
 * ['things', 'detail', id]            details() → detail(id)
 * ['things', 'detail', id, 'events']  events(id)
 * ```
 */
export const thingsKeys = {
  all: ['things'] as const,
  lists: () => [...thingsKeys.all, 'list'] as const,
  list: () => [...thingsKeys.lists()] as const,
  details: () => [...thingsKeys.all, 'detail'] as const,
  detail: (id: string | undefined) => [...thingsKeys.details(), id] as const,
  events: (id: string | undefined) => [...thingsKeys.detail(id), 'events'] as const,
};

/**
 * Pass `select` to subscribe to less than the whole list (one thing's name,
 * the ids), so a refetch that changes nothing the reader shows does not
 * re-render it.
 */
export function useThings<TData = ThingEntity[]>(
  options?: Omit<UseQueryOptions<ThingEntity[], Error, TData>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();
  return useQuery<ThingEntity[], Error, TData>({
    queryKey: thingsKeys.list(),
    queryFn: () => app.things.findAll(),
    // Entities are classes: without this every refetch is a new object per row.
    structuralSharing: shareEntities,
    ...options,
  });
}

/** For a read in an event handler: the list as cached, without subscribing. */
export function useThingsSnapshot(): () => ThingEntity[] | undefined {
  const queryClient = useQueryClient();
  return () => queryClient.getQueryData<ThingEntity[]>(thingsKeys.list());
}

export function useThing(id: string | undefined) {
  const app = useConsumerApp();
  return useQuery({
    queryKey: thingsKeys.detail(id),
    // skipToken, never `enabled`: the input stays in the key and the queryFn needs no `!`.
    queryFn: id ? () => app.things.findOne(id) : skipToken,
    structuralSharing: shareEntities,
  });
}

export function useCreateThing(options?: UseMutationOptions<ThingEntity, Error, CreateThingInput>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateThingInput) => app.things.create(input),
    // The hook's cache write runs first and is awaited; the caller's onSuccess after it.
    ...withCacheOnSuccess(options, (created) => {
      queryClient.setQueryData(thingsKeys.detail(created.id), created);
      return queryClient.invalidateQueries({ queryKey: thingsKeys.lists() });
    }),
  });
}
```

Export the keys and hooks by name from `src/react/index.ts`, then rebuild
(`pnpm turbo run build --filter @oppenheimer/frontend-consumer`) before the
app typechecks against them. A paged read keys its page (or cursor) under
the level it narrows, and a stream (`sessions.stream.ts`) is a hook of its
own, not a query.

## 4. Route file

```tsx
// apps/web/src/routes/_authenticated/settings/things.tsx
import { createFileRoute } from '@tanstack/react-router';
import { ThingsSettingsScreen } from '@/features/things/screens/things-settings';

/** Settings → Things: what the page is, in one line. */
export const Route = createFileRoute('/_authenticated/settings/things')({
  component: ThingsSettingsScreen,
});
```

- Then an item in `SettingsSidebar`'s group in
  `routes/_authenticated/settings.tsx`, with its `labelKey` under the nav's
  translations.
- A new file regenerates `routeTree.gen.ts`; a rename changes a URL. Both are
  `/tanstack-routing`, which has the check that proves the URL set.
- A `validateSearch` returns `{ ...rest, key }`, carrying unknown keys
  through so another component's search state survives.

## 5. Screen and section

```tsx
// features/things/screens/things-settings.tsx: composes, never subscribes for a child
export function ThingsSettingsScreen() {
  const { t } = useTranslation();
  return (
    <>
      <SettingsTitle title={t('settings.things.title')} description={t('settings.things.description')} />
      <CreateThingCard />
      <ThingList />
    </>
  );
}
```

```tsx
// features/things/sections/thing-list.tsx: asks for what it draws, renders every state
export function ThingList() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const things = useThings();

  if (things.isPending) return <Skeleton className="h-16 w-full" />;
  if (things.isError) {
    // Instead of the list, never above an empty one: "no things" would be false.
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {resolveError(things.error, t('settings.things.failed')).message}
        </AlertDescription>
      </Alert>
    );
  }
  if (things.data.length === 0) {
    return (
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Title>{t('settings.things.empty')}</EmptyState.Title>
          <EmptyState.Description>{t('settings.things.emptyHint')}</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {things.data.map((thing) => (
        <ThingRow key={thing.id} thing={thing} />
      ))}
    </div>
  );
}
```

Check each design-system component's props in its file before copying a
call: `EmptyState` is a compound (`EmptyState.Header`, `.Media`, `.Title`,
`.Description`), and `SettingsTitle` takes `title`, `description` and an
`action` slot.

## 6. A row that owns its menu's dialog, and the confirm dialog

```tsx
// features/things/sections/thing-row.tsx
export function ThingRow({ thing }: { thing: ThingEntity }) {
  const { t } = useTranslation();
  const locale = useLocale();
  // Held here, not in the dialog: it opens from a menu that unmounts on close.
  const [archiving, setArchiving] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
        <div className="flex flex-col">
          <span className="text-fg">{thing.name}</span>
          <span className="text-fg-muted">{formatMediumDate(thing.createdAt, locale)}</span>
        </div>
        <Badge variant={thing.status === 'active' ? 'active' : 'ended'}>
          {t(`settings.things.status.${thing.status}`)}
        </Badge>
        {thing.status === 'active' ? (
          <ThingActionsMenu name={thing.name} onArchive={() => setArchiving(true)} />
        ) : null}
      </div>
      {archiving ? <ArchiveThingDialog thing={thing} onClose={() => setArchiving(false)} /> : null}
    </>
  );
}
```

```tsx
// features/things/dialogs/archive-thing.tsx: owns its mutation; the failure stays in it
export function ArchiveThingDialog({ thing, onClose }: { thing: ThingEntity; onClose: () => void }) {
  const { t } = useTranslation();
  const archive = useArchiveThing({
    onSuccess: () => {
      toast.success(t('toasts.thingArchived', { name: thing.name }));
      onClose();
    },
  });

  return (
    <ConfirmDialog
      title={t('settings.things.archiveTitle', { name: thing.name })}
      description={t('settings.things.archiveDescription')}
      confirmLabel={t('settings.things.archive')}
      pending={archive.isPending}
      error={archive.error}
      onClose={onClose}
      onConfirm={() => archive.mutate(thing.id)}
    />
  );
}
```

`ConfirmDialog` (kit, `layout/dialogs/confirm-dialog.tsx`) resolves `error`
through `useErrorMessage()` itself. When the design draws the dialog
differently (no hero, a count in the description), write it like
`RemoveHostDialog`: the same props, the design's markup.

## 7. Form

```tsx
// features/things/forms/thing.tsx: props in, onSubmit out, never fetches
export function ThingForm({
  thing,
  pending,
  error,
  onSubmit,
}: {
  thing?: ThingEntity;
  pending: boolean;
  error?: string;
  onSubmit: (values: UpdateThingDto) => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateThingDto>({
    resolver: useZodResolver(updateThingSchema),
    // `values`, not defaultValues plus an effect: the form follows the record.
    values: { name: thing?.name ?? '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor="thing-name">{t('settings.things.name')}</FieldLabel>
          <Input {...register('name')} id="thing-name" aria-invalid={Boolean(errors.name)} />
          <FieldDescription>{t('settings.things.nameHint')}</FieldDescription>
          <FieldError errors={[errors.name]} />
        </Field>
        <Button type="submit" disabled={pending}>
          {t('common.save')}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

- `useZodResolver` comes from `@oppenheimer/frontend-web`; the schema from
  `@oppenheimer/shared/schemas/<area>`, a subpath. In `apps/web` that is
  required, and a new subpath also needs `optimizeDeps.include` in
  `vite.config.ts` and an `exports` entry in `packages/shared/package.json`.
- The section or dialog above resolves the failure:
  `error={mutation.error ? resolveError(mutation.error, t('common.error')).message : undefined}`,
  with `resolveError = useErrorMessage()`.
- A picker (`ChipSelect`, `FieldSelect`, `SegmentedControl`) is a
  `Controller`: `value` and `onValueChange` to the field's `value` and
  `onChange`.

## 8. Leaf subscription

```tsx
// components/thing-preview.tsx: re-renders on its own field, not the form's
export function ThingPreview({ control }: { control: Control<UpdateThingDto> }) {
  const name = useWatch({ control, name: 'name' });
  return <span className="text-fg">{name}</span>;
}
```

The form renders `<ThingPreview control={control} />` and never calls
`watch()` for it. A clock is the same shape: the leaf that draws an age calls
`useNow(60_000)`, the row above it does not.

## 9. E2E spec

```ts
// the web suite: tests/web/things.spec.ts
import { expect, test } from '@playwright/test';
import { provisionedUser, reloadFromServer, signInAs } from '../../support/web';

test('creates a thing, keeps it across a reload, and archives it after confirming', async ({ page }) => {
  const owner = await provisionedUser('things');
  await signInAs(page, owner.user);
  await page.goto('/settings/things');

  // Unique per run: archived rows stay listed.
  const name = `e2e-thing-${Date.now()}`;
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  await reloadFromServer(page);
  const row = page.getByText(name);
  await expect(row).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: `Actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Archive' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(page.getByText('Archived')).toBeVisible();

  await owner.api.dispose();
});
```

- Each spec creates what it asserts on (`provisionedUser`, `pairHost` from
  `support/sessions`). No seeded rows.
- Reload with `reloadFromServer` before you assert on persistence: the query
  cache is persisted, so a plain reload can show what the mutation wrote.
- A row menu that refetches under the click is `clickRowAction`.

## 10. Render-budget spec

For a component whose cost is the point. The name ends in
`-render.spec.tsx`, so it runs in the `render-budget` project with the React
Compiler **off**:

```tsx
// features/things/__tests__/thing-list-render.spec.tsx
it('a poll that changed one thing re-renders only that row', () => {
  world.set({ things: [first, renamedSecond] });
  expect(renders.get('first')).toBe(1);
  expect(renders.get('renamed')).toBe(1);
});
```

Count renders where the row reaches the design system (mock the primitive and
count its calls), and drive every clock the component has from one store the
test controls: see `sessions-sidebar-render.spec.tsx` for the harness. Write
it so the value feeds back the way the real caller feeds it, or the test
passes on the very shape it was meant to forbid.
