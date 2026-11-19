package app

import (
	"context"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// The poll loop's steps that keep, on each session, the conversation its
// agent is in: the name the CLI gave a teleported one, the one an agent that
// serves its conversation was last heard in, and the one an agent reports
// moving to. What the session holds is what its questions, its first
// message and a Restart read.

// FindTeleported is the poll loop's step for a session that continues a
// cloud one: Claude Code names the teleported conversation itself, so the
// newest transcript in the session's folder since the agent opened it is
// taken as the session's conversation, and kept. From then on the chat
// view, question detection and the status line read it by that name, as
// they read any other session's.
func (s *Service) FindTeleported() {
	if s.transcripts == nil {
		return
	}
	s.mu.Lock()
	var waiting []domain.Session
	for _, session := range s.sessions {
		if session.State.Live() && session.Launch.Teleport != "" && session.Launch.Conversation == "" {
			waiting = append(waiting, session.Clone())
		}
	}
	s.mu.Unlock()
	for _, session := range waiting {
		since := session.Launch.TeleportSince
		if since.IsZero() {
			since = session.Created
		}
		conversation := s.transcripts.Teleported(session.Agent, session.Cwd(), since)
		if conversation == "" {
			continue
		}
		s.commit(session.ID, func(cur domain.Session, known bool) (domain.Session, bool) {
			if !known || cur.Launch.Teleport == "" || cur.Launch.Conversation != "" {
				return cur, false
			}
			cur.Launch.Conversation = conversation
			return cur, true
		})
	}
}

// FindServedConversations is the poll loop's step for a session whose agent
// serves its conversation (OpenCode): the conversation its own process was
// last heard working in is kept on the session, so its chat shows that one,
// not another OpenCode's in the same folder, whenever it is opened, and after
// the runner restarts.
func (s *Service) FindServedConversations(ctx context.Context) {
	if s.transcripts == nil {
		return
	}
	s.mu.Lock()
	var served []domain.Session
	for _, session := range s.sessions {
		if session.State.Live() && session.Agent.ServesConversation() && session.Launch.Server != nil {
			served = append(served, session.Clone())
		}
	}
	s.mu.Unlock()
	for _, session := range served {
		conversation := s.transcripts.ServedConversation(ctx, session)
		if conversation == "" || conversation == session.Launch.Server.Conversation {
			continue
		}
		password := session.Launch.Server.Password
		s.commit(session.ID, func(cur domain.Session, known bool) (domain.Session, bool) {
			// A restart since launched another process, which is asked anew.
			if !known || cur.Launch.Server == nil || cur.Launch.Server.Password != password ||
				cur.Launch.Server.Conversation == conversation {
				return cur, false
			}
			server := *cur.Launch.Server
			server.Conversation = conversation
			cur.Launch.Server = &server
			return cur, true
		})
	}
}

// FindReportedConversations is the poll loop's step for a session whose
// agent says which conversation it is in (Claude Code, through the runner's
// status line): `/clear`, `/resume` or a resume that forks moves the agent
// to a conversation of another name, and the session keeps that one, so its
// questions, its first message and a Restart all read the conversation the
// person is in, not the one it was launched in. A session still looking for
// its teleported conversation is FindTeleported's.
func (s *Service) FindReportedConversations() {
	if s.transcripts == nil {
		return
	}
	s.mu.Lock()
	var named []domain.Session
	for _, session := range s.sessions {
		if session.State.Live() && session.Launch.Conversation != "" {
			named = append(named, session.Clone())
		}
	}
	s.mu.Unlock()
	for _, session := range named {
		moved := s.movedConversation(session)
		if moved == "" {
			continue
		}
		s.commit(session.ID, func(cur domain.Session, known bool) (domain.Session, bool) {
			if !known || cur.Launch.Conversation == "" || cur.Launch.Conversation == moved {
				return cur, false
			}
			cur.Launch.Conversation = moved
			return cur, true
		})
	}
}

// movedConversation is the conversation the session's agent is in now
// (Transcripts.CurrentConversation) when it is not the one the session
// holds, or "".
func (s *Service) movedConversation(session domain.Session) string {
	if s.transcripts == nil || session.Launch.Conversation == "" {
		return ""
	}
	if current := s.transcripts.CurrentConversation(session); current != session.Launch.Conversation {
		return current
	}
	return ""
}
