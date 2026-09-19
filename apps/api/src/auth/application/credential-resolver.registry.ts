import { Injectable } from '@nestjs/common';
import type { CredentialResolverPort } from './credential-resolver.port';

/**
 * Every credential kind the running application accepts, collected at boot.
 *
 * This is the extension point that replaces the kernel hard-coding the list:
 * a module registers its resolver through `AuthModule.forFeature([...])`, and
 * `CredentialScopeResolver` asks whoever is registered. A module that is never
 * imported contributes nothing, so the registry describes the application that
 * is actually running.
 *
 * Order is registration order, which is module-import order — the kernel takes
 * the first resolver that recognises a credential, so two kinds that could
 * claim the same string would be decided by wiring. A duplicate `kind` is
 * therefore refused at startup rather than silently shadowed.
 */
@Injectable()
export class CredentialResolverRegistry {
  private readonly resolvers: CredentialResolverPort[] = [];

  register(resolver: CredentialResolverPort): void {
    const clash = this.resolvers.find((existing) => existing.kind === resolver.kind);
    if (clash) {
      if (clash === resolver) return;
      throw new Error(
        `Credential kind "${resolver.kind}" is already registered by ${clash.constructor.name}`,
      );
    }
    this.resolvers.push(resolver);
  }

  registerAll(resolvers: readonly CredentialResolverPort[]): void {
    for (const resolver of resolvers) this.register(resolver);
  }

  /** The registered resolvers, in registration order. */
  all(): readonly CredentialResolverPort[] {
    return this.resolvers;
  }
}
