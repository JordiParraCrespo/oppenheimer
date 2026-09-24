// Package link is the runner's end of the control-plane link: one outbound
// WebSocket, its reconnect ladder and epoch, the frame layout, and the event
// batches with their idempotency keys. It is transport, not a context
// (02-runner §3): what each message *does* to a session is decided by the
// composition root that wires a Handler, never here.
package link

import (
	"encoding/json"
	"time"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// ProtocolVersion is the one version of the wire this runner speaks. It is
// `PROTOCOL_VERSION` in `packages/shared/src/protocol/version.ts`.
const ProtocolVersion = 1

// The message vocabulary, mirrored from `packages/shared/src/protocol/`. Zod is
// the source and `protocol-schema/protocol.schema.json` is the contract; these
// structs are the hand-kept Go twin, and `protocol_test.go` checks the samples
// the TypeScript tests use still parse here.

// Range is the protocol range the runner advertises in hello.
type Range struct {
	Min int `json:"min"`
	Max int `json:"max"`
}

// Window is one tmux window of a snapshot.
type Window struct {
	Index int    `json:"index"`
	Name  string `json:"name,omitempty"`
}

// SessionSnapshot is what the runner holds for one session, in hello and in
// every heartbeat.
type SessionSnapshot struct {
	SessionID      string   `json:"sessionId"`
	Agent          string   `json:"agent"`
	Observed       string   `json:"observed"`
	StateSeconds   int      `json:"stateSeconds"`
	Windows        []Window `json:"windows"`
	AgentSessionID *string  `json:"agentSessionId"`
	ReportHash     *string  `json:"reportHash"`
	LoginURL       *string  `json:"loginUrl"`
}

// Hello is the first frame after the upgrade.
type Hello struct {
	Type          string            `json:"type"`
	RunnerVersion string            `json:"runnerVersion"`
	Protocol      Range             `json:"protocol"`
	RunID         string            `json:"runId"`
	Host          hostdomain.Facts  `json:"host"`
	Sessions      []SessionSnapshot `json:"sessions"`
}

// Heartbeat is sent every 15 s.
type Heartbeat struct {
	Type     string            `json:"type"`
	SentAt   time.Time         `json:"sentAt"`
	Channel  string            `json:"channel"`
	Host     hostdomain.Facts  `json:"host"`
	Load     Load              `json:"load"`
	Sessions []SessionSnapshot `json:"sessions"`
}

// Load is the heartbeat's load figure.
type Load struct {
	LoadAverage1m float64 `json:"loadAverage1m"`
}

// Welcome is the control plane's answer to hello.
type Welcome struct {
	Type           string `json:"type"`
	Protocol       int    `json:"protocol"`
	KeyFingerprint string `json:"keyFingerprint"`
	HostID         string `json:"hostId"`
	// Epoch is the reconnect generation the control plane allocated for this
	// link: the number both peers use, so a log line on either side names the
	// same link.
	Epoch uint64 `json:"epoch"`
}

// Hint is the control plane's closed vocabulary of advice.
type Hint struct {
	Type              string `json:"type"`
	Kind              string `json:"kind"`
	RetryAfterSeconds int    `json:"retryAfterSeconds,omitempty"`
	Detail            string `json:"detail,omitempty"`
}

// Event is one entry of a session's log as the runner reports it. Payload is a
// JSON *string* so the 8 KB cap survives into Go unchanged.
type Event struct {
	IdempotencyKey string    `json:"idempotencyKey"`
	Kind           string    `json:"kind"`
	Payload        string    `json:"payload"`
	OccurredAt     time.Time `json:"occurredAt"`
}

// EventsAppend is a batch of one session's events.
type EventsAppend struct {
	Type      string  `json:"type"`
	BatchID   string  `json:"batchId"`
	SessionID string  `json:"sessionId"`
	Events    []Event `json:"events"`
}

// EventsAck acknowledges a batch by key.
type EventsAck struct {
	Type     string   `json:"type"`
	BatchID  string   `json:"batchId"`
	Accepted []string `json:"accepted"`
	Rejected []struct {
		IdempotencyKey string `json:"idempotencyKey"`
		Reason         string `json:"reason"`
	} `json:"rejected,omitempty"`
}

// LaunchOptions is the structured launch on session.create — never argv.
type LaunchOptions struct {
	Model      string `json:"model,omitempty"`
	Permission string `json:"permission"`
	Effort     string `json:"effort,omitempty"`
}

// Checkout is one repository of a session.create.
type Checkout struct {
	CheckoutID         string `json:"checkoutId"`
	GithubRepoID       int64  `json:"githubRepoId"`
	RepositoryFullName string `json:"repositoryFullName"`
	DirectoryName      string `json:"directoryName"`
	BaseBranch         string `json:"baseBranch"`
}

// SessionCreate asks the host to make the directories, the checkouts and
// window 0, then launch the agent.
type SessionCreate struct {
	Type             string        `json:"type"`
	CommandID        string        `json:"commandId"`
	SessionID        string        `json:"sessionId"`
	OrganizationSlug string        `json:"organizationSlug"`
	ProjectSlug      string        `json:"projectSlug"`
	SessionSlug      string        `json:"sessionSlug"`
	Agent            string        `json:"agent"`
	Launch           LaunchOptions `json:"launch"`
	Prompt           string        `json:"prompt,omitempty"`
	Branch           string        `json:"branch"`
	Checkouts        []Checkout    `json:"checkouts"`
	CwdCheckoutID    *string       `json:"cwdCheckoutId"`
}

// SessionAttach opens a PTY on one window for one browser connection.
type SessionAttach struct {
	Type         string `json:"type"`
	CommandID    string `json:"commandId"`
	SessionID    string `json:"sessionId"`
	Window       int    `json:"window"`
	AttachmentID uint32 `json:"attachmentId"`
	Cols         int    `json:"cols"`
	Rows         int    `json:"rows"`
}

// SessionInput is keystrokes for a window, base64.
type SessionInput struct {
	Type      string `json:"type"`
	CommandID string `json:"commandId"`
	SessionID string `json:"sessionId"`
	Window    int    `json:"window"`
	Data      string `json:"data"`
}

// SessionImage is a picture for a window's prompt, base64: the runner saves
// it and pastes its path into the window.
type SessionImage struct {
	Type      string `json:"type"`
	CommandID string `json:"commandId"`
	SessionID string `json:"sessionId"`
	Window    int    `json:"window"`
	MediaType string `json:"mediaType"`
	Data      string `json:"data"`
}

// SessionResize is a viewport change for one attachment.
type SessionResize struct {
	Type         string `json:"type"`
	CommandID    string `json:"commandId"`
	SessionID    string `json:"sessionId"`
	AttachmentID uint32 `json:"attachmentId"`
	Cols         int    `json:"cols"`
	Rows         int    `json:"rows"`
}

// SessionDetach frees an attachment.
type SessionDetach struct {
	Type         string `json:"type"`
	CommandID    string `json:"commandId"`
	SessionID    string `json:"sessionId"`
	AttachmentID uint32 `json:"attachmentId"`
}

// SessionCommand is the shape shared by stop, restart, window.open and
// window.close: a command id and a session id, plus the fields only one of
// them reads.
type SessionCommand struct {
	Type      string `json:"type"`
	CommandID string `json:"commandId"`
	SessionID string `json:"sessionId"`
	// session.window.open
	Name string `json:"name,omitempty"`
	// session.window.close
	Window int `json:"window"`
	// session.close
	AcceptUnpushedWork bool `json:"acceptUnpushedWork"`
}

// CredentialsToken asks for the installation token of one session's repository.
type CredentialsToken struct {
	Type         string `json:"type"`
	RequestID    string `json:"requestId"`
	SessionID    string `json:"sessionId"`
	CheckoutID   string `json:"checkoutId"`
	GithubRepoID int64  `json:"githubRepoId"`
}

// CredentialsGrant is the token, sealed to this host's key.
type CredentialsGrant struct {
	Type       string    `json:"type"`
	RequestID  string    `json:"requestId"`
	SessionID  string    `json:"sessionId"`
	CheckoutID string    `json:"checkoutId"`
	Sealed     string    `json:"sealed"`
	ExpiresAt  time.Time `json:"expiresAt"`
}

// CredentialsRevoke drops a token early.
type CredentialsRevoke struct {
	Type       string `json:"type"`
	RequestID  string `json:"requestId"`
	SessionID  string `json:"sessionId"`
	CheckoutID string `json:"checkoutId"`
}

// HostUpdate asks the host to move to a version on a channel.
type HostUpdate struct {
	Type      string `json:"type"`
	CommandID string `json:"commandId"`
	Version   string `json:"version"`
	Channel   string `json:"channel"`
}

// AttachmentCredit is the browser's consumed-byte credit, relayed.
type AttachmentCredit struct {
	Type         string `json:"type"`
	AttachmentID uint32 `json:"attachmentId"`
	Bytes        int    `json:"bytes"`
}

// CommandFailed says the runner could not carry a command out.
type CommandFailed struct {
	Type      string `json:"type"`
	CommandID string `json:"commandId"`
	Code      string `json:"code"`
	Detail    string `json:"detail,omitempty"`
}

// AttachmentClosed says a PTY behind an attachment ended.
type AttachmentClosed struct {
	Type         string `json:"type"`
	AttachmentID uint32 `json:"attachmentId"`
	Reason       string `json:"reason,omitempty"`
}

// Envelope is what every control frame carries at minimum: the discriminator.
type Envelope struct {
	Type string `json:"type"`
}

// Message is one decoded control frame: its type and its raw JSON, decoded a
// second time by whoever handles that type.
type Message struct {
	Type string
	Raw  json.RawMessage
}

// Decode reads a message's body into a typed struct.
func (m Message) Decode(v any) error { return json.Unmarshal(m.Raw, v) }
