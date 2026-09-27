# Recurring feature shapes

Each entry has the files the shape takes and the one mistake it most often
invites. Paths are relative to `apps/web/src/features/<module>/` unless they
say otherwise. Read the entries your feature uses.

## Contents

1. A list with a row menu (cards or rows, a destructive action)
2. A create card beside the list
3. An edit, inline or in a dialog
4. A settings page
5. A detail screen for one record
6. A screen gated on state (no workspace, a step not reached)
7. A form with a live preview or checklist, and a form spread over sections
8. A multi-call flow
9. A picker over a list the workspace grows
10. A stepped editor page (New project, Add host)
11. A page that links elsewhere instead of duplicating a screen

---

## 1. A list with a row menu

The reference is Settings → Hosts.

```
sections/host-list.tsx       useHosts() — draws the rows, the empty card and the failure
sections/host-row.tsx        one host; owns what its menu opens (rename, remove)
components/host-actions-menu.tsx   the menu: props and callbacks only
dialogs/remove-host.tsx      useRemoveHost({ onSuccess: onClose }); props: { host, onClose }
components/hosts-empty.tsx   the design's empty card
lib/host-card.ts             entity → the card's status and meta parts
```

- The list section calls the list hook. The screen above it doesn't.
- The entity query passes `structuralSharing: shareEntities`, so a poll that
  changed one host hands every other row the same object and the row's props
  stay equal.
- A row whose menu opens a dialog or an inline edit holds *whether* it is
  open (`const [removing, setRemoving] = useState(false)`), because the
  menu's content unmounts when it closes. The dialog owns the mutation and
  shows its error in place. One row's pending state never disables every row:
  each row, or each dialog, has its own mutation.
- Loading: nothing, or `Skeleton` rows, until the first answer. Empty:
  `EmptyState` or the design's empty card. Failed: an `Alert` *instead of*
  the list. Don't render a paragraph for any of them.
- Lifecycle state: `Badge variant="active" | "paused" | "ended" | "draft"`,
  or the component that owns the vocabulary (`HostCard status`, `StatusDot`),
  never `destructive` or `secondary`.
- When the list grows past one page, its search, filters and page move into
  the URL and to the server (`frontend-ui.md`); nothing filters one page in
  the browser.
- An action the endpoint's `@CheckPolicies` or a business rule would refuse
  is hidden or disabled with a reason, not offered to end in an error.

**Common mistake:** removing straight from the menu item, with one list-level
`isPending` that disables every row.

## 2. A create card beside the list

```
sections/create-thing-card.tsx   useCreateThing(), useThingCatalog() if the form needs options
forms/create-thing.tsx           RHF + useZodResolver; props: { onSubmit, pending, error, …options }
components/secret-panel.tsx      a one-time value shown after success (if any)
```

- The card owns the mutation and reads the catalog **only if the card draws
  it**. When only the form needs the options, the card reads them to pass
  down; that is fine, because a form can't fetch. What is wrong is a screen
  fetching for the card.
- The form resets itself after success through a `key` bump or the `values`
  option. No effect.
- Success: `toast.success(t('toasts.thingCreated'))`, or a panel for a
  one-time secret (an API token, a pairing command). Not both. A secret's
  module is on `CONSUMER_NON_PERSISTED_FEATURES`.

**Common mistake:** the screen calls `useThingCatalog()` and threads it
through the card into the form. This is the API-keys case the render rules
were written against.

## 3. An edit, inline or in a dialog

Inline, where the value is drawn (a host's name):

```
sections/host-row.tsx     useRenameHost({ onSuccess: () => setRenaming(false) })
forms/rename-host.tsx     RHF over renameHostSchema; props: { defaultName, pending, onSubmit, onCancel }
```

In a dialog, for more than one field:

```
dialogs/edit-thing.tsx    useUpdateThing({ onSuccess: onClose }); renders the form
forms/thing.tsx           useForm({ values: toFormValues(thing), resolver: useZodResolver(updateThingSchema) })
```

- `values` (or a `key` on the record), not `defaultValues` plus an effect, so
  the form follows the record it is given.
- The hook writes the updated row into the cache
  (`setQueryData(thingsKeys.detail(id), updated)`) or invalidates
  `thingsKeys.lists()` when the list derives facts the row alone cannot
  (`useRenameHost` says why it refetches).
- A long dialog puts its middle in `DialogBody`.

## 4. A settings page

Settings is its own chrome beside the console:
`routes/_authenticated/settings.tsx` renders `SettingsShell`, the kit's
`SettingsSidebar` (Account, Workspace) and an `Outlet`. Each page is a child
route (`settings/profile.tsx`, `settings/hosts/index.tsx`) mounting one
screen of the module it renders.

- Add the page as a child route (`/tanstack-routing`) and one item in the
  right `SettingsSidebar` group. A count beside an item is its own section,
  passed through `renderCount`, so the list it reads re-renders the count and
  not the nav (`HostCount`).
- The screen opens with `SettingsTitle`; facts go in `SettingsGroup` +
  `SettingsRow`, lists of machines in `HostCard`s.
- Each part is a `sections/` file in its own module's feature and calls its
  own hooks. When the title needs the same data as a section, both read it:
  TanStack dedupes the request, and each reader re-renders on its own.

**Common mistake:** a `?section=` pane inside one settings screen, or a
`settings/` feature. Neither matches this console.

## 5. A detail screen for one record

```
screens/thing.tsx            composes; takes the id from the route
sections/thing-overview.tsx  useThing(id)
sections/thing-activity.tsx  useThingActivity(id), paged
components/thing-hero.tsx    props only
```

- The query hook gates on the id with `skipToken`:
  `queryFn: id ? () => app.things.findOne(id) : skipToken`, with
  `queryKey: thingsKeys.detail(id)`. A resource under a record nests under
  its detail key (`installationsKeys.repositories(id)`).
- A 404 is a state the screen renders (an `EmptyState` with a way back), not
  a thrown error. `SessionScreen` is the reference: it reads the one session
  and every branch below it renders that result.

## 6. A screen gated on state

An account with no workspace goes to `/onboarding` from the `_authenticated`
layout. The onboarding steps each check they may be shown.

- Redirect only on a **settled, successful, empty** answer:
  `isSuccess && !isFetching && data.length === 0`. While a refetch is in
  flight, or after a failure, render as usual. Otherwise a network blip
  bounces every reader out.
- The target screen redirects back when the condition no longer holds (the
  reader typed the URL, or finished in another tab).
- Guards and redirects are `/tanstack-routing`'s; read it before adding one.

## 7. A form with a live preview or checklist, and a form spread over sections

- The preview or checklist is a `components/` file that takes `control` and
  calls `useWatch({ control, name })` itself. The form never calls
  `watch()` for it (`watch()` also makes the compiler bail out).
- A checklist two features use (password rules) lives in the kit's `auth`
  concern.
- A form whose fields are spread over several sections (New session's chips)
  is a React Hook Form store behind a context whose value never changes
  (`hooks/use-new-session-form.ts`). Each section binds its own field with
  `useController` or `useWatch` and fetches the list it draws; the section
  that owns the store reads no field. `new-session-form-render.spec.tsx`
  asserts a pick renders only the chip that was picked.

**Common mistake:** `const [name, host] = watch(['name', 'host'])` at the top
of the form. That re-renders every field on every keystroke.

## 8. A multi-call flow

Claim the personal workspace, then connect GitHub. Or create a session, then
follow its start progress.

- The chain is **one hook in the product package**. Each step calls the
  service, and the hook's `withCacheOnSuccess` update invalidates exactly
  what the chain changed.
- The screen calls `mutate(values)` and renders `error` through
  `useErrorMessage()`.

**Common mistake:** a `useMutation({ mutationFn: async () => { await a(); await b(); } })`
in the screen, ending in a bare `invalidateQueries()`.

## 9. A picker over a list the workspace grows

It is a `ChipSelect`, always searchable, in a `Controller`. When the options
come from an endpoint that can hold more than one page, give it
`onQueryChange` pointed at the query that fetches them (debounced there) and
`loading`; it then filters nothing itself. A fixed short list inside a menu is
`DropdownMenuRadioGroup`; a labelled pick in the routine editor is
`FieldSelect`. `frontend-ui.md` has the table.

## 10. A stepped editor page

New project and Add host fill something in over the main column rather than in
a dialog: the route sits under `_authenticated/_editor/`, the screen renders
`EditorPage` with `EditorPageBack`, the `PageHeader` parts and
`RoutineSteps`. One screen can be mounted twice (`AddHostScreen` at
`/hosts/new` and at `/settings/hosts/new`, with `from="settings"`): the route
decides the chrome, the screen stays one.

## 11. A page that links elsewhere instead of duplicating a screen

When one screen owns a resource (Add host) and another page wants it (a
Settings button, the composer's host chip), the second page links to the one
screen. It isn't a second implementation. Two copies drift, and a fix only
ever lands in one of them.
