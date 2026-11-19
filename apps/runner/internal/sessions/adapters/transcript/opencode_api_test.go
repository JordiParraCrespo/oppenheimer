package transcript

import "testing"

// An event's type is read as JSON, whatever its spacing or the keys before
// it, and a head that ends before the type reads as none, never as a guess.
// Regression: a version of OpenCode that spaces its JSON, or puts its id
// after its type, leaving the chat on its slow poll with nothing to say so.
func TestAnOpenCodeEventsTypeIsReadAsJSON(t *testing.T) {
	cases := map[string]string{
		`{"id":"6","properties":{"x":[1,{"y":"z"}],"sessionID":"ses_b"},"type":"session.idle"}`: "session.idle",
		`{"id":"1","type":"message.part.updated","properties":{"part":{}}}`:                     "message.part.updated",
		`{ "type" : "session.updated", "id": "2" }`:                                             "session.updated",
		`{"properties":{"sessionID":"ses_a"},"type":"message.updated"}`:                         "message.updated",
		`{"id":"3","type":"server.heartbeat","properties":{}}`:                                  "server.heartbeat",
		`{"id":"4","properties":{"part":{"text":"a long part cut off here`:                      "",
		`not json`:       "",
		`{"id":"5","typ`: "",
	}
	for data, want := range cases {
		if got, _ := eventOf([]byte(data)); got != want {
			t.Errorf("eventOf(%s) = %q, want %q", data, got, want)
		}
	}
}

// An event names the conversation it is about wherever OpenCode puts it: on
// itself, on the message or part it carries, or, for a conversation's own
// event, as that conversation's id; a child's id in a tool's metadata, or a
// message's own id, is never taken for it. Regression: the chat unable to
// tell its own OpenCode's conversation from another's in the same folder,
// and showing the other.
func TestAnOpenCodeEventNamesItsConversation(t *testing.T) {
	cases := map[string]string{
		`{"type":"session.status","properties":{"sessionID":"ses_a","status":{"type":"busy"}}}`:                                                   "ses_a",
		`{"type":"message.updated","properties":{"info":{"id":"msg_1","sessionID":"ses_b","role":"user"}}}`:                                       "ses_b",
		`{"type":"message.part.updated","properties":{"part":{"id":"prt_1","state":{"metadata":{"sessionId":"ses_child"}},"sessionID":"ses_c"}}}`: "ses_c",
		`{"type":"session.updated","properties":{"info":{"id":"ses_d","directory":"/home/a","time":{"updated":1}}}}`:                              "ses_d",
		`{"properties":{"info":{"id":"msg_2"}},"type":"message.updated"}`:                                                                         "",
		`{"type":"message.part.updated","properties":{"part":{"id":"prt_2","text":"cut off befo`:                                                  "",
	}
	for data, want := range cases {
		if _, got := eventOf([]byte(data)); got != want {
			t.Errorf("eventOf(%s) names %q, want %q", data, got, want)
		}
	}
}
