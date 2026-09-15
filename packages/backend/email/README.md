# @oppenheimer/backend-email

Pluggable transactional email for the API, with templates authored in
[React Email](https://react.email/). Swap providers without touching call sites.

## What's inside

- `EmailService` — abstract contract (+ typed params like `InvitationEmailParams`).
- Implementations:
  - `ConsoleEmailService` — logs emails to stdout (local dev / tests).
  - `NodemailerEmailService` — SMTP via `nodemailer`.
  - `ResendEmailService` — [Resend](https://resend.com/) API.
- `EmailModule` — selects the implementation from config and binds it to
  `EmailService`.

Follows the **pluggable service** pattern: abstract class → concrete
implementations → factory in the module. React Email templates render to HTML at
send time.

## Usage

```ts
import { EmailModule, EmailService } from '@oppenheimer/backend-email';

// inject the abstract service; the module wires the concrete provider
constructor(private readonly email: EmailService) {}
```

## Scripts

```bash
pnpm build   # tsc -> dist
pnpm dev     # tsc --watch
```

## Consumed by

`apps/api`.
