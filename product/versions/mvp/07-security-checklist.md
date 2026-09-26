# 07 — Security checklist

Findings from `../../04-security-review.md` that the MVP must satisfy,
as a checklist. The rest of that note applies when the corresponding
feature lands.

- [ ] F1 per-session single-use attach tickets
- [ ] F2 Origin check on WebSocket upgrades, CSRF on mutating HTTP
- [ ] F3 linkify only vendor login hosts
- [ ] F5 registration token: one hour, single use, revocable, source IP shown
- [ ] F6 runner pins the control plane's key fingerprint
- [ ] F7 job payloads encrypted to the runner key
- [ ] F8 runner private key 0600; rotation arrives with the link (09 §3) —
      until then a stolen key is answered by unpairing, and an unpaired host
      can neither hold a link nor be granted credentials (01)
- [ ] F10 direct-mode hosts are labelled "full access", never "sandbox"; the runner never runs as root; secrets and tokens are env or socket-scoped to the session's shell, nothing written to disk by the runner
- [ ] F11 a worktree is never presented as a boundary
- [ ] F12 scrollback not persisted on the host by default; if enabled, 0600 and scrubbed. The one file the runner does write from a reader's screen is a pasted image, named in 02 §11
- [ ] F20 App private key in the secret store, never the database
- [ ] F21 installation tokens narrowed to one repo, one hour
- [ ] F23 no vendor credential ever stored by the platform
- [ ] F24 every object owned by the user; queries scoped
- [ ] F25 unguessable session ids plus ticket authorization
- [ ] F26 runner releases signed with an offline key, verified against a
      public key compiled into the binary, before a staged binary is ever
      executed; the control plane offers versions and never supplies code
      (09 §5). Note 04's F26 covers rootfs images too; that half stays
      deferred with the VM slice, and this row is the runner half of the
      same finding
- [ ] F26a first install is trust-on-first-use — a script fetched over
      HTTPS only, checked against the digest the Add host screen shows.
      Where it can, the script checks the release signature, but against
      keys it carries itself, so F26 still begins at the first self-update,
      not at install. The mitigation is the digest on screen, the token's
      one-hour single use, and keeping the script host separate from the
      control plane (03)

Deferred to later slices, with the VMs: F13 account volumes, F14 host
egress proxy, F15 and F16 isolation proofs, F17 vsock auth, F18 overlay
retention. Also deferred: Tailscale mode for the control plane itself.
F26 was deferred and is now in the list above: self-update landed in the
MVP with 09, and an unsigned update path would be the widest hole
in it.
