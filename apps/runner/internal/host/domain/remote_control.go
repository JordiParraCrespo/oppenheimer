package domain

// RemoteControlPolicy is whether Claude Code sessions on this host are also
// reachable from the Claude app and claude.ai/code through Claude Code's
// Remote Control, under the claude.ai account the host's `claude` is signed
// in as. It is the host's own setting, in a file `runner remote-control`
// writes; off by default.
type RemoteControlPolicy struct {
	Enabled bool `json:"enabled"`
}
