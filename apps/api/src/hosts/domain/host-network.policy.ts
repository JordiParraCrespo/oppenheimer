import type { HostNetwork } from './host-metadata.types';

/**
 * Whether a host moving from one network to another is worth an email to its
 * owner (decided 2026-09-26, `product/versions/mvp/13-host-metadata.md`).
 *
 * Only a change of **country** or of **network operator** (ASN) is. A laptop
 * moving between cafés on the same ISP, or a server its provider renumbers,
 * goes on the timeline and mails nobody; a machine that turns up in another
 * country, or on another operator's addresses, is what a stolen key looks
 * like. Both sides must be known to differ: without an IP database nothing is,
 * and no email is ever sent on a guess.
 */
export function networkMoveIsNotable(from: HostNetwork, to: HostNetwork): boolean {
  const countryMoved =
    from.countryCode !== null && to.countryCode !== null && from.countryCode !== to.countryCode;
  const operatorMoved = from.asn !== null && to.asn !== null && from.asn !== to.asn;
  return countryMoved || operatorMoved;
}
