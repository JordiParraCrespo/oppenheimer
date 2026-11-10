# A session's device in the browser

Asked on 2026-10-16: when a host runs a simulator, can the console stream
it, with the agent and the device on the same host and one device per
session? This note reads the tools that do it today, sketches the shape it
would take here, and records a proof of concept run on 2026-10-17
(`poc/device-stream/` at the repository root). It decides nothing.

What was decided from it is in the notes that own it: on 2026-10-26 the
console's preview pane got its Simulator, a session's device streamed over
the link and driven through Argent (`../versions/mvp/05-screens.md`). The
open questions below are still open for that build.

## What exists

| Tool | What it is | Streams to a browser | Agent control |
|------|------------|----------------------|---------------|
| Claude Code Desktop, iOS Simulator pane (beta, July 2026) | A pane beside the conversation, macOS and local sessions only | In the desktop app only | Drives the simulator directly |
| Codex, "Build iOS Apps" plugin | Mirrors the simulator into Codex's in-app browser | Through serve-sim | Skills over the same tool |
| serve-sim (Evan Bacon) | A CLI: a Swift helper reads the simulator's framebuffer, serves MJPEG plus a WebSocket for gestures | Yes, MJPEG | Gestures as JSON |
| simfleet | iOS as MJPEG, Android as scrcpy H.264, an inspector on 127.0.0.1 with no auth, MIT | Yes | Taps, swipes, keys from the page or CLI |
| agent-device (Callstack) | CLI, MCP server and Node API that drive iOS, Android and more through XCTest and adb; device claims per git worktree; MIT | No: screenshots and recordings | Yes, through the accessibility tree |
| Argent (Software Mansion) | MCP server and skills for iOS simulators, Android emulators, devices and Chromium apps; package Apache-2.0 | Yes: its `simulator-server` serves `/stream.mjpeg` per device | Yes: every tool takes the device's `udid` |

Nothing here needs reverse engineering: the browser half of the Codex
feature is serve-sim, and Argent ships its own stream server. Argent's
`simulator-server` is a separate native binary (it looks like Radon IDE's,
and accepts a license token it does not require); its terms need reading
before we ship anything that leans on it.

## The shape it would take

- **One device per session, owned by the runner.** Creating a session with
  a device clones and boots a simulator or emulator, stores its id with the
  session, and deletes it with the session. A host caps how many it runs.
  No device is shared, so no claim protocol is needed.
- **The agent is told which device is its own.** The POC does it with a
  `CLAUDE.local.md` line naming the id (Argent's own rule picks the device
  the user names before any other) and `ANDROID_SERIAL` for plain `adb`.
  That is a convention the agent follows, not a fence, and one option among
  those in open question 4, not the design.
- **The reader sees and touches it from the console.** The runner runs
  Argent's stream server for that one device and carries frames and input
  over the link as one more attachment kind; input names the session and
  the runner fills in the device. MJPEG over the relay first, an H.264
  WebRTC track on the direct path (`versions/mvp/22`) after.
- **iOS needs a macOS host with Xcode**; Android works on Linux and macOS.

## The proof of concept

`poc/device-stream/` is a Go server standing in for the runner's device
module: sessions with a device each, the agent pin, Argent's MJPEG stream
relayed to a page, and the page's taps, swipes, keys and buttons sent to
Argent's tool-server with the session's serial. Run in a cloud container
with 4 cores and no KVM, on an Android 10 emulator in software:

- The agent, through Argent (`launch-app`, `describe`, `gesture-tap`),
  opened a demo app and tapped its button twice; the reader then tapped the
  streamed screen and typed into the app from the page. Both drove one
  device and the page showed each change.
- A tap from the page answered in 90–100 ms; typing took 9–14 s, the cost
  of a software-emulated guest. A second session asking for the same device
  was refused.
- What the device module has to handle: wait for Android's input service,
  not only `sys.boot_completed`; keep the screen on (a sleeping display
  sends no frames); start the emulator with `-feature MultiDisplay`, which
  Argent's stream server requires; keep the streamer's stdin open; and
  expect frames only when the screen changes.
- The stripped ATD image drew nothing with host-side SwiftShader; the
  standard image did. Without hardware acceleration the emulator takes 5–7
  minutes to boot and raises "isn't responding" dialogs, so a host needs
  KVM or Hypervisor.framework.

## A host's desktop

Asked on 2026-11-04: can the reader see and click the screen of the machine
the agent runs on, the way Grok Bot shows its box? Built on 2026-11-09, as
a third tab of the preview pane (Desktop) and a page per host in Settings
(Settings → Hosts → Desktop), on one viewer with Full screen.

**What others do.** Grok Bot (0.78.4, read from its Linux `.deb` on
2026-11-04) runs an X desktop on display `:1` inside its cloud box, drives
it with `xdotool`, and shows it with noVNC: the box serves websockify on
`:6080`, the app rewrites that address to its gateway's VNC proxy with a
port token, and loads noVNC into a webview of its own, whose preload hides
noVNC's chrome, drops input until **Take control**, remaps the Mac's keys,
syncs the clipboard and lowers the quality on a slow link
(`lessons-from-grok-bot.md` §11). OpenClaw (2026.10.10) shows a host's
desktop in its Control UI: a paired node splices the RFB server on its own
loopback (`127.0.0.1:5900`: macOS Screen Sharing, TigerVNC, x11vnc) to an
outbound binary WebSocket, the gateway completes the VNC or Apple Remote
Desktop sign-in and hands the browser a stream that asks for none, noVNC
draws it, and a byte filter on the gateway drops a watcher's input. On
Linux it can also start a TigerVNC and XFCE desktop of its own.

**What we built is OpenClaw's shape on our link.**

- **The host's owner shares it, on the host.** `runner desktop on` writes
  `~/.oppenheimer/desktop.json` (port, account, password file); nothing on
  the link writes it, the way `runner exec` is decided. Off, `desktop.open`
  is `DESKTOP_001`, and the console says what to run; a desktop already open
  reads the choice again every two seconds and closes once it is off.
- **The runner signs in, so no password crosses the link.** It dials the
  server on the loopback, speaks RFB 3.3, 3.7, 3.8 and Apple's 3.889, and
  completes None, VNC authentication (DES) or Apple Remote Desktop
  (Diffie-Hellman, AES-128) with the credentials it keeps. To the browser
  it plays the server: RFB 3.8, one security type, None.
- **Watching is enforced on the host.** The runner frames each message the
  browser sends and drops keys, pointer, clipboard, resize, XVP and QEMU
  key messages until `desktop.control`; the browser's ClientInit is always
  sent shared, so watching never disconnects another viewer or the agent's
  tools. noVNC's `viewOnly` follows, but it is not what holds.
- **On the link it is a port tunnel with a viewer.** `desktop.open`,
  `desktop.opened`, `desktop.control`, `desktop.close`, and RFB as binary
  frames under each direction's credit window (`desktop.stream`). The
  relay judges a host-scoped ticket (`POST /hosts/{id}/desktop-ticket`,
  `update Host`, the `host_desktop` flag, and for a token its own sensitive
  scope, `host-desktops:write`, which `hosts:write` never carries) at
  redemption and
  every minute, and carries bytes with back-pressure both ways; it reads no
  RFB.
- **The console draws it with noVNC** (1.7.0, MPL-2.0, loaded with the
  first desktop shown) over a channel of a WebSocket's shape, scaled to the
  room it has. Full screen is the browser's own, or the view pinned over the
  window where there is none (Safari on iOS).

Checked on the local stack on 2026-11-09 against TigerVNC with a VNC
password: keys typed while watching never reached an xterm on the host,
and after Take control the same keys ran a command there.

**Not built.** A desktop the runner starts itself on a headless Linux host
(OpenClaw's managed TigerVNC and XFCE), one per session; the clipboard both
ways; audio; adaptive quality; the direct path (22). A Mac shares the one
screen its agents work on, so the reader and the agent drive the same
pointer; nothing arbitrates between them yet.

## Open questions

1. Argent's `simulator-server` terms, and whether we run it or our own
   capture (scrcpy for Android, a ScreenCaptureKit or `simctl io` helper
   for iOS).
2. Whether a session asks for a device when it is created or when the agent
   first needs one, and what a device costs a host (the POC's emulator held
   3.5 GB of memory).
3. Where the stream rides: the relay is simple but carries several Mbps per
   viewer as MJPEG; the direct path wants H.264, and Argent's server serves
   only MJPEG (it decodes the H.264 an Android device sends it).
4. How far the agent is held to its device: the instruction alone, a
   session environment that can only reach its own device (an adb server
   per session, Argent's tool-server per session or behind a proxy that
   rewrites `udid`), or tools that refuse other ids.
5. The device module owns the whole lifecycle in one place: whatever a
   start created (AVD, emulator, streamer) is torn down when any later step
   fails, as well as when the session ends, and removing a session first
   cancels and waits for a start still under way. The POC does both.

Until 1, 3 and 4 are answered, nothing here (Argent's `simulator-server`,
MJPEG, the `CLAUDE.local.md` pin) is a design to build on.
