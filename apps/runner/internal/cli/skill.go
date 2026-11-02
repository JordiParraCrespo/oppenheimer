package cli

import (
	_ "embed"
	"io"
)

// skillManual is what `runner --skill` prints: how an agent in a session
// starts, tells, hears from and waits on other agents on this host. Every
// session's note points its agent here, so the manual ships with the binary
// that answers the commands it describes.
//
//go:embed skill.md
var skillManual string

// Skill prints the agent manual.
func Skill(out io.Writer) error {
	_, err := io.WriteString(out, skillManual)
	return err
}
