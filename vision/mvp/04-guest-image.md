# 04 — Guest image

## Decided

- Built by the existing golden-image script from a verified Ubuntu
  cloud image, new revision for sessions (note 08).
- Adds: tmux, the Codex CLI, the guest agent, chrony, a git credential
  helper fed by the seed and rotated over vsock, the fixed workspace
  layout, Docker running at boot, common toolchains (Node, Python, Go,
  build tools, ripgrep).
- Update is recreate with data preserved: new image, same overlay
  worktrees and account volumes (note 12).
- Root inside the guest, as in the reference sandbox (note 04 §5).

## Open questions

1. Per-repo setup script: run once per workspace VM at first boot and
   cached, or per worktree? Where does it live, `.oppenheimer/setup.sh`
   in the repo or a field on the project?
2. Node version management inside the guest: a fixed LTS in the image,
   or a version manager that repos can pin?
3. Image size and boot time targets on the SATA host: measure the
   current runner image's boot-to-ready and set the bar from that.
4. Where the guest agent's JIT identity is injected: kernel cmdline,
   cloud-init user data, or a MMDS-style metadata read?
