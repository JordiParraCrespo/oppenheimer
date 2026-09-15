---
paths:
  - "apps/web/**/*"
  - "apps/mobile/**/*"
  - "packages/frontend/src/validation/**/*"
  - "packages/shared/src/schemas/**/*"
---

# Forms Rules

Every form in `apps/web` and `apps/mobile` uses **React Hook Form** validated by
a **Zod schema from `@oppenheimer/shared`**. Do not hand-roll form state: no
`useState` per field, no `new FormData(event.currentTarget)`, no `safeParse` in
a submit handler, and no relying on the browser's native `required` /
`type="email"` for validation.

The resolver always comes from the app's `useZodResolver` hook, never from
`zodResolver` directly — that hook is what keeps failure messages translated.

## Web (`apps/web`)

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
import { useZodResolver } from "@/lib/use-zod-resolver";

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
- Anything that is not a plain input — `Select`, `Checkbox` groups, the
  `PermissionPicker` — needs a `Controller`, because there is no ref to
  register.

## Mobile (`apps/mobile`)

React Native has no DOM refs, so `register()` does not work. Every field goes
through `Controller`, wired to the app-local `FormField` (label + control +
error, mirroring the web `Field`).

```tsx
<Controller
  control={control}
  name="email"
  render={({ field, fieldState }) => (
    <FormField
      label={t("auth.email")}
      nativeID="email"
      error={fieldState.error?.message}
    >
      <Input
        aria-labelledby="email"
        value={field.value}
        onChangeText={field.onChange}
        onBlur={field.onBlur}
      />
    </FormField>
  )}
/>
```

Pass `field.onBlur` through, not just `onChange` — without it `touched` never
updates and blur-mode validation silently does nothing. Report failures inline;
do not put them in an `Alert`.

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

The exception is a `refine` whose meaning cannot be recovered from the issue
code (an IP-or-CIDR check, say). Those keep their message and fall through
untranslated by design.

## Adding a message

`createZodErrorMap` (in `@oppenheimer/frontend/validation`) maps a Zod issue code onto
a `validation.*` translation key. To cover a new issue code:

1. Add the case to `createZodErrorMap`.
2. Add the key to `ValidationMessageKey` in the same file.
3. Add the message to **every** locale in `packages/translations/*/index.json`.

`TranslateFn` is narrow on purpose — each app hands it a `t` typed over the
whole catalog, so a key you forget to add is a compile error rather than a raw
key rendered to a user. Skipping step 3 breaks the build; that is the point.

Interpolate with named params (`{{min}}`, `{{max}}`), not `count` — i18next
treats `count` as a pluralisation trigger and will look for `_one` / `_other`
variants that do not exist.

## Schemas that would bloat the web bundle

`apps/web` must not import runtime values from the `@oppenheimer/shared` **root**; see
the note in the repo-root `AGENTS.md`. For forms this means:

- Auth forms import from `@oppenheimer/shared/schemas/auth`, which pulls in nothing
  but Zod.
- `createApiTokenSchema` imports the scope catalog, so the API-token form
  declares its value type locally and validates with React Hook Form's built-in
  rules instead. Reach for the same escape hatch for any schema whose
  transitive imports do not belong in a browser bundle.
- A new narrow subpath needs an `exports` entry in `packages/shared/package.json`
  **and** an entry in `optimizeDeps.include` in `apps/web/vite.config.ts`;
  workspace `dist` folders sit outside `node_modules`, so Vite will not
  pre-bundle the CommonJS build without being told.
