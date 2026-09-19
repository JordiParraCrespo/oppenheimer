# @oppenheimer/go-selfupdate

The domain-agnostic half of a binary that updates itself: the signed release
manifest, the verified download, and the atomic swap of the binary on disk.
It knows nothing about *when* to update — that policy lives in the service
(`apps/runner/internal/updates`).

The trust chain is one sentence: **a release manifest is signed with an
offline Ed25519 key whose public half is compiled into the binary, and an
artifact is only written to disk after its SHA-256 matches the digest in that
manifest.** A release server can therefore choose which version a host is
offered, and can never choose what code it runs. That is finding F26 of the
security review, in code.

## What is in it

| Concern | API |
| ------- | --- |
| Manifest + signature | `ParseManifest(raw, signature, keys)` — verifies **before** decoding; `ParsePublicKeys` reads the compiled-in key block |
| Verified download | `Fetch(ctx, client, artifact, dest)` — streams, caps the size, checks the digest, deletes the file on any mismatch |
| Archive | `Unpack(archive, member, dest)` — one regular file out of a `.tar.gz`, mode 0700 |
| Versioned layout | `Layout{Dir, Name}` — `Promote`, `Activate` (atomic symlink rename), `Current`, `Versions`, `Prune`, `ClearStaging` |

```
<dir>/runner-1.2.3    one file per installed version
<dir>/current         the symlink the service unit executes
<dir>/.staging/       downloads, never executed from here
```

`Activate` renames a fresh symlink over the old one, so there is no instant
where `current` is missing, and a rollback is the same call with the previous
version. `Prune` takes the versions to keep by name rather than guessing:
only the caller knows which one it is about to need.

## Signing a release

The private key never leaves the machine that holds it, and `openssl` is the
only tool needed:

```bash
openssl genpkey -algorithm ed25519 -out release.key          # offline, once
openssl pkey -in release.key -pubout -outform DER | tail -c 32 | base64
                                                             # the compiled-in key
openssl pkeyutl -sign -inkey release.key -rawin \
  -in manifest.json -out manifest.sig && base64 -w0 manifest.sig
```

`scripts/runner/sign-release.sh` wraps exactly those commands.
