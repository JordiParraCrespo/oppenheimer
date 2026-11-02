package transcript_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

const (
	askLine     = `{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_ask","name":"AskUserQuestion","input":{"questions":[{"header":"Scope","question":"What should it cover?","multiSelect":false,"options":[{"label":"Tokens","description":"Only tokens"},{"label":"Everything"}]}]}}]}}`
	answerToAsk = `{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_ask","content":"User has answered your questions: \"What should it cover?\"=\"Tokens\"."}]}}`
)

func TestAnAskUserQuestionWithNoResultIsTheOpenQuestion(t *testing.T) {
	projects := write(t, promptLine, askLine)
	reader := transcript.New(transcript.Options{ClaudeProjects: projects})

	decision, ok := reader.OpenQuestion(domain.AgentClaude, conversation)
	if !ok || decision.ID != "toolu_ask" || decision.Kind != domain.DecisionQuestionKind {
		t.Fatalf("open question = %+v, %v", decision, ok)
	}
	q := decision.Questions[0]
	if q.Question != "What should it cover?" || len(q.Options) != 2 || q.Options[1].Description != nil {
		t.Fatalf("question = %+v", q)
	}

	appendLine(t, projects, answerToAsk)
	if decision, ok := reader.OpenQuestion(domain.AgentClaude, conversation); ok {
		t.Fatalf("an answered question is still open: %+v", decision)
	}
}

func TestATranscriptWithNoQuestionHasNoneOpen(t *testing.T) {
	reader := transcript.New(transcript.Options{ClaudeProjects: write(t, promptLine, answerLine)})
	if _, ok := reader.OpenQuestion(domain.AgentClaude, conversation); ok {
		t.Fatal("a question with none asked")
	}
	if _, ok := reader.OpenQuestion(domain.AgentClaude, "../escape"); ok {
		t.Fatal("a question from a conversation name that is not one")
	}
}

func appendLine(t *testing.T, projects, line string) {
	t.Helper()
	path := filepath.Join(projects, "-w-sessions-bold-otter-3f9a7k-oppenheimer", conversation+".jsonl")
	file, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = file.Close() }()
	if _, err := file.WriteString(line + "\n"); err != nil {
		t.Fatal(err)
	}
}
