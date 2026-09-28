---
paths:
  - "apps/web/**/*"
  - "packages/frontend/core/src/validation/**/*"
  - "packages/shared/src/schemas/**/*"
---

# Forms Rules

Every form in `apps/web` uses **React Hook Form** validated by
a **Zod schema from `@oppenheimer/shared`**. Do not hand-roll form state: no
`useState` per field, no `new FormData(event.currentTarget)`, no `safeParse` in
a submit handler, and no relying on the browser's native `required` /
`type="email"` for validation.

The resolver always comes from the app's `useZodResolver` hook, never from
`zodResolver` directly — that hook is what keeps failure messages translated.

## Wiring a field

Plain inputs take `register()`. The design system's `Field` / `FieldError`
already speak React Hook Form's error shape, so no wrapper component is needed.

```tsx
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from "@oppenheimer/design-system-web";
import { type LoginDto, loginSchema } from "@oppenheimer/shared/schemas/auth";
import { useForm } from "react-hook-form";
import { useZodResolver } from "@oppenheimer/frontend-web";

const {
  register,
  handleSubmit,
  formState: { errors },
} = useForm<LoginDto>({
  resolver: useZodResolver(loginSchema),
  defaultValues: { email: "", password: "" },
});

<form onSubmit={handleSubmit(onValid)} noValidate>
  <FieldGroup>
    <Field data-invalid={Boolean(errors.email)}>
      <FieldLabel htmlFor="email">{t("auth.email")}</FieldLabel>
      <Input
        {...register("email")}
        id="email"
        type="email"
        aria-invalid={Boolean(errors.email)}
      />
      <FieldError errors={[errors.email]} />
    </Field>
  </FieldGroup>
</form>;
```

- `noValidate` on the `<form>`: validation is Zod's job, and leaving the native
  layer on gives two competing sets of messages.
- `data-invalid` on the `Field` drives the destructive styling; `aria-invalid`
  on the control is what assistive tech reads. Set both.
- Anything that is not a plain input — a `ChipSelect` or `FieldSelect`, a
  `SegmentedControl`, the `PermissionMenu` — needs a `Controller`, because
  there is no ref to register: `value` and `onValueChange` go to the field's
  `value` and `onChange`.

## Schemas must not carry their own messages

Zod short-circuits any error map when a check states its own message, so
`z.string().email('Invalid email address')` pins every consumer to English and
silently defeats translation. Schemas in `packages/shared/src/schemas/` state
the **constraint only**:

```ts
// Right
email: z.string().email(),
password: z.string().min(8),

// Wrong — untranslatable
email: z.string().email('Invalid email address'),
```

A `refine` has no issue code worth reading (`custom`), so it names its message
through params instead of stating one:

```ts
.refine((value) => byteLength(value) <= MAX, { params: { i18nKey: 'validation.tooLong' } })
```

The map translates the key, interpolating any other params; a `refine` that
names no key reads as `validation.invalid`. Every issue code has a case, so
nothing reaches a form in Zod's English. The one remaining exception is a
check that states its own message (the IP-or-CIDR refine on API tokens): Zod
never asks the map about it.

## Adding a message

`createZodErrorMap` (in `@oppenheimer/frontend-core/validation` (`packages/frontend/core/src/validation/`)) maps a Zod issue code onto
a `validation.*` translation key. To cover a new issue code:

1. Add the case to `createZodErrorMap`.
2. Add the key to `VALIDATION_MESSAGE_KEYS` in the same file.
3. Add the message to **every** locale in `packages/translations/*/validation.json`,
   then run `pnpm --filter @oppenheimer/translations assemble`.

`TranslateFn` is narrow on purpose — the app hands it a `t` typed over the
whole catalog, so a key you forget to add is a compile error rather than a raw
key rendered to a user. Skipping step 3 breaks the build; that is the point.

Interpolate with named params (`{{min}}`, `{{max}}`), not `count` — i18next
treats `count` as a pluralisation trigger and will look for `_one` / `_other`
variants that do not exist.

## Schemas that would bloat the web bundle

`@oppenheimer/shared` tree-shakes in `apps/web` (see the note in the
repo-root `AGENTS.md`), so the cost of a schema is what it reaches, not where
it is imported from. For forms this means:

- Auth forms import from `@oppenheimer/shared/schemas/auth`, which pulls in nothing
  but Zod. Prefer the schema's own subpath over the root; it names the
  dependency.
- `createApiTokenSchema` imports the scope catalog, so the API-token form
  declares its value type locally and validates with React Hook Form's built-in
  rules instead. Reach for the same escape hatch for any schema whose
  transitive imports do not belong in a browser bundle.
- A new schema file `src/schemas/<area>.schema.ts` is reachable as
  `@oppenheimer/shared/schemas/<area>` with no config: the export map is a
  pattern.
