package domain_test

import (
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/domain"
)

// The minute window refuses the send past its limit and opens again once the
// minute has passed.
func TestBudgetRefusesPastTheMinuteAndRecovers(t *testing.T) {
	b := domain.NewBudget(2, 100)
	if !b.Take(now) || !b.Take(now.Add(time.Second)) {
		t.Fatal("sends inside the budget were refused")
	}
	if b.Take(now.Add(2 * time.Second)) {
		t.Fatal("a third send in a minute of two was allowed")
	}
	if !b.Take(now.Add(61 * time.Second)) {
		t.Fatal("the minute passed and the send was still refused")
	}
}

// The day window holds even when every minute is quiet.
func TestBudgetRefusesPastTheDay(t *testing.T) {
	b := domain.NewBudget(100, 3)
	for i := range 3 {
		if !b.Take(now.Add(time.Duration(i) * time.Hour)) {
			t.Fatal("a send inside the day was refused")
		}
	}
	if b.Take(now.Add(5 * time.Hour)) {
		t.Fatal("a fourth send in a day of three was allowed")
	}
	if !b.Take(now.Add(25 * time.Hour)) {
		t.Fatal("the first send left the day and the next was still refused")
	}
}

// A send WhatsApp never took is given back; a pause refuses everything until it ends.
func TestBudgetRefundAndPause(t *testing.T) {
	b := domain.NewBudget(1, 10)
	b.Take(now)
	b.Refund(now)
	if !b.Take(now.Add(time.Second)) {
		t.Fatal("a refunded send still counted")
	}
	b.PauseUntil(now.Add(10 * time.Minute))
	if b.Take(now.Add(5 * time.Minute)) {
		t.Fatal("a send went out during a pause")
	}
	if !b.Take(now.Add(11 * time.Minute)) {
		t.Fatal("the pause ended and the send was still refused")
	}
}
