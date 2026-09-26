import { isIP } from 'node:net';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type AsnResponse, type CityResponse, open, type Reader } from 'maxmind';
import type { IpGeolocation, IpGeolocationPort } from './ip-geolocation.port';

const UNKNOWN: IpGeolocation = {
  countryCode: null,
  region: null,
  city: null,
  asn: null,
  asnOrg: null,
};

/**
 * DB-IP Lite, read from `.mmdb` files on disk (`product/versions/mvp/13-host-metadata.md`).
 *
 * Free, CC BY 4.0, no account: every deployment can place a network without
 * registering anywhere. MaxMind GeoLite2 is the same format, so a deployment
 * that holds that licence points the same two variables at its files.
 *
 * Offline on purpose. A lookup service would send every host's address to a
 * third party on every connect, and the answer is only ever a hint.
 *
 * Each database opens on first use and stays open; a file that is missing or
 * unreadable is logged once and read as "no answer", so a bad path costs the
 * geography, never a connect.
 */
@Injectable()
export class DbipGeolocationAdapter implements IpGeolocationPort {
  private readonly logger = new Logger(DbipGeolocationAdapter.name);
  private city?: Promise<Reader<CityResponse> | null>;
  private asn?: Promise<Reader<AsnResponse> | null>;

  constructor(private readonly configService: ConfigService) {}

  async lookup(ip: string): Promise<IpGeolocation> {
    if (!isIP(ip) || isPrivate(ip)) return UNKNOWN;
    const [city, asn] = await Promise.all([this.cityReader(), this.asnReader()]);
    const place = city?.get(ip) ?? null;
    const operator = asn?.get(ip) ?? null;
    const countryCode = place?.country?.iso_code?.toUpperCase() ?? null;
    return {
      countryCode: countryCode && /^[A-Z]{2}$/.test(countryCode) ? countryCode : null,
      region: bounded(place?.subdivisions?.[0]?.names?.en, 64),
      city: bounded(place?.city?.names?.en, 64),
      asn: operator?.autonomous_system_number || null,
      asnOrg: bounded(operator?.autonomous_system_organization, 128),
    };
  }

  private cityReader(): Promise<Reader<CityResponse> | null> {
    this.city ??= this.openReader<CityResponse>(this.cityPath, 'city');
    return this.city;
  }

  private asnReader(): Promise<Reader<AsnResponse> | null> {
    this.asn ??= this.openReader<AsnResponse>(this.asnPath, 'ASN');
    return this.asn;
  }

  private async openReader<T extends CityResponse | AsnResponse>(
    path: string | undefined,
    label: string,
  ): Promise<Reader<T> | null> {
    if (!path) return null;
    try {
      return await open<T>(path);
    } catch (error) {
      this.logger.warn({
        message: `the ${label} IP database could not be opened; networks are recorded without it`,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private get cityPath(): string | undefined {
    return this.configService.get<string>('hosts.geoipCityDb') || undefined;
  }

  private get asnPath(): string | undefined {
    return this.configService.get<string>('hosts.geoipAsnDb') || undefined;
  }
}

function bounded(value: string | undefined, max: number): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Loopback, private, link-local, CGNAT and unique-local ranges: a database has
 * nothing to say about them, and a self-hosted control plane on a LAN sees
 * nothing else.
 */
export function isPrivate(ip: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return isPrivate(mapped[1]);
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a === 0
    );
  }
  const lower = ip.toLowerCase();
  return (
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe80')
  );
}
