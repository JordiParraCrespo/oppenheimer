#!/usr/bin/env node
// Download DB-IP Lite's City and ASN databases (.mmdb) for the API's
// HOSTS_GEOIP_CITY_DB and HOSTS_GEOIP_ASN_DB.
//
//   node scripts/geoip/fetch-dbip.mjs [--out <dir>]    (default: .data/geoip)
//
// DB-IP Lite is free under CC BY 4.0 and needs no account
// (product/versions/mvp/13-host-metadata.md). It is published monthly; this
// takes the current month and falls back to the previous one, since a new
// month's files appear a day or two in. The licence asks for "IP geolocation
// by DB-IP" wherever a location from it is shown.
//
// It writes to a temporary file and renames it over the old one, so an API
// reading the database while this runs never sees half a file. Run it monthly
// (cron, or a CI job that bakes the files into an image).
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const out = resolve(outAt >= 0 ? args[outAt + 1] : '.data/geoip');

function months() {
  const now = new Date();
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const stamp = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return [stamp(now), stamp(previous)];
}

async function fetchDatabase(kind) {
  const target = join(out, `dbip-${kind}-lite.mmdb`);
  for (const month of months()) {
    const url = `https://download.db-ip.com/free/dbip-${kind}-lite-${month}.mmdb.gz`;
    const response = await fetch(url);
    if (!response.ok || !response.body) continue;
    const partial = `${target}.partial`;
    try {
      await pipeline(Readable.fromWeb(response.body), createGunzip(), createWriteStream(partial));
      await rename(partial, target);
    } catch (error) {
      await rm(partial, { force: true });
      throw error;
    }
    console.log(`${kind}: ${month} → ${target}`);
    return target;
  }
  throw new Error(`no DB-IP ${kind} Lite database for ${months().join(' or ')}`);
}

await mkdir(out, { recursive: true });
const [city, asn] = [await fetchDatabase('city'), await fetchDatabase('asn')];
console.log(`\nHOSTS_GEOIP_CITY_DB=${city}\nHOSTS_GEOIP_ASN_DB=${asn}`);
