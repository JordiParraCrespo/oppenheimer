# 02 — Runner

## Decided

- One Go binary, second command in the existing runner module, reusing
  its libvirt lifecycle, overlay and seed creation, console capture,
  capacity gate, GitHub App client, and reconcile-on-start (note 08).
- Sessions are tmux-backed PTYs. Ring buffer per session, tail replay on
  attach, reconnect ladder with an epoch counter.
- Screen manifests classify each pane as working, blocked, done, idle,
  or unknown (note 03 §1). Codex manifest first.
- Guest agent baked into the image, talking to the host over vsock:
  PTY bytes, resize, state, token rotation.
- Sleep tiers: `virsh suspend` at 10 idle minutes, `managedsave` at 2
  hours, destroy-keep-disks at 24 hours. Wake from any tier on attach.
- Account volumes: one qcow2 per account, attached to one VM at a time
  under a host lock.
- Sessions cap by measured load with 2:1 CPU overcommit; the CI
  controller's own cap is untouched.
- Runtimes in the MVP: Shared workspace VM per repo, Clean VM per
  session.

## Open questions

1. Where does tmux live for a Shared workspace: one tmux server per VM
   with one session per worktree, or one server per worktree?
2. Screen manifests: regexes over the last N lines, or a small state
   machine fed by Codex's own hooks where available? Codex supports
   lifecycle hooks with trusted hashes (note 06), which is more reliable
   than screen scraping.
3. Idle detection input: terminal I/O silence, agent state from the
   manifest, or both? A long Codex run with no keystrokes is not idle.
4. Balloon and free-page reporting in the guest: on from day one, or
   measured first?
5. Host move procedure: which files constitute a session (overlay,
   memory image, account volumes, metadata) and how they are copied.
6. Package map against the real runner repository: pending its name.
