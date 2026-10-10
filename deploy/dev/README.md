# The dev deployment (Hetzner)

One Hetzner Cloud server runs the console, the API, Postgres and Redis.
GitHub builds every image. The server never builds anything: it pulls the
images for a commit, pins them by digest and runs them.

```
push to main ──► Deploy dev workflow
                  ├─ build api, web, backup images → ghcr.io/<repo>/oppenheimer-*:<sha>
                  └─ join the tailnet (tag:ci) ─ssh─► deploy gate on the server
                                                        └─ oppctl deploy <sha>
                                                             pull + pin by digest
                                                             encrypted dump of the database
                                                             compose up → health → or roll back

internet ─► Cloudflare ─► cloudflared (outbound tunnel) ─► web (nginx) ─► api ─► postgres, redis
admin    ─► Tailscale ─► ssh (tailscale0 only)
```

No inbound port is open: the Hetzner Cloud Firewall has no inbound rules, ufw
allows SSH only on `tailscale0`, and no container publishes a port. The
skills in
[`indie-hacker-agents-claude-skills`](https://github.com/JordiParraCrespo/indie-hacker-agents-claude-skills)
explain why each piece is there: `vps-provision` for the host, `deploy-api`
for the pipeline and `db-backup-verify` for the backups. This directory
applies them to Oppenheimer.

| File | What it is |
|---|---|
| `compose.yml` | The stack. Upstream images are pinned by digest. The app images come from `release.env` |
| `bin/oppctl` | Everything you do on the server: setup, doctor, deploy, rollback, backup, restore, status. Installed once, outside every release |
| `bin/deploy-gate` | The forced command on CI's SSH key. It accepts `deploy <sha>` and a bundle on stdin, nothing else |
| `cloudflared.yml.tmpl` | Tunnel ingress. It is in this repo, not in the Cloudflare dashboard |
| `backup/` | The dump sidecar image, `dump.sh` and `upload.sh` (started from the skill, maintained here), and the restore-drill assertions |
| `systemd/` | `oppenheimer-backup@.service` and the three timers that run it, plus a unit that alerts when one fails |
| `cloud-init.yaml` | First-boot setup: users, Docker, Tailscale, ufw, security updates |
| `config/*.example` | The server's settings. `oppctl setup` writes the real files to `/srv/oppenheimer/config` |

## What it costs and what you need

- A Hetzner Cloud server: **x86** (CX or CPX), 4 GB of RAM or more, Ubuntu LTS.
  The images are built for `linux/amd64`, so the Arm CAX line will not run
  them. Turn on Hetzner's server backups (+20%). They take a daily image of
  the whole disk, which covers what the database dumps do not: the uploads
  volume and `/srv/oppenheimer/config`.
- A domain whose DNS zone is on Cloudflare. That account hosts the tunnel.
- A Tailscale tailnet.
- Cloudflare R2 (daily dumps, 30-day bucket lock) and Backblaze B2 (weekly
  copy, 90-day Object Lock), on separate accounts.
- [age](https://age-encryption.org) on your own machine.

## One-time setup

### 1. Tailscale

Add tags to the tailnet policy. CI may reach the server's SSH port and
nothing else:

```jsonc
"tagOwners": {
  "tag:oppenheimer-dev": ["autogroup:admin"],
  "tag:ci":              ["autogroup:admin"]
},
"grants": [
  { "src": ["autogroup:admin"], "dst": ["tag:oppenheimer-dev"], "ip": ["tcp:22"] },
  { "src": ["tag:ci"],          "dst": ["tag:oppenheimer-dev"], "ip": ["tcp:22"] }
]
```

- Create an auth key: tagged `tag:oppenheimer-dev`, pre-approved, single use.
  It goes into `cloud-init.yaml`.
- Create an OAuth client with the `auth_keys` scope and tag `tag:ci`. It goes
  into GitHub (step 6).

### 2. Create the server

Fill in your SSH public key and the Tailscale auth key in a copy of
`cloud-init.yaml`. Keep that copy out of git. Then:

```bash
hcloud firewall create --name oppenheimer-dev      # no rules = all inbound denied
hcloud server create --name oppenheimer-dev --type cx22 --image ubuntu-24.04 \
  --location fsn1 --ssh-key <your key> --firewall oppenheimer-dev \
  --user-data-from-file cloud-init.filled.yaml
hcloud server enable-backup oppenheimer-dev
```

Use any x86 type with at least 4 GB of RAM (`hcloud server-type list`). If
Tailscale does not come up, the way back in is the Hetzner Console: open the
server, then Console, and reset the root password there.

Once `ssh admin@oppenheimer-dev` works over the tailnet, do two things in the
Tailscale admin console: disable key expiry for the node, and copy its host
key for GitHub:

```bash
ssh-keyscan -t ed25519 oppenheimer-dev    # run from a tailnet machine → DEV_SSH_KNOWN_HOSTS
```

The firewall had no inbound rules from the start, so there is no public SSH
to remove. Check that the internet agrees: `nmap -Pn -p 22,80,443,5432 <public
IP>` should show every port filtered.

### 3. Install the deployment

Make the key CI deploys with, then run setup from a checkout:

```bash
ssh-keygen -t ed25519 -N '' -C deploy-dev-ci -f deploy_dev_ci   # private half → DEV_DEPLOY_SSH_KEY
scp -r deploy/dev admin@oppenheimer-dev:/tmp/oppenheimer-deploy
ssh admin@oppenheimer-dev sudo /tmp/oppenheimer-deploy/bin/oppctl setup --ci-key "'$(cat deploy_dev_ci.pub)'"
```

Setup does the following:

- creates `/srv/oppenheimer/{releases,config}`
- generates the database passwords and `config/api.env`, with a fresh Better
  Auth secret, control-plane signing key and GitHub token key
- installs `oppctl` and the deploy gate, root-owned, in
  `/usr/local/libexec/oppenheimer`, with `/usr/local/bin/oppctl` pointing
  there
- authorizes the CI key, restricted to the gate
- enables the backup timers

Running it again is safe: it never overwrites a secret that already exists.
It is also how a change to `oppctl` or the gate reaches the server: a deploy
ships the release's compose file and scripts but runs the installed `oppctl`,
and warns when the commit carries a different one. Re-run setup from that
commit.

### 4. Cloudflare Tunnel

From your own machine:

```bash
cloudflared tunnel login
cloudflared tunnel create oppenheimer-dev           # prints the tunnel ID, writes <id>.json
cloudflared tunnel route dns oppenheimer-dev dev.example.com
scp ~/.cloudflared/<id>.json admin@oppenheimer-dev:/tmp/tunnel.json
ssh admin@oppenheimer-dev 'sudo install -o deploy -g deploy -m 0644 /tmp/tunnel.json /srv/oppenheimer/config/tunnel-credentials.json && rm /tmp/tunnel.json'
```

The file is 0644 so cloudflared's non-root user can read it. The 0700
`config/` directory keeps other host users out.

The console must stay reachable without Cloudflare Access. Hosts' runners
dial `/api` over WebSocket, and GitHub posts webhooks there. If you add an
Access policy, add bypass rules for `/api/*`.

### 5. Backups

Follow the `db-backup-verify` skill (`references/storage-setup.md` and
`references/key-management.md`):

- Generate the age key pair on your machine. Store the private key offline,
  in two places. Only the public key (`age1…`) goes on the server.
- Create the R2 bucket with a 30-day bucket lock. Make an **Object Read &
  Write** token scoped to that bucket. An Admin token can remove the lock.
- Create the B2 bucket with a 90-day Object Lock and a key for that bucket.
- Write `/srv/oppenheimer/config/rclone.conf` with two remotes, `[r2]` and
  `[b2]`, and make it 0644. If the R2 bucket is in the EU jurisdiction, the
  endpoint is `https://<accountid>.eu.r2.cloudflarestorage.com`.
- Check the lock and the token tier from your machine:
  `.claude/skills/db-backup-verify/scripts/check-immutability.sh all`.

Then fill in `/srv/oppenheimer/config/host.env`:

- `DEV_HOSTNAME`, `TUNNEL_ID`, `IMAGE_REPO`
- `AGE_RECIPIENT`, `R2_BUCKET`, `B2_BUCKET`. A deploy refuses to run
  without the first two and an `[r2]` remote: every deploy after the first
  starts with a dump off the server.
- `NTFY_URL`: a secret ntfy topic. Failed backups and failed deploys post there.

Put the same hostname into `FRONTEND_URL` and `BETTER_AUTH_URL` in `api.env`.
Then check the server:

```bash
ssh admin@oppenheimer-dev sudo -u deploy oppctl doctor
```

### 6. GitHub

In the repository settings, create an environment named **`dev`**. Under
deployment branches, allow `main` only. Then add:

| Kind | Name | Value |
|---|---|---|
| env secret | `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET` | The Tailscale OAuth client (tag `tag:ci`) |
| env secret | `DEV_DEPLOY_SSH_KEY` | The private half of `deploy_dev_ci` |
| env secret | `DEV_SSH_KNOWN_HOSTS` | The `ssh-keyscan` line from step 2 |
| variable | `DEV_SSH_HOST` | `oppenheimer-dev` (the MagicDNS name) |
| variable | `DEV_URL` | `https://dev.example.com` |
| repo variable | `DEV_DEPLOY_ENABLED` | `true` turns the workflow on |

Run **Deploy dev** from the Actions tab (workflow_dispatch). After that,
every push to `main` deploys.

The first account you register is an ordinary user. To make it an admin, put
its id in `BETTER_AUTH_ADMIN_USER_IDS` in `api.env`, then run
`sudo -u deploy oppctl reload` (see [Changing the
configuration](#changing-the-configuration)).

## Runner releases

Hosts install and update the runner from this server: the `releases` container
serves `/srv/oppenheimer/public` read-only, and the tunnel sends
`/releases/…` and `/install.sh` there instead of to the console. Until a
release is in place the API answers every pairing with HOSTS_004 ("Hosts
are not configured").

A release is built and signed on your machine. The Ed25519 key that signs it
never comes to the server, and a manifest without its signature installs
nowhere.

```bash
# once: the offline release key; its public half goes into every binary
scripts/runner/sign-release.sh --keygen ~/secure/runner-release.key

RELEASE_PUBLIC_KEYS=<public key> RELEASE_BASE_URL=https://dev.example.com/releases \
  scripts/runner/release.sh 0.1.0 stable          # prints RUNNER_INSTALL_SHA256
scripts/runner/sign-release.sh dist/runner/stable.json ~/secure/runner-release.key

scp dist/runner/install.sh admin@oppenheimer-dev:/tmp/
scp dist/runner/*.tar.gz dist/runner/SHA256SUMS dist/runner/stable.json* admin@oppenheimer-dev:/tmp/releases/
ssh admin@oppenheimer-dev 'sudo -u deploy cp /tmp/install.sh /srv/oppenheimer/public/ &&
  sudo -u deploy cp /tmp/releases/* /srv/oppenheimer/public/releases/'
```

Then, in `api.env`, set `RUNNER_RELEASE_BASE_URL=https://dev.example.com/releases`,
`RUNNER_INSTALL_URL=https://dev.example.com/install.sh` and the printed
`RUNNER_INSTALL_SHA256`, and run `sudo -u deploy oppctl reload`. Keep `RELEASE_PUBLIC_KEYS` the same
from release to release: a runner only accepts updates signed by a key it was
built with.

## Day to day

From a tailnet machine: `ssh admin@oppenheimer-dev`, then `sudo -u deploy oppctl …`.

| | |
|---|---|
| `oppctl status` | Release, previous release, an interrupted deploy if there was one, containers, newest local dumps, disk |
| `oppctl logs api` | Compose logs, `--tail 200`. Add `-f` to follow |
| `oppctl psql` | psql as the app's role |
| `oppctl rollback` | Run the previous release's images and config again |
| `oppctl reload` | Recreate api, web and cloudflared from the current release so a change to `config/` takes effect |
| `oppctl backup daily` | Dump and upload outside the schedule |
| `oppctl doctor` | Checks config, keys, remotes, timers and Docker, and says when a reboot is due |

`oppctl` runs docker compose from `/`, so `sudo -u deploy oppctl …` works
from a home directory `deploy` cannot read.

### Changing the configuration

A change to `/srv/oppenheimer/config/api.env` reaches the API only when its
container is created again: `env_file` is read when a container is created,
and `docker restart` keeps the environment it was created with. Run

```bash
sudo -u deploy oppctl reload
```

Under the deploy lock, it recreates from the current release, in order and
each only once the one before is healthy: `api`; then `web`, whose nginx
resolves `api` once, when it starts; then `cloudflared`, whose origins are
`web` and `api`. Postgres and Redis are not touched. It ends with the checks
a deploy ends with.

`api.env` is not part of a release, so `oppctl rollback` does not bring the
previous one back. A reload that ends healthy keeps a copy as
`config/api.env.last-good`; one that does not stops before the next service
and points at that copy.

The tunnel's `cloudflared.yml` is rendered from `host.env` at deploy time, so
a change to `DEV_HOSTNAME` or `TUNNEL_ID` needs a deploy, not a reload.

### How a deploy works

1. The workflow builds `api`, `web` and `backup` for the commit and pushes
   them to GHCR, tagged with the sha.
2. It joins the tailnet as an ephemeral `tag:ci` node, running `tailscaled`
   in userspace as the job's own user (the runners have no passwordless sudo),
   and reaches the server's SSH through `tailscale nc`. It pipes this
   directory, plus the job's own `GITHUB_TOKEN`, to the deploy gate.
3. `oppctl deploy` on the server does the following:
   - pulls the three images with that token, then throws the token away
   - writes `release.env` with each image pinned by digest
   - renders the tunnel config and checks the compose invariants: no
     published ports, every image pinned by digest, `data` internal, Postgres
     and Redis only on `data`
   - takes an encrypted dump and uploads it, or stops (not on the first deploy,
     which has no database yet)
   - starts the new release and waits for each healthcheck: the API, nginx,
     a `GET /api/v1/ready` through nginx to the database and Redis, and
     cloudflared's `/ready`, which passes only once the tunnel is connected
     to Cloudflare
4. If anything fails, it starts the previous release again (on a first
   deploy, it stops the new one), sends a notification, and the workflow goes
   red. A failed check, an error and a signal all take that same path. When
   the deploy passes, `current` points at the new release, and releases
   beyond the last five are pruned along with their images.
5. Back in the workflow, the job checks `$DEV_URL/api/v1/ready` through
   Cloudflare. A missing `DEV_URL` fails the job.

A deploy outlives its SSH connection: if CI's session drops, the deploy
finishes or rolls back on the server anyway, and its output is in
`/srv/oppenheimer/deploy.log`. Only a deploy killed outright (a reboot, `kill
-9`) can leave containers that `current` does not name. It leaves
`/srv/oppenheimer/inflight` behind, and `oppctl status` and `doctor` say so;
deploy again or run `oppctl rollback`.

**Migrations run when the API boots, and only forward.** A rollback brings
back the old images, not the old schema. If the old API refuses the new
schema, restore the pre-deploy dump (below). Prefer expand-then-contract
migrations, and see `deploy-api`'s `references/migrations.md`.

## Backups

| When (UTC) | What |
|---|---|
| Before every deploy and every restore | Dump, then upload to R2 |
| Daily 03:17 | `oppctl backup daily`: dump, then upload to R2, then a freshness check |
| Sunday 04:47 | `oppctl backup weekly`: copies the newest dump to B2 |
| 09:07 and 21:07 | `oppctl backup check`: alerts if the newest dump in R2 is more than 26 h old |
| Monthly, from your machine | The restore drill |

Two containers handle a dump:

- **`backup-dump`** sits on the internal network, reads the database as
  `backup_user` (`pg_read_all_data` only) and encrypts the dump to your age
  public key.
- **`backup-upload`** has internet access, never touches the database, and
  only ever handles ciphertext.

A failed timer calls `oppenheimer-notify@`, which posts to `NTFY_URL`.

The dumps do not cover the uploads volume. Either rely on Hetzner's server
backups for it, or set `STORAGE_PROVIDER=s3` in `api.env` so uploads live in
R2 or Hetzner Object Storage.

### The restore drill (monthly, and after any change here)

Run it from a checkout of the skills repo, on a machine with Docker, rclone
(configured with the same `r2` remote, read-only is enough), age and the
Postgres 16 client tools:

```bash
AGE_IDENTITY=~/secure/oppenheimer-dev.age.key R2_BUCKET=<bucket> \
  ASSERTIONS=/path/to/oppenheimer/deploy/dev/backup/assertions.sql \
  .claude/skills/db-backup-verify/scripts/restore-drill.sh run
# once at setup, and after changing the pipeline: the drill must reject a corrupted dump
.claude/skills/db-backup-verify/scripts/restore-drill.sh negative
```

`assertions.sql` checks four things in the restored copy: the migrations
table, the core tables, at least one account, and no orphaned memberships.

### Restore

The private key never goes to the server. Decrypt on your machine and stream
the plaintext over the tailnet:

```bash
rclone copy r2:<bucket>/postgres/oppenheimer-<stamp>.pgc.age .
age -d -i ~/secure/oppenheimer-dev.age.key oppenheimer-<stamp>.pgc.age \
  | ssh admin@oppenheimer-dev sudo -u deploy OPP_CONFIRM=restore-oppenheimer-dev oppctl restore
```

`oppctl restore` runs these steps in order:

1. takes a safety dump of the current database
2. checks that stdin is a `pg_dump -Fc` archive
3. stops cloudflared, web and the API
4. recreates the database and restores into it
5. starts everything again and runs the health checks

## Known trade-offs (dev, on purpose)

- **The API's secrets are environment variables.** They come from `api.env`
  (0600) because the API has no `*_FILE` convention, so `docker inspect` on
  the server shows them. The database passwords use compose secrets.
- **The API connects as the database owner.** The role Postgres creates is
  the one migrations need. The backup role is separate.
- **One server.** No staging in front of it: this *is* the rehearsal
  environment. A production server is the same directory with a second
  `config/` and its own environment in GitHub.
- **The deploy gate does not limit what a deploy can change.** The installed
  `oppctl` runs the deploy, but the release's compose file decides what runs,
  as `deploy`, which is in the docker group. Four things guard the server:
  the workflow runs on `main` only, the `dev` environment's branch rule, the
  tailnet ACL, and the key's `restrict`.
