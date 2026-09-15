---
paths:
  - "apps/api/**/*"
  - "packages/backend/**/*"
---

# NestJS Dependency Injection Rules

## NEVER use `import type` for DI-injected classes

NestJS relies on `emitDecoratorMetadata` to resolve constructor parameters at runtime. `import type` erases the class reference, causing `Function` (undefined) in metadata and breaking DI.

```typescript
// WRONG — breaks DI
import type { ConfigService } from "@nestjs/config";

// CORRECT — preserves runtime metadata
import { ConfigService } from "@nestjs/config";
```

### When `import type` IS safe

- **Interfaces and type aliases** — they don't exist at runtime anyway
- **Types used only in annotations** — e.g. `Request`, `Response` from express
- **Classes resolved via explicit decorators** — `@InjectRepository(User)` provides its own token, so `Repository` can be `import type`
- **Classes resolved via `@InjectQueue()`** — same as above
- **Repository ports resolved via `@Inject(TOKEN)`** — the token provides the
  runtime binding, so the port type can be `import type` (it's an interface)
- **Classes in test files** — used for typing mocks, not injected

## Inject repository ports through a DI token

Application/domain code depends on the port abstraction, not the concrete
TypeORM adapter. Define a `Symbol` token in `<module>.di-tokens.ts`, bind it in
the module, and inject with `@Inject`:

```typescript
// user.di-tokens.ts
export const USER_REPOSITORY = Symbol("USER_REPOSITORY");

// user.module.ts
providers: [{ provide: USER_REPOSITORY, useClass: UserRepository }],

// a handler
constructor(
  @Inject(USER_REPOSITORY)
  private readonly userRepository: UserRepositoryPort,
) {}
```

### Biome `useImportType` rule

This rule is disabled globally in `biome.json` (`linter.rules.style.useImportType: "off"`). Do not re-enable it — Biome auto-converts value imports to type imports when it thinks a symbol is only used as a type annotation (which includes constructor parameter types), and this breaks NestJS DI.
