// Package trace writes one session's start onto the record, in the same shape
// the console and the control plane write it.
//
// Start is three tiers, and until now only the host's own stages were timed
// (`session.step`). A host that had the agent answering in three seconds could
// therefore sit behind a console that showed nothing for thirty, with the gap in
// the tiers nobody was timing. Every tier now writes `[optrace] <epoch ms>
// <tier> <mark> <fields>`, so the three logs join into one ordered timeline on
// the session's id.
//
// Off unless OPPENHEIMER_TRACE=1. It is a debugging instrument, not telemetry:
// no sink, no sampling, nothing kept.
package trace

import (
	"fmt"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

var armed = sync.OnceValue(func() bool { return os.Getenv("OPPENHEIMER_TRACE") == "1" })

// Mark writes one mark. Fields are printed key=value, sorted, so two runs of the
// same mark read the same way.
func Mark(mark string, fields map[string]any) {
	if !armed() {
		return
	}
	keys := make([]string, 0, len(fields))
	for key := range fields {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	var b strings.Builder
	for _, key := range keys {
		fmt.Fprintf(&b, " %s=%v", key, fields[key])
	}
	fmt.Fprintf(os.Stderr, "[optrace] %d host %s%s\n", time.Now().UnixMilli(), mark, b.String())
}
