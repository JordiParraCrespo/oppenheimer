package transcript

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
)

// StatusEntryType names the chat entry the runner adds beside a Claude Code
// conversation's own: the figures the CLI hands its status line — how full
// the context is, and how much of the plan's 5-hour and weekly limits the
// account has used. The transcript has neither, and these are the CLI's own
// numbers, read from it on this host: no credential is read and nothing is
// asked of Anthropic.
const StatusEntryType = "oppenheimer.status"

// statusPayloadMax bounds what is read of one status line payload; the CLI's
// is a few kilobytes.
const statusPayloadMax = 256 << 10

// statusEntryMax bounds a saved entry, which keeps a handful of numbers.
const statusEntryMax = 4 << 10

// Status is what the runner keeps of one status line payload, in the CLI's
// own names so the console reads one shape.
type Status struct {
	Type          string         `json:"type"`
	ContextWindow *StatusContext `json:"context_window,omitempty"`
	RateLimits    *StatusLimits  `json:"rate_limits,omitempty"`
}

// StatusContext is how full the context window is: its size and the share
// of it the last answer's input took.
type StatusContext struct {
	UsedPercentage    *float64 `json:"used_percentage,omitempty"`
	ContextWindowSize int64    `json:"context_window_size,omitempty"`
}

// StatusLimits are the plan's usage windows. Each is absent when the CLI
// does not send it: an API-key account has none, and a window is dropped
// once it resets.
type StatusLimits struct {
	FiveHour *StatusWindow `json:"five_hour,omitempty"`
	SevenDay *StatusWindow `json:"seven_day,omitempty"`
}

// StatusWindow is one usage window: the share used, 0–100, and when it
// resets, in Unix seconds.
type StatusWindow struct {
	UsedPercentage float64 `json:"used_percentage"`
	ResetsAt       int64   `json:"resets_at,omitempty"`
}

// claudeStatusLine is the part of Claude Code's status line payload read here.
type claudeStatusLine struct {
	SessionID     string         `json:"session_id"`
	ContextWindow *StatusContext `json:"context_window"`
	RateLimits    *StatusLimits  `json:"rate_limits"`
}

// ErrNoStatus is a payload with no conversation to file it under.
var ErrNoStatus = errors.New("status line payload names no conversation")

// SaveStatus keeps what the chat shows of one status line payload in dir,
// under the conversation it names, written whole (a temp file, renamed) so
// the follower never reads half of one. It returns what it kept.
//
// session is the Oppenheimer session whose window-0 agent drew the line
// (`runner statusline --session`), or "" for any other Claude Code. For
// one, the conversation the payload names is also kept as that session's
// (ReportedConversation): Claude Code moves to a conversation of a new name
// on `/clear`, on `/resume` and on a resume that forks, and says so only here.
func SaveStatus(dir string, payload []byte, session string) (Status, error) {
	if len(payload) > statusPayloadMax {
		return Status{}, fmt.Errorf("status line payload of %d bytes", len(payload))
	}
	var in claudeStatusLine
	if err := json.Unmarshal(payload, &in); err != nil {
		return Status{}, fmt.Errorf("read the status line payload: %w", err)
	}
	if !conversationPattern.MatchString(in.SessionID) {
		return Status{}, ErrNoStatus
	}
	status := Status{Type: StatusEntryType, ContextWindow: in.ContextWindow, RateLimits: cleanLimits(in.RateLimits)}
	if c := status.ContextWindow; c != nil && c.UsedPercentage == nil && c.ContextWindowSize == 0 {
		status.ContextWindow = nil
	}
	encoded, err := json.Marshal(status)
	if err != nil {
		return Status{}, err
	}
	if err := writeWhole(dir, statusPath(dir, in.SessionID), encoded); err != nil {
		return Status{}, err
	}
	if conversationPattern.MatchString(session) && ReportedConversation(dir, session) != in.SessionID {
		if err := writeWhole(filepath.Join(dir, reportedDir), reportedPath(dir, session), []byte(in.SessionID)); err != nil {
			return Status{}, err
		}
	}
	return status, nil
}

// reportedDir is the folder under the status folder that keeps, for each
// session, the conversation its agent last reported being in.
const reportedDir = "sessions"

// ReportedConversation is the conversation the session's window-0 Claude
// Code last said it is in (SaveStatus), or "" while it has said none.
func ReportedConversation(dir, session string) string {
	if dir == "" || !conversationPattern.MatchString(session) {
		return ""
	}
	raw, err := os.ReadFile(reportedPath(dir, session)) //nolint:gosec // the runner's own state, under a checked session id
	if err != nil || !conversationPattern.Match(raw) {
		return ""
	}
	return string(raw)
}

func reportedPath(dir, session string) string {
	return filepath.Join(dir, reportedDir, session)
}

// writeWhole writes data at path, in folder, through a temp file renamed
// over it, so a reader never sees half of it.
func writeWhole(folder, path string, data []byte) error {
	if err := os.MkdirAll(folder, 0o700); err != nil {
		return err
	}
	temp, err := os.CreateTemp(folder, ".status-*")
	if err != nil {
		return err
	}
	defer func() { _ = os.Remove(temp.Name()) }()
	if _, err := temp.Write(data); err != nil {
		_ = temp.Close()
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}
	return os.Rename(temp.Name(), path)
}

// cleanLimits drops a window whose share is not a number the console can
// draw, and the whole set when none is left.
func cleanLimits(limits *StatusLimits) *StatusLimits {
	if limits == nil {
		return nil
	}
	valid := func(w *StatusWindow) *StatusWindow {
		if w == nil || math.IsNaN(w.UsedPercentage) || math.IsInf(w.UsedPercentage, 0) {
			return nil
		}
		return w
	}
	out := &StatusLimits{FiveHour: valid(limits.FiveHour), SevenDay: valid(limits.SevenDay)}
	if out.FiveHour == nil && out.SevenDay == nil {
		return nil
	}
	return out
}

// statusPath is where a conversation's status is kept.
func statusPath(dir, conversation string) string {
	return filepath.Join(dir, conversation+".json")
}

// Text is the line printed in the terminal's status row when the person has
// no status line of their own: the context, then the plan's windows
// ("ctx 32% · 5h 23% · 7d 41%"). Empty until the CLI sends any of them.
func (s Status) Text() string {
	var parts []string
	if c := s.ContextWindow; c != nil && c.UsedPercentage != nil {
		parts = append(parts, fmt.Sprintf("ctx %d%%", int(math.Round(*c.UsedPercentage))))
	}
	if l := s.RateLimits; l != nil {
		if l.FiveHour != nil {
			parts = append(parts, fmt.Sprintf("5h %d%%", int(math.Round(l.FiveHour.UsedPercentage))))
		}
		if l.SevenDay != nil {
			parts = append(parts, fmt.Sprintf("7d %d%%", int(math.Round(l.SevenDay.UsedPercentage))))
		}
	}
	return strings.Join(parts, " · ")
}
