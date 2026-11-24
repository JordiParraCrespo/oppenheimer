---
"@oppenheimer/runner": minor
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/frontend-web": minor
---

A watched desktop shows the host's pointer. Apple's Screen Sharing never says where its pointer is, so on a Mac the runner reads it with CoreGraphics and sends `desktop.pointer` while the reader watches (about thirty a second, only when it moves); the relay forwards it as a `pointer` frame, and the console's Desktop viewer draws the host's own cursor shape there, scaled with the screen. Nothing is drawn while the reader is in control.
