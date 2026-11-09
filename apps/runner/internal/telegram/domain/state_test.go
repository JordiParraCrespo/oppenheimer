package domain

import "testing"

// The bot's status as the poller drives it: a disconnected bot is never
// brought back by a poller that is still winding down, a failed poll only
// demotes a connected bot, and a refused token is reported once.
func TestStatusOn(t *testing.T) {
	bot := Bot{ID: "7012345678", Username: "shop_helper_bot"}
	cases := []struct {
		name    string
		from    Status
		event   Event
		want    State
		changed bool
	}{
		{"connecting bot answered", Status{State: StateConnecting, Bot: bot}, Polled, StateConnected, true},
		{"connected bot answered again", Status{State: StateConnected, Bot: bot}, Polled, StateConnected, false},
		{"revoked bot is answered by a new token", Status{State: StateRevoked, Bot: bot, Reason: RevokedReason}, Polled, StateConnected, true},
		{"connected bot loses Telegram", Status{State: StateConnected, Bot: bot}, PollFailed, StateConnecting, true},
		{"connecting bot fails again", Status{State: StateConnecting, Bot: bot}, PollFailed, StateConnecting, false},
		{"token refused", Status{State: StateConnected, Bot: bot}, TokenRefused, StateRevoked, true},
		{"token refused twice", Status{State: StateRevoked, Bot: bot, Reason: RevokedReason}, TokenRefused, StateRevoked, false},
		{"disconnected bot ignores a late poll", Status{State: StateUnlinked}, Polled, StateUnlinked, false},
		{"disconnected bot ignores a late refusal", Status{State: StateUnlinked}, TokenRefused, StateUnlinked, false},
	}
	for _, c := range cases {
		got, changed := c.from.On(c.event)
		if got.State != c.want || changed != c.changed {
			t.Errorf("%s: got %s (changed %v), want %s (changed %v)", c.name, got.State, changed, c.want, c.changed)
		}
		if c.want != StateUnlinked && got.Bot != c.from.Bot {
			t.Errorf("%s: the bot was not kept", c.name)
		}
		if c.want == StateConnected && got.Reason != "" {
			t.Errorf("%s: a connected bot keeps no reason", c.name)
		}
	}
}
