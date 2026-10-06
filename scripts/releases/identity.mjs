import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function parseReleaseTag(tag) {
  const match =
    /^(api|web|runner)-v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(-beta\.(?:0|[1-9]\d*))?)$/.exec(
      tag,
    );
  if (!match || match[0] !== tag)
    throw new Error('Expected api-v, web-v or runner-v followed by X.Y.Z[-beta.N]');
  const [, component, version, beta] = match;
  return { component, version, tag, channel: beta ? 'beta' : 'stable' };
}

export function releaseIdentity(identity, manifest) {
  const { component, version, tag } = identity;
  if (manifest.name !== `@oppenheimer/${component}` || manifest.version !== version) {
    throw new Error(`${tag} does not match ${manifest.name}@${manifest.version}`);
  }
  return identity;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { RELEASE_TAG: tag, GITHUB_REPOSITORY, GITHUB_OUTPUT } = process.env;
  const parsed = parseReleaseTag(tag);
  const { component } = parsed;
  if (!GITHUB_REPOSITORY || !/^[\w.-]+\/[\w.-]+$/.test(GITHUB_REPOSITORY)) {
    throw new Error('GITHUB_REPOSITORY must identify an owner/repository');
  }
  const manifest = JSON.parse(readFileSync(`apps/${component}/package.json`, 'utf8'));
  const identity = releaseIdentity(parsed, manifest);
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const sha = git('rev-parse', 'HEAD');
  if (git('rev-parse', `refs/tags/${tag}^{commit}`) !== sha) {
    throw new Error('Checked-out commit differs from release tag');
  }
  git('merge-base', '--is-ancestor', sha, 'origin/main');
  const repository = GITHUB_REPOSITORY.toLowerCase();
  const outputs = { ...identity, sha };
  if (component !== 'runner') outputs.image = `ghcr.io/${repository}/oppenheimer-${component}`;
  appendFileSync(
    GITHUB_OUTPUT,
    `${Object.entries(outputs)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')}\n`,
  );
}
