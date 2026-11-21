// The build cache `expo run:ios` and `expo run:android` consult before they
// compile (`buildCacheProvider` in app.config.ts). A native build is keyed by
// the project's fingerprint (@expo/fingerprint: native dependencies, config
// plugins, app config), which is the same in every checkout whose native side
// is the same. Each session is a git worktree at a path of its own, so Xcode's
// DerivedData starts empty in each, and before this cache every new checkout
// paid for a full native build that another one had already made. Now the
// first build of a fingerprint is kept in one folder on the machine, and every
// checkout with that fingerprint installs it and only starts Metro.
//
// Kept: the newest `keep` builds per platform (default 6), oldest used first
// out. A build is copied in under a temporary name and renamed, so two
// checkouts finishing the same fingerprint at once leave one whole copy.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_KEEP = 6;

function cacheRoot() {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Caches', 'oppenheimer', 'mobile-builds');
  }
  return path.join(
    process.env.XDG_CACHE_HOME || path.join(home, '.cache'),
    'oppenheimer',
    'mobile-builds',
  );
}

// iOS builds one configuration (`--configuration`, Debug by default), Android
// one variant (`--variant`, debug by default); each is its own binary.
function entryName({ platform, fingerprintHash, runOptions }) {
  const flavor =
    platform === 'ios' ? (runOptions?.configuration ?? 'Debug') : (runOptions?.variant ?? 'debug');
  return `${platform}-${flavor}-${fingerprintHash}`;
}

function findEntry(dir, name) {
  if (!fs.existsSync(dir)) {
    return null;
  }
  const found = fs.readdirSync(dir).find((file) => path.parse(file).name === name);
  return found ? path.join(dir, found) : null;
}

function prune(dir, platform, keep) {
  const entries = fs
    .readdirSync(dir)
    .filter((file) => file.startsWith(`${platform}-`) && !file.startsWith('.'))
    .map((file) => ({ file, used: fs.statSync(path.join(dir, file)).mtimeMs }))
    .sort((a, b) => b.used - a.used);
  for (const { file } of entries.slice(keep)) {
    fs.rmSync(path.join(dir, file), { recursive: true, force: true });
  }
}

async function resolveBuildCache({ platform, fingerprintHash, runOptions }) {
  const entry = findEntry(cacheRoot(), entryName({ platform, fingerprintHash, runOptions }));
  if (!entry) {
    console.log(
      `Build cache: no ${platform} build for fingerprint ${fingerprintHash}; building it.`,
    );
    return null;
  }
  // Marks it as recently used, so pruning drops the builds no checkout asks for.
  const now = new Date();
  fs.utimesSync(entry, now, now);
  console.log(`Build cache: reusing ${entry}`);
  return entry;
}

async function uploadBuildCache({ platform, fingerprintHash, buildPath, runOptions }, options) {
  const dir = cacheRoot();
  const name = entryName({ platform, fingerprintHash, runOptions });
  if (findEntry(dir, name)) {
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, name + path.extname(buildPath));
  const partial = path.join(dir, `.${name}.${process.pid}.partial`);
  try {
    await fs.promises.cp(buildPath, partial, { recursive: true, verbatimSymlinks: true });
    fs.renameSync(partial, target);
    console.log(`Build cache: kept ${target}`);
  } catch (error) {
    // Another checkout kept the same build first, or the disk is full: the
    // app this run built is installed either way.
    fs.rmSync(partial, { recursive: true, force: true });
    if (!fs.existsSync(target)) {
      console.warn(`Build cache: could not keep the build: ${error.message}`);
    }
    return;
  }
  prune(dir, platform, options?.keep ?? DEFAULT_KEEP);
}

module.exports = { resolveBuildCache, uploadBuildCache };
