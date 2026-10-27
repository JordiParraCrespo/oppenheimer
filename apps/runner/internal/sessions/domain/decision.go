package domain

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"regexp"
	"strings"
	"unicode/utf8"
)

// A Decision is what a session's agent waits on the person for (29-inbox,
// slice 4): an AskUserQuestion call its transcript holds with no result yet,
// or the permission dialog on its screen. The types and bounds are generated
// from the shared schema (session_decision.gen.go); this file builds them.

// QuestionDecision is the decision an AskUserQuestion tool call asks, from
// the call's id and its input (`{questions: [{header, question, multiSelect,
// options: [{label, description}]}]}`), cut to the schema's bounds. A question
// with no text or no option is left out, and a call left with none is no
// decision.
func QuestionDecision(id string, input []byte) (Decision, bool) {
	var in struct {
		Questions []struct {
			Header      string `json:"header"`
			Question    string `json:"question"`
			MultiSelect bool   `json:"multiSelect"`
			Options     []struct {
				Label       string `json:"label"`
				Description string `json:"description"`
			} `json:"options"`
		} `json:"questions"`
	}
	if id == "" || len(id) > DecisionIDMax || json.Unmarshal(input, &in) != nil {
		return Decision{}, false
	}
	decision := Decision{Kind: DecisionQuestionKind, ID: id}
	for _, q := range in.Questions {
		if len(decision.Questions) == DecisionQuestionsMax {
			break
		}
		text := clip(strings.TrimSpace(q.Question), DecisionQuestionMax)
		if text == "" {
			continue
		}
		question := DecisionQuestion{
			Header: optional(clip(strings.TrimSpace(q.Header), DecisionHeaderMax)), Question: text,
			MultiSelect: q.MultiSelect, Options: []DecisionQuestionOption{},
		}
		for _, o := range q.Options {
			if len(question.Options) == DecisionQuestionOptionsMax {
				break
			}
			label := clip(strings.TrimSpace(o.Label), DecisionLabelMax)
			if label == "" {
				continue
			}
			question.Options = append(question.Options, DecisionQuestionOption{
				Label: label, Description: optional(clip(strings.TrimSpace(o.Description), DecisionDescriptionMax)),
			})
		}
		if len(question.Options) > 0 {
			decision.Questions = append(decision.Questions, question)
		}
	}
	return decision, len(decision.Questions) > 0
}

// Shrink makes a decision smaller for a payload it does not fit, one step at
// a time, and reports whether there was anything left to cut: a question's
// descriptions go first, then its text past half the bound, then the
// permission dialog's detail past a few lines.
func (d Decision) Shrink() (Decision, bool) {
	out := d
	out.Questions = make([]DecisionQuestion, len(d.Questions))
	cut := false
	for i, q := range d.Questions {
		q.Options = append([]DecisionQuestionOption(nil), q.Options...)
		for j := range q.Options {
			if q.Options[j].Description != nil {
				q.Options[j].Description, cut = nil, true
			}
		}
		out.Questions[i] = q
	}
	if cut {
		return out, true
	}
	for i := range out.Questions {
		if short := clip(out.Questions[i].Question, DecisionQuestionMax/2); short != out.Questions[i].Question {
			out.Questions[i].Question, cut = short, true
		}
	}
	if d.Detail != nil {
		if short := clip(*d.Detail, DecisionDetailMax/4); short != *d.Detail {
			out.Detail, cut = &short, true
		}
	}
	if len(d.Questions) == 0 {
		out.Questions = nil
	}
	return out, cut
}

// permissionLines is how much of the bottom of the screen a permission dialog
// is looked for in, and permissionDetailLines how many lines above its
// question are kept as what it asks about.
const (
	permissionLines       = 40
	permissionDetailLines = 12
)

var (
	// permissionOption is a numbered option, the cursor already stripped.
	permissionOption = regexp.MustCompile(`^(\d)[.)]\s+(\S.*)$`)
	// cursorMark is what Claude Code draws before the option under the cursor.
	cursorMark = regexp.MustCompile(`^[❯›>▶➤]\s*`)
)

// PermissionDecision reads Claude Code's permission dialog off the bottom of
// a screen: a title (its question, "Do you want to proceed?"), what it asks
// about above it (a command, a file), and its numbered options (`❯ 1. Yes`,
// `2. Yes, and don't ask again for …`, `3. No, and tell Claude what to do
// differently (esc)`). A box's borders and the cursor are not part of any of
// them. Fewer than two options, numbered from 1 in order, is no dialog. The
// id is a hash of what the dialog says, so it keeps its id while it is on the
// screen and the next dialog gets another.
func PermissionDecision(body string) (Decision, bool) {
	lines := strings.Split(strings.TrimRight(body, "\n "), "\n")
	if len(lines) > permissionLines {
		lines = lines[len(lines)-permissionLines:]
	}
	cleaned := make([]string, len(lines))
	rules := make([]bool, len(lines))
	for i, line := range lines {
		cleaned[i], rules[i] = cleanDialogLine(line)
	}

	first := -1
	for i := len(cleaned) - 1; i >= 0; i-- {
		if n, _, ok := dialogOption(cleaned[i]); ok && n == 1 {
			first = i
			break
		}
	}
	if first < 0 {
		return Decision{}, false
	}
	options := dialogOptions(cleaned[first:])
	if len(options) < 2 || len(options) > DecisionPermissionOptionsMax {
		return Decision{}, false
	}

	titleAt := first - 1
	for titleAt >= 0 && cleaned[titleAt] == "" && !rules[titleAt] {
		titleAt--
	}
	if titleAt < 0 || rules[titleAt] {
		return Decision{}, false
	}
	title := clip(cleaned[titleAt], DecisionTitleMax)

	var detail []string
	for i := titleAt - 1; i >= 0 && !rules[i] && len(detail) < permissionDetailLines; i-- {
		if cleaned[i] == "" && i > 0 && cleaned[i-1] == "" {
			break
		}
		detail = append([]string{cleaned[i]}, detail...)
	}
	text := clip(strings.TrimSpace(strings.Join(detail, "\n")), DecisionDetailMax)

	decision := Decision{Kind: DecisionPermissionKind, Title: title, Detail: optional(text)}
	hash := sha256.New()
	hash.Write([]byte(title + "\x00" + text))
	for _, label := range options {
		decision.Options = append(decision.Options, DecisionPermissionOption{Label: label})
		hash.Write([]byte("\x00" + label))
	}
	decision.ID = "perm-" + hex.EncodeToString(hash.Sum(nil))[:24]
	return decision, true
}

// dialogOptions reads the options from the line holding option 1: each next
// number in turn, a line of a label that wrapped joined to it, and the block
// ending at a blank line or at the first line after the last option (the
// dialog's footer, "Esc to cancel").
func dialogOptions(lines []string) []string {
	end := len(lines)
	for i, line := range lines {
		if line == "" {
			end = i
			break
		}
	}
	block := lines[:end]
	last := 0
	for i, line := range block {
		if _, _, ok := dialogOption(line); ok {
			last = i
		}
	}
	var options []string
	for _, line := range block[:last+1] {
		n, label, ok := dialogOption(line)
		switch {
		case ok && n == len(options)+1:
			options = append(options, label)
		case ok:
			return options
		case len(options) > 0:
			options[len(options)-1] += " " + line
		}
	}
	for i := range options {
		options[i] = clip(options[i], DecisionLabelMax)
	}
	return options
}

func dialogOption(line string) (int, string, bool) {
	match := permissionOption.FindStringSubmatch(cursorMark.ReplaceAllString(line, ""))
	if match == nil {
		return 0, "", false
	}
	return int(match[1][0] - '0'), strings.TrimSpace(match[2]), true
}

// cleanDialogLine is a screen line without a box's borders and padding, and
// whether it was a rule (a line across the dialog, its box's top or bottom,
// which bounds it). A box's sides alone are an empty line, not a rule.
func cleanDialogLine(line string) (string, bool) {
	isBox := func(r rune) bool { return r >= 0x2500 && r <= 0x257F }
	trimmed := strings.TrimSpace(line)
	text := strings.TrimSpace(strings.TrimFunc(trimmed, func(r rune) bool { return isBox(r) || r == ' ' }))
	return text, text == "" && strings.ContainsAny(trimmed, "─━═╭╮╰╯┌┐└┘")
}

// optional is nil for "", the absent text the schema reads as null.
func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// clip cuts s to at most max bytes without splitting a rune.
func clip(s string, max int) string {
	if len(s) <= max {
		return s
	}
	end := max
	for end > 0 && !utf8.RuneStart(s[end]) {
		end--
	}
	return s[:end]
}
