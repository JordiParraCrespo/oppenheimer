package domain_test

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

var watchStart = time.Date(2026, 10, 29, 9, 0, 0, 0, time.UTC)

// pass is one scan of a screen, at an offset from watchStart, and the report
// it should make: wantReport false means none is due.
type pass struct {
	at         time.Duration
	screen     string
	wantReport bool
	wantCount  int
}

// A watch reports its first match at once, counts a line that stays on the
// screen once, holds what matches inside the quiet period and folds it into
// the next report, which goes out even on a pass with nothing new.
func TestAWatchCountsNewLinesAndReportsAtMostEveryFiveSeconds(t *testing.T) {
	cases := []struct {
		name   string
		passes []pass
	}{
		{
			name: "the first match is reported at once",
			passes: []pass{
				{at: 0, screen: "building\nerror: boom\n", wantReport: true, wantCount: 1},
			},
		},
		{
			name: "nothing matching is nothing to report",
			passes: []pass{
				{at: 0, screen: "all good\n", wantReport: false, wantCount: 0},
				{at: 10 * time.Second, screen: "still good\n", wantReport: false, wantCount: 0},
			},
		},
		{
			name: "a line that stays on screen is counted once",
			passes: []pass{
				{at: 0, screen: "error: boom\n", wantReport: true, wantCount: 1},
				{at: 6 * time.Second, screen: "error: boom\n", wantReport: false, wantCount: 1},
				{at: 12 * time.Second, screen: "error: boom   \nok\n", wantReport: false, wantCount: 1},
			},
		},
		{
			name: "matches inside the quiet period are held for the next report",
			passes: []pass{
				{at: 0, screen: "error: one\n", wantReport: true, wantCount: 1},
				{at: 2 * time.Second, screen: "error: one\nerror: two\n", wantReport: false, wantCount: 2},
				{at: 4 * time.Second, screen: "error: two\nerror: three\n", wantReport: false, wantCount: 3},
				{at: 5 * time.Second, screen: "nothing new\n", wantReport: true, wantCount: 3},
				{at: 7 * time.Second, screen: "error: four\n", wantReport: false, wantCount: 4},
				{at: 10 * time.Second, screen: "error: four\n", wantReport: true, wantCount: 4},
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			watch, err := domain.NewWatch("w-1", `^error:`)
			if err != nil {
				t.Fatal(err)
			}
			for i, p := range tc.passes {
				count, report := watch.Scan(p.screen, watchStart.Add(p.at))
				if report != p.wantReport || count != p.wantCount {
					t.Fatalf("pass %d: report=%v count=%d, want report=%v count=%d", i, report, count, p.wantReport, p.wantCount)
				}
			}
		})
	}
}

// After its hundredth report a watch is spent: it reports nothing more and
// the caller drops it.
func TestAWatchIsSpentAfterItsLastReport(t *testing.T) {
	watch, err := domain.NewWatch("w-1", `match`)
	if err != nil {
		t.Fatal(err)
	}
	at := watchStart
	for i := range domain.WatchReportsMax {
		if _, report := watch.Scan(fmt.Sprintf("match %d", i), at); !report {
			t.Fatalf("report %d was not made", i+1)
		}
		at = at.Add(domain.WatchReportEvery)
	}
	if !watch.Spent() {
		t.Fatal("the watch is not spent after its last report")
	}
	if _, report := watch.Scan("match again", at.Add(time.Hour)); report {
		t.Fatal("a spent watch reported")
	}
}

// The set of counted lines is bounded: past WatchSeenMax the oldest is
// forgotten, and counted again if it shows up again.
func TestAWatchRemembersABoundedNumberOfLines(t *testing.T) {
	watch, err := domain.NewWatch("w-1", `^line`)
	if err != nil {
		t.Fatal(err)
	}
	lines := make([]string, domain.WatchSeenMax+1)
	for i := range lines {
		lines[i] = fmt.Sprintf("line %d", i)
	}
	count, _ := watch.Scan(strings.Join(lines, "\n"), watchStart)
	if count != domain.WatchSeenMax+1 {
		t.Fatalf("count = %d, want %d", count, domain.WatchSeenMax+1)
	}
	if count, _ = watch.Scan("line 1", watchStart); count != domain.WatchSeenMax+1 {
		t.Fatalf("a line still remembered was counted again: %d", count)
	}
	if count, _ = watch.Scan("line 0", watchStart); count != domain.WatchSeenMax+2 {
		t.Fatalf("the forgotten oldest line was not counted again: %d", count)
	}
}

// A pattern that is empty, too long or not RE2 is refused with the
// protocol's INVALID_PATTERN.
func TestAnInvalidPatternIsRefused(t *testing.T) {
	for name, pattern := range map[string]string{
		"empty":     "",
		"too long":  strings.Repeat("a", domain.WatchPatternMax+1),
		"not RE2":   `(unclosed`,
		"lookahead": `foo(?=bar)`,
	} {
		t.Run(name, func(t *testing.T) {
			_, err := domain.NewWatch("w-1", pattern)
			if pe := problem.From(err); pe == nil || pe.Code != "INVALID_PATTERN" {
				t.Fatalf("err = %v, want INVALID_PATTERN", err)
			}
		})
	}
	if _, err := domain.NewWatch("w-1", strings.Repeat("a", domain.WatchPatternMax)); err != nil {
		t.Fatalf("a pattern at the bound was refused: %v", err)
	}
}
