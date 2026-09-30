import { Injectable } from '@nestjs/common';
import type { CredentialResolverPort } from './credential-resolver.port';

/**
 * Every credential kind the running application accepts, collected at boot
 * from `AuthModule.contributeCredentials`; a module never imported contributes
 * nothing.
 *
 * Order is module-import order, and the kernel takes the first resolver that
 * recognises a credential, so two kinds that could claim the same string would
 * be decided by wiring. A duplicate `kind` is therefore refused at startup.
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

  all(): readonly CredentialResolverPort[] {
    return this.resolvers;
  }
}
