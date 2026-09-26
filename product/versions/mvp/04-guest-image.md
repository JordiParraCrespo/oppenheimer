# 04 — Guest image

The root image a microVM session boots from (02 §14). Decided
2026-09-22 with research note 15; this replaces the deferred libvirt
golden image.

## Decided

- **Built from a Dockerfile, shipped as a raw ext4.** Ubuntu 24.04
  base; `docker export` to a tree; `mkfs.ext4 -d` into a raw image with
  the journal on. Firecracker takes raw only. The build runs in CI, the
  image is versioned with the runner and **signed with the offline
  key** (the rootfs half of F26), and the runner verifies it before the
  first boot.
- **What is in it**: git, tmux, `chrony`, Node LTS, Claude Code, Codex,
  Docker with `dockerd` started at boot, the common toolchains (Python,
  Go, build tools, ripgrep), the fixed workspace layout under
  `/home/agent/oppenheimer-ai`, the proxy's CA in the system trust
  store and in every tool's CA variable, `HTTPS_PROXY` pointing at the
  guest agent's forwarder, git rewritten from SSH to HTTPS, and the
  guest agent as `/init`. No `sshd`, no cloud-init, no systemd: the
  agent is PID 1 and starts what a session needs, which is what keeps
  the boot near Firecracker's floor.
- **No network device** is configured for the VM, so the image carries
  no network configuration at all beyond loopback.
- **Root inside the guest**, as the reference sandbox (note 04 §5).
- **The kernel** is a separate artifact: an uncompressed `vmlinux` per
  architecture with only virtio block, vsock and ext4 built in, from
  Firecracker's supported series (6.1 or 6.18), shipped and signed with
  the runner.
- **Update is a new image**, and a session picks it up at its next
  boot on its kept disk — which is the same disk, so the update is of
  the base the disk was reflinked from, not of the disk. A session disk
  therefore carries its image version, and the runner boots it with
  the kernel that image expects; a session that wants the new image is
  a new session. Data preserved across an image change is the pushed
  branch, exactly as with Delete.
- **Things that change faster than the image** — the agent CLIs,
  skills — can ride as read-only squashfs drives, the way Claude Code
  on the web mounts skills. Not in the first build; noted so the first
  build does not preclude it.

## Open questions

1. Per-repo setup script: `.oppenheimer/setup.sh` in the repo, run in
   the guest after clone and cached on the session disk, or a field on
   the project? Claude Code on the web caches its setup script result
   for about seven days.
2. Node version management inside the guest: a fixed LTS in the image,
   or a version manager that repos can pin?
3. Image size and boot time targets: measure boot-to-prompt on the
   Hetzner box and on an EC2 m8i with nested virtualisation, and set
   the two-second bar from the first.
