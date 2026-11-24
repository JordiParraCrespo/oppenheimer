package tmux

import "testing"

// A browser watching a tab attaches to a view of the session, not to the
// session: its client counts for the session it watches, or the idle stop
// would take the session from under it.
func TestParseClientsCountsAViewForItsSession(t *testing.T) {
	out := "opp-a\nopp-a" + viewMark + "k3j\nopp-b\n\n"
	clients := parseClients(out)
	if clients["opp-a"] != 2 || clients["opp-b"] != 1 || len(clients) != 2 {
		t.Fatalf("clients = %v", clients)
	}
}
