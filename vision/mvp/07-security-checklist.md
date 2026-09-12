# 07 — Security checklist

Findings from `../04-security-review.md` that the MVP must satisfy,
as a checklist. The rest of that note applies when the corresponding
feature lands.

- [ ] F1 per-session single-use attach tickets
- [ ] F2 Origin check on WebSocket upgrades, CSRF on mutating HTTP
- [ ] F3 linkify only vendor login hosts
- [ ] F5 registration token: one hour, single use, revocable, source IP shown
- [ ] F6 runner pins the control plane's key fingerprint
- [ ] F7 job payloads encrypted to the runner key
- [ ] F8 runner private key 0600, rotation supported
- [ ] F13 account volumes: one per account, one VM at a time, encrypted at rest, never in images
- [ ] F15 isolation label proven by an actual jailed boot
- [ ] F16 no host mounts, credentials, or sockets in the guest (already true on the runner host)
- [ ] F17 vsock accepts only the assigned CID, guest agent authenticates with the JIT token
- [ ] F18 overlays deleted on retention deadline with confirmation
- [ ] F20 App private key in the secret store, never the database
- [ ] F21 installation tokens narrowed to one repo, one hour
- [ ] F23 no vendor credential ever stored by the platform
- [ ] F24 every object owned by the user; queries scoped
- [ ] F25 unguessable session ids plus ticket authorization

Deferred to later slices: F14 host egress proxy (tokens delivered by
seed in the MVP), F26 signed updates, Tailscale mode for the control
plane itself.
