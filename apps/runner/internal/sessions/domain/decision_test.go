package domain_test

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Claude Code's permission dialog as a pane shows it: a rule across the
// screen, what the tool wants to do, the question, the options with the
// cursor on the first, and the footer.
const bashDialog = `⏺ Running the tests first.

────────────────────────────────────────────────────────────────
 Bash command

   pnpm test --filter api
   Run the API unit tests

 Do you want to proceed?
 ❯ 1. Yes
   2. Yes, and don't ask again for pnpm test commands in
      /home/jordi/oppenheimer
   3. No, and tell Claude what to do differently (esc)

 Esc to cancel
`

// The same dialog drawn in a box, as earlier releases did.
const boxedDialog = `╭──────────────────────────────────────────────╮
│ Edit file                                    │
│ src/main.go                                  │
│                                              │
│ Do you want to make this edit to main.go?    │
│ ❯ 1. Yes                                     │
│   2. No, and tell Claude what to do (esc)    │
╰──────────────────────────────────────────────╯
`

func TestAPermissionDialogReadsAsItsQuestionWhatItAsksAboutAndItsOptions(t *testing.T) {
	decision, ok := domain.PermissionDecision(bashDialog)
	if !ok {
		t.Fatal("no decision read off the dialog")
	}
	if decision.Kind != domain.DecisionPermissionKind || decision.Title != "Do you want to proceed?" {
		t.Fatalf("decision = %+v", decision)
	}
	if decision.Detail == nil || *decision.Detail != "Bash command\n\npnpm test --filter api\nRun the API unit tests" {
		t.Fatalf("detail = %q", deref(decision.Detail))
	}
	want := []string{
		"Yes",
		"Yes, and don't ask again for pnpm test commands in /home/jordi/oppenheimer",
		"No, and tell Claude what to do differently (esc)",
	}
	if got := labels(decision); strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("options = %q, want %q", got, want)
	}
	if !strings.HasPrefix(decision.ID, "perm-") {
		t.Fatalf("id = %q", decision.ID)
	}
}

func TestABoxedDialogLosesItsBorders(t *testing.T) {
	decision, ok := domain.PermissionDecision(boxedDialog)
	if !ok {
		t.Fatal("no decision read off the boxed dialog")
	}
	if decision.Title != "Do you want to make this edit to main.go?" || deref(decision.Detail) != "Edit file\nsrc/main.go" {
		t.Fatalf("decision = %+v detail %q", decision, deref(decision.Detail))
	}
	if got := labels(decision); len(got) != 2 || got[1] != "No, and tell Claude what to do (esc)" {
		t.Fatalf("options = %q", got)
	}
}

// The id names the dialog: the same one keeps it across reads (and wherever
// the cursor is), the next one gets another, so the Inbox can tell an answer
// to this dialog from one to the next.
func TestTheIdFollowsTheDialogNotTheCursor(t *testing.T) {
	first, _ := domain.PermissionDecision(bashDialog)
	moved := strings.Replace(strings.Replace(bashDialog, "❯ 1. Yes", "  1. Yes", 1), "   2. Yes,", " ❯ 2. Yes,", 1)
	again, ok := domain.PermissionDecision(moved)
	if !ok || again.ID != first.ID {
		t.Fatalf("moved cursor: id %q, want %q", again.ID, first.ID)
	}
	other, _ := domain.PermissionDecision(strings.Replace(bashDialog, "pnpm test --filter api", "rm -rf dist", 1))
	if other.ID == first.ID {
		t.Fatal("a different command kept the id")
	}
}

func TestAScreenWithNoDialogIsNoDecision(t *testing.T) {
	for name, body := range map[string]string{
		"prompt":       "╭────────╮\n│ >      │\n╰────────╯\n  ? for shortcuts",
		"working":      "⠹ Thinking… (12s · esc to interrupt)",
		"one option":   "Continue?\n ❯ 1. Yes\n",
		"y/n":          "Overwrite the file? (y/n)",
		"out of order": "Pick one\n 1. A\n 3. C\n",
	} {
		if decision, ok := domain.PermissionDecision(body); ok {
			t.Errorf("%s: read %+v", name, decision)
		}
	}
}

func TestAQuestionIsCutToItsBounds(t *testing.T) {
	input, _ := json.Marshal(map[string]any{"questions": []map[string]any{
		{"header": "Scope", "question": strings.Repeat("q", 1000), "multiSelect": true, "options": []map[string]any{
			{"label": "A", "description": "first"}, {"label": ""}, {"label": "B"}, {"label": "C"},
			{"label": "D"}, {"label": "E"}, {"label": "F"}, {"label": "G"},
		}},
		{"question": "  ", "options": []map[string]any{{"label": "x"}}},
		{"question": "Second?", "options": []map[string]any{}},
	}})
	decision, ok := domain.QuestionDecision("toolu_01", input)
	if !ok || len(decision.Questions) != 1 {
		t.Fatalf("decision = %+v", decision)
	}
	q := decision.Questions[0]
	if len(q.Question) != domain.DecisionQuestionMax || len(q.Options) != domain.DecisionQuestionOptionsMax || !q.MultiSelect {
		t.Fatalf("question = %d chars, %d options", len(q.Question), len(q.Options))
	}
	if deref(q.Header) != "Scope" || deref(q.Options[0].Description) != "first" || q.Options[1].Description != nil {
		t.Fatalf("question = %+v", q)
	}
	if _, ok := domain.QuestionDecision("toolu_02", []byte(`{"questions":[]}`)); ok {
		t.Fatal("a call with no question is a decision")
	}
}

// A "don't ask again" label naming a long command wraps over several lines
// and runs past the schema's bound: it is joined, cut within the bound, and
// says it was cut, so the button never reads as a shorter, different rule.
func TestALongWrappedLabelIsJoinedAndCutVisibly(t *testing.T) {
	body := strings.Join([]string{
		" Bash command",
		"",
		"   pnpm --filter @oppenheimer/api test:integration",
		"",
		" Do you want to proceed?",
		" ❯ 1. Yes",
		"   2. Yes, and don't ask again for pnpm --filter @oppenheimer/api test:integration",
		"      commands in /home/runner/oppenheimer-ai/sessions/xrp-mobile and every",
		"      directory below it",
		"   3. No, and tell Claude what to do differently (esc)",
	}, "\n")
	decision, ok := domain.PermissionDecision(body)
	if !ok || len(decision.Options) != 3 {
		t.Fatalf("decision = %+v", decision)
	}
	label := decision.Options[1].Label
	if len(label) > domain.DecisionLabelMax || !strings.HasSuffix(label, "…") ||
		!strings.HasPrefix(label, "Yes, and don't ask again for pnpm --filter @oppenheimer/api test:integration commands in") {
		t.Fatalf("label = %q (%d bytes)", label, len(label))
	}
	if decision.Options[2].Label != "No, and tell Claude what to do differently (esc)" {
		t.Fatalf("the next option = %q", decision.Options[2].Label)
	}
}

func TestShrinkDropsDescriptionsFirst(t *testing.T) {
	description := "why"
	decision := domain.Decision{Kind: domain.DecisionQuestionKind, ID: "t", Questions: []domain.DecisionQuestion{{
		Question: strings.Repeat("q", domain.DecisionQuestionMax),
		Options:  []domain.DecisionQuestionOption{{Label: "A", Description: &description}},
	}}}
	smaller, cut := decision.Shrink()
	if !cut || smaller.Questions[0].Options[0].Description != nil || len(smaller.Questions[0].Question) != domain.DecisionQuestionMax {
		t.Fatalf("first cut = %+v", smaller)
	}
	if decision.Questions[0].Options[0].Description == nil {
		t.Fatal("shrink changed the decision it was given")
	}
	smaller, cut = smaller.Shrink()
	if !cut || len(smaller.Questions[0].Question) != domain.DecisionQuestionMax/2 {
		t.Fatalf("second cut = %d chars", len(smaller.Questions[0].Question))
	}
	if _, cut = smaller.Shrink(); cut {
		t.Fatal("nothing left to cut, and shrink still cut")
	}
}

func labels(decision domain.Decision) []string {
	out := make([]string, len(decision.Options))
	for i, option := range decision.Options {
		out[i] = option.Label
	}
	return out
}

func deref(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}
