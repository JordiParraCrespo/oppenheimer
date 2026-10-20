package domain

import (
	"strings"
	"unicode/utf8"
)

// FirstPromptMaxBytes is what a `prompt.first` carries of the first message:
// 2 KB, the cap 02-runner §7 sets and the control plane measures in bytes.
const FirstPromptMaxBytes = 2 * 1024

// AwaitsFirstPrompt reports a session whose first message the runner still
// has to read off the agent's transcript and report (02-runner §7): an agent
// launched with no task, under a conversation name the transcript can be
// found by, that has not reported one yet. A stopped session still does: an
// agent that exited between the first message and the next poll wrote it
// down all the same. A closed one is over.
//
// A launch that carried a task reports nothing: the control plane wrote that
// `prompt.first` itself, and a second one from here would be a duplicate the
// two writers cannot dedupe against each other. A launch that resumed a
// conversation at create continues one whose first message was already said.
func (s Session) AwaitsFirstPrompt() bool {
	return (s.State.Live() || s.State == StateStopped) &&
		s.Agent != AgentShell &&
		s.Launch.Prompt == "" &&
		!s.Launch.Resume &&
		s.Launch.Conversation != "" &&
		!s.PromptReported
}

// FirstPromptText is a first message as `prompt.first` carries it: trimmed,
// and cut to FirstPromptMaxBytes without splitting a character. Empty is
// nothing to report.
func FirstPromptText(text string) string {
	text = strings.TrimSpace(text)
	if len(text) <= FirstPromptMaxBytes {
		return text
	}
	n := FirstPromptMaxBytes
	for n > 0 && !utf8.RuneStart(text[n]) {
		n--
	}
	return strings.TrimSpace(text[:n])
}
