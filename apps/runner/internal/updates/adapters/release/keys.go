package release

// PublicKeys is the release signing key block, compiled into the binary: one
// base64 Ed25519 public key per line, `#` comments allowed. A release build
// sets it with
//
//	-ldflags "-X github.com/.../internal/updates/adapters/release.PublicKeys=<base64>"
//
// and ships the current key plus the next one during a key roll, so rotating
// the offline key never strands a host on an old version.
//
// A build with no key — every development build, and the repository as it
// stands — cannot self-update at all: `Fetch` reports UPD_008 instead of
// trusting a manifest it has no way to check. That default is deliberate.
// The alternative to "no key" is not "unsigned updates", it is "no updates".
var PublicKeys = ""
