package domain

// SlashCommand is a command the session's agent takes as `/<Name>`, offered
// by the chat composer's `/` menu: one of the project's skills or commands.
type SlashCommand struct {
	Name        string
	Kind        SlashCommandKind
	Description string
}

// SlashCommandKind is where a SlashCommand comes from.
type SlashCommandKind string

// The kinds of SlashCommand.
const (
	// SlashCommandSkill is `.claude/skills/<name>/SKILL.md`.
	SlashCommandSkill SlashCommandKind = "skill"
	// SlashCommandCommand is `.claude/commands/<name>.md`.
	SlashCommandCommand SlashCommandKind = "command"
)
