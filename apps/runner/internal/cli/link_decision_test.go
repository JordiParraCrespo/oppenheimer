package cli

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// A question at every bound is larger than an event's payload: it is cut
// until it fits, rather than sent as an event the control plane refuses and
// the Inbox never sees.
func TestADecisionTooLargeForAnEventIsCutToFit(t *testing.T) {
	description := strings.Repeat("d", sessionsdomain.DecisionDescriptionMax)
	header := strings.Repeat("h", sessionsdomain.DecisionHeaderMax)
	question := sessionsdomain.DecisionQuestion{Header: &header, Question: strings.Repeat("q", sessionsdomain.DecisionQuestionMax)}
	for range sessionsdomain.DecisionQuestionOptionsMax {
		question.Options = append(question.Options, sessionsdomain.DecisionQuestionOption{
			Label: strings.Repeat("l", sessionsdomain.DecisionLabelMax), Description: &description,
		})
	}
	decision := &sessionsdomain.Decision{Kind: sessionsdomain.DecisionQuestionKind, ID: "toolu_big"}
	for range sessionsdomain.DecisionQuestionsMax {
		decision.Questions = append(decision.Questions, question)
	}

	fitted := fitDecision(decision)
	if fitted == nil {
		t.Fatal("the question was dropped instead of cut")
	}
	body, _ := json.Marshal(sessionsdomain.AgentDecisionPayload{Decision: fitted})
	if len(body) > link.MaxEventPayloadBytes {
		t.Fatalf("payload is %d bytes, over %d", len(body), link.MaxEventPayloadBytes)
	}
	if fitted.Questions[0].Options[0].Description != nil {
		t.Fatal("the descriptions were kept over the question")
	}
	if fitDecision(nil) != nil {
		t.Fatal("nothing pending became something")
	}
}
