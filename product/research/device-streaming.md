# A session's device in the browser

Asked on 2026-10-16: when a host runs a simulator, can the console stream
it, with the agent and the device on the same host and one device per
session? This note reads the tools that do it today, sketches the shape it
would take here, and records a proof of concept run on 2026-10-17
(`poc/device-stream/` at the repository root). It decides nothing.

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
   fails, as well as when the session ends. The POC does this in
   `teardown`; a session removed while it is still booting is not covered.

Until 1, 3 and 4 are answered, nothing here (Argent's `simulator-server`,
MJPEG, the `CLAUDE.local.md` pin) is a design to build on.
