#!/usr/bin/env node
/**
 * Zips the built extension (`dist/`) into the package the Chrome Web Store
 * takes, with `manifest.json` at the archive's root:
 *
 *   node scripts/package.mjs     # → release/oppenheimer-extension-<version>.zip
 *
 * Run `pnpm build` first. Written with Node's own zlib so a CI machine needs
 * no `zip` binary. Entries are sorted and dated 1980-01-01, so the same
 * `dist/` always gives the same bytes.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';

/** The files under `root`, as archive paths (forward slashes), sorted. */
export function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else out.push(relative(root, path).split(sep).join('/'));
    }
  };
  walk(root);
  return out.sort();
}

/** A zip archive of `entries` (`{ name, data }`), each deflated. */
export function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  // 1980-01-01 00:00 in DOS time and date.
  const time = 0;
  const date = (0 << 9) | (1 << 5) | 1;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const body = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function main() {
  const dist = join(APP, 'dist');
  const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));
  const { version } = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8'));
  if (manifest.version !== version) {
    throw new Error(`dist/ is version ${manifest.version}, package.json ${version}: build again`);
  }
  const entries = listFiles(dist).map((name) => ({ name, data: readFileSync(join(dist, name)) }));
  const out = join(APP, 'release', `oppenheimer-extension-${version}.zip`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, zip(entries));
  console.log(out);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
