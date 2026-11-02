package transcript

import "testing"

// An event's type is read as JSON, whatever its spacing or the keys before
// it, and a head that ends before the type reads as none, never as a guess.
// Regression: a version of OpenCode that spaces its JSON, or puts its id
// after its type, leaving the chat on its slow poll with nothing to say so.
func TestAnOpenCodeEventsTypeIsReadAsJSON(t *testing.T) {
	cases := map[string]string{
		`{"id":"1","type":"message.part.updated","properties":{"part":{}}}`: "message.part.updated",
		`{ "type" : "session.updated", "id": "2" }`:                         "session.updated",
		`{"properties":{"sessionID":"ses_a"},"type":"message.updated"}`:     "message.updated",
		`{"id":"3","type":"server.heartbeat","properties":{}}`:              "server.heartbeat",
		`{"id":"4","properties":{"part":{"text":"a long part cut off here`:  "",
		`not json`:       "",
		`{"id":"5","typ`: "",
	}
	for data, want := range cases {
		if got := eventType([]byte(data)); got != want {
			t.Errorf("eventType(%s) = %q, want %q", data, got, want)
		}
	}
}
