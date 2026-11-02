package domain

import (
	"encoding/base64"
	"strconv"
	"strings"
	"unicode"
)

// The Program Status Protocol, OSC 7501: a program says what it is doing —
// idle, working, done, blocked, error — with an escape sequence on its own
// terminal, instead of the terminal guessing from the screen. Claude Code
// speaks it from 2.1.295, once the terminal answers its `OSC 7501 ; ?` probe.
// tmux answers no such probe, so the runner's `pty` wrapper sits between the
// agent and its pane to answer it and to keep what the agent reports
// (`product/research/lessons-from-herdr.md`).

// ProgramStatusQuery is the payload of the probe a program sends to ask
// whether the terminal speaks the protocol.
const ProgramStatusQuery = "?"

// ProgramStatusReply is the terminal's answer to the probe: the states and
// blocked kinds it understands, as herdr-core and Ghostty answer it.
const ProgramStatusReply = "\x1b]7501;?:states=idle,working,done,blocked,error:kinds=permission,question,auth\x1b\\"

// programStates are the states a report may carry, and `clear`, which removes
// records instead of setting one.
var programStates = map[string]bool{"idle": true, "working": true, "done": true, "blocked": true, "error": true, "clear": true}

// programKinds are what a blocked program may say it waits on.
var programKinds = map[string]bool{"permission": true, "question": true, "auth": true}

// maxProgramText bounds a decoded title or message: what a sidebar row and an
// event payload carry, not a transcript.
const maxProgramText = 500

// ProgramStatus is one record of a program's report, in the program's own
// words. ID is empty for the root record, the one that says what the program
// as a whole is doing; a program reporting on several things at once names
// the others.
type ProgramStatus struct {
	ID    string `json:"id,omitempty"`
	State string `json:"state"`
	// Kind is permission, question or auth, on a blocked record that said.
	Kind string `json:"kind,omitempty"`
	// Progress is 0–100 on a working or blocked record that said.
	Progress *int   `json:"progress,omitempty"`
	App      string `json:"app,omitempty"`
	Title    string `json:"title,omitempty"`
	Message  string `json:"message,omitempty"`
}

// ParseProgramStatus reads the payload of one OSC 7501 report (what follows
// `7501;`), `key=value` fields joined by `:`. A report with no state, or one
// the protocol does not define, is not a report. Unknown keys are ignored, as
// the protocol asks, so a newer program never confuses an older runner.
func ParseProgramStatus(payload string) (ProgramStatus, bool) {
	var status ProgramStatus
	for _, field := range strings.Split(payload, ":") {
		key, value, ok := strings.Cut(field, "=")
		if !ok {
			continue
		}
		switch key {
		case "state":
			status.State = value
		case "id":
			status.ID = value
		case "kind":
			if programKinds[value] {
				status.Kind = value
			}
		case "progress":
			if n, err := strconv.Atoi(value); err == nil && n >= 0 && n <= 100 {
				status.Progress = &n
			}
		case "app":
			status.App = clip(value, 64)
		case "title":
			status.Title = decodeProgramText(value)
		case "msg":
			status.Message = decodeProgramText(value)
		}
	}
	if !programStates[status.State] {
		return ProgramStatus{}, false
	}
	if status.State != "blocked" {
		status.Kind = ""
	}
	if status.State != "working" && status.State != "blocked" {
		status.Progress = nil
	}
	return status, true
}

// decodeProgramText reads a base64 title or message, padded or not; text that
// is not base64 is not text the program meant to send. Control characters
// become spaces: the text is shown on a line, never run in a terminal.
func decodeProgramText(value string) string {
	for _, enc := range []*base64.Encoding{base64.StdEncoding, base64.RawStdEncoding, base64.URLEncoding, base64.RawURLEncoding} {
		if raw, err := enc.DecodeString(value); err == nil {
			text := strings.Map(func(r rune) rune {
				if unicode.IsControl(r) {
					return ' '
				}
				return r
			}, strings.ToValidUTF8(string(raw), ""))
			return clip(strings.TrimSpace(text), maxProgramText)
		}
	}
	return ""
}

// ProgramReport is everything a program has reported on its terminal: every
// record it holds by id, and the turn counter, which goes up each time the
// root record leaves `working`, for any reason. It is what the `pty` wrapper
// writes beside the session and the runner reads on every refresh.
type ProgramReport struct {
	// Records holds the live records by id; the root record's id is "".
	Records map[string]ProgramStatus `json:"records"`
	// Reported is whether the program ever sent a report: one that said
	// nothing yet is not one that cleared everything.
	Reported bool `json:"reported"`
	Turn     int  `json:"turn"`
}

// maxProgramRecords bounds what a program can make the runner hold.
const maxProgramRecords = 256

// Apply folds one report in: a report replaces its record, and `clear`
// removes a record and the records below it (`a` takes `a/b`); a clear with
// no id removes them all.
func (r *ProgramReport) Apply(status ProgramStatus) {
	if r.Records == nil {
		r.Records = map[string]ProgramStatus{}
	}
	r.Reported = true
	wasWorking := r.Records[""].State == "working"
	if status.State == "clear" {
		for id := range r.Records {
			if status.ID == "" || id == status.ID || strings.HasPrefix(id, status.ID+"/") {
				delete(r.Records, id)
			}
		}
	} else if _, known := r.Records[status.ID]; known || len(r.Records) < maxProgramRecords {
		r.Records[status.ID] = status
	}
	if wasWorking && r.Records[""].State != "working" {
		r.Turn++
	}
}

// Root is the record that speaks for the program as a whole, if it holds one.
func (r ProgramReport) Root() (ProgramStatus, bool) {
	status, ok := r.Records[""]
	return status, ok
}

// Says is what the report tells the person, in one line: why the program
// waits and its message, as "permission: approve Bash".
func (s ProgramStatus) Says() string {
	switch {
	case s.Kind != "" && s.Message != "":
		return s.Kind + ": " + s.Message
	case s.Kind != "":
		return s.Kind
	}
	return s.Message
}

// SessionState maps a program's own word onto the runner's session states.
// `error` is a turn that ended in an error: the agent is no longer working and
// waits for the person, which is what `done` means to the sidebar; the
// program's message carries the error.
func (s ProgramStatus) SessionState() State {
	switch s.State {
	case "working":
		return StateWorking
	case "blocked":
		return StateBlocked
	case "done", "error":
		return StateDone
	default:
		return StateIdle
	}
}
