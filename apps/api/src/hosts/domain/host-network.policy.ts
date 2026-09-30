import type { HostNetwork } from './host-metadata.types';

/**
 * Whether a host's network move is worth an email to its owner (decided 2026-09-26,
 * `product/versions/mvp/15-host-metadata.md`): only a change of **country** or
 * **network operator** (ASN). Cafés on one ISP or a provider renumbering go on the
 * timeline and mail nobody; another country or operator is what a stolen key looks
 * like. Both sides must be known to differ, so without an IP database no email is
 * ever sent on a guess.
 */
export function networkMoveIsNotable(from: HostNetwork, to: HostNetwork): boolean {
  const countryMoved =
    from.countryCode !== null && to.countryCode !== null && from.countryCode !== to.countryCode;
  const operatorMoved = from.asn !== null && to.asn !== null && from.asn !== to.asn;
  return countryMoved || operatorMoved;
}
