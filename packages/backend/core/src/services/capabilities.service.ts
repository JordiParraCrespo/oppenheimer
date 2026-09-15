import { Injectable } from '@nestjs/common';

export type CapabilityMap<TCapability extends string = string> = Record<TCapability, boolean>;

/**
 * Registry of the optional capabilities a deployment resolved from its
 * configuration, once at boot. A capability is anything a self-hoster might
 * not have configured (an OAuth provider, Stripe, S3, an email transport):
 * a missing key removes the capability, it never throws.
 *
 * The application declares its capability set at composition time (a factory
 * provider that reads `ConfigService`) and every consumer — startup logging,
 * health endpoints, feature guards — asks this one registry instead of
 * re-deriving presence from raw config, or worse, comparing against a
 * sentinel value.
 */
@Injectable()
export class CapabilitiesService<TCapability extends string = string> {
  private readonly capabilities: Readonly<CapabilityMap<TCapability>>;

  constructor(capabilities: CapabilityMap<TCapability>) {
    this.capabilities = Object.freeze({ ...capabilities });
  }

  has(capability: TCapability): boolean {
    return this.capabilities[capability] === true;
  }

  snapshot(): CapabilityMap<TCapability> {
    return { ...this.capabilities };
  }

  /**
   * A snapshot narrowed to the given capabilities — for surfaces that must not
   * expose the whole registry, like the public wire response.
   */
  pick<TSubset extends TCapability>(names: readonly TSubset[]): CapabilityMap<TSubset> {
    return Object.fromEntries(
      names.map((name) => [name, this.has(name)]),
    ) as CapabilityMap<TSubset>;
  }

  enabled(): TCapability[] {
    return this.names().filter((name) => this.capabilities[name]);
  }

  disabled(): TCapability[] {
    return this.names().filter((name) => !this.capabilities[name]);
  }

  /** One-line summary for the startup log, e.g. `google_oauth=on, stripe_billing=off`. */
  describe(): string {
    return this.names()
      .map((name) => `${name}=${this.capabilities[name] ? 'on' : 'off'}`)
      .join(', ');
  }

  private names(): TCapability[] {
    return Object.keys(this.capabilities) as TCapability[];
  }
}
