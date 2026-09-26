/** Where an address is, as far as an offline IP database can say. Every field may be unknown. */
export interface IpGeolocation {
  countryCode: string | null;
  region: string | null;
  city: string | null;
  asn: number | null;
  asnOrg: string | null;
}

/**
 * Places a public address: country, region, city, and the network operator
 * (ASN) that announces it. The answer is a hint for a person reading a host
 * row and the input to "did this host move country or operator", never an
 * authorization decision.
 */
export interface IpGeolocationPort {
  /** Never throws: an address it cannot place, or no database at all, is all-null. */
  lookup(ip: string): Promise<IpGeolocation>;
}
