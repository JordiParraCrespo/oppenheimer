// Package ws streams job events over the hub and authorises the topics.
package ws

import (
	"context"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/scopes"
	"github.com/jordiparracrespo/oppenheimer/packages/go/auth"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// Topic names: `jobs` carries every event, `jobs/<id>` one job's.
const TopicAll = "jobs"

// TopicFor is one job's topic.
func TopicFor(id string) string { return TopicAll + "/" + id }

// Hub is the slice of the platform hub this adapter needs.
type Hub interface {
	Publish(topic, event string, payload any)
}

// Publisher implements app.Publisher on the hub.
type Publisher struct {
	hub Hub
}

// NewPublisher builds the adapter.
func NewPublisher(hub Hub) *Publisher { return &Publisher{hub: hub} }

var _ app.Publisher = (*Publisher)(nil)

// Publish fans the event out to the global topic and the job's own.
func (p *Publisher) Publish(_ context.Context, ev domain.Event) {
	payload := ToWire(ev.Job)
	p.hub.Publish(TopicAll, ev.Name, payload)
	p.hub.Publish(TopicFor(ev.Job.ID), ev.Name, payload)
}

// Authorize is the topic rule: `jobs` and `jobs/*` need events:read.
// Anything else is unknown to this context; the composition root chains the
// authorizers of every context that owns topics.
func Authorize(_ context.Context, p *auth.Principal, topic string) error {
	if topic != TopicAll && !strings.HasPrefix(topic, TopicAll+"/") {
		return problem.ErrNotFound.WithDetail("unknown topic %q", topic)
	}
	if !p.Can(scopes.EventsRead) {
		return problem.ErrForbidden.WithDetail("topic %q needs %s", topic, scopes.EventsRead)
	}
	return nil
}
