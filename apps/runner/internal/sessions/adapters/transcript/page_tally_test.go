package transcript

import (
	"slices"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
)

// What a page of a conversation holds and where it ends, decided by
// pageTally with no file read: the rules readPage feeds whole lines to.

func entries(texts ...string) [][]byte {
	out := make([][]byte, 0, len(texts))
	for _, text := range texts {
		out = append(out, []byte(text))
	}
	return out
}

func tallyReq(limit, bytesMax, entryMax int) app.TranscriptPageRequest {
	return app.TranscriptPageRequest{Limit: limit, BytesMax: bytesMax, EntryMax: entryMax}
}

// A line whose entries would take the page past its bounds ends it: nothing
// of it is placed and the page ends before it. Regression: the page kept
// part of a line, or its cursor moved past a line whose entries were on no
// page.
func TestALineThatDoesNotFitEndsThePageBeforeIt(t *testing.T) {
	for name, req := range map[string]app.TranscriptPageRequest{
		"the entry limit": tallyReq(2, 1<<10, 1<<10),
		"the byte bound":  tallyReq(10, 6, 1<<10),
	} {
		t.Run(name, func(t *testing.T) {
			p := newPageTally(100, req)
			if !p.line(entries("aaa"), false, 10, false) {
				t.Fatal("the first line was refused")
			}
			if p.line(entries("bbb", "ccc"), false, 20, false) {
				t.Fatal("a line past the page's bounds joined it")
			}
			if !slices.Equal(p.entries, []string{"aaa"}) || p.next != 110 || p.dropped != 0 {
				t.Fatalf("page = %v, next %d, dropped %d", p.entries, p.next, p.dropped)
			}
		})
	}
}

// The first line always joins, what of it does not fit counted as dropped,
// so a cursor always moves. Regression: a page whose first line was too big
// for it ended where it started, and every read after it asked again.
func TestThePagesFirstLineAlwaysJoinsIt(t *testing.T) {
	p := newPageTally(0, tallyReq(1, 1<<10, 1<<10))
	if !p.line(entries("aaa", "bbb"), false, 8, false) {
		t.Fatal("the first line was refused")
	}
	if !slices.Equal(p.entries, []string{"aaa"}) || p.dropped != 1 || p.next != 8 {
		t.Fatalf("page = %v, dropped %d, next %d", p.entries, p.dropped, p.next)
	}
}

// An entry over the most one may take, and a line too long to read, are
// left out and counted, and the page reads on past them. Regression: one
// screenshot's line ended the page, or was left out without a word.
func TestAnEntryOrLineTooBigIsDroppedAndThePageReadsOn(t *testing.T) {
	p := newPageTally(0, tallyReq(10, 1<<10, 4))
	p.line(entries("aaa", "far too big"), false, 5, false)
	p.line(nil, true, 1<<20, false)
	if !p.line(entries("bbb"), false, 4, false) {
		t.Fatal("the line after a dropped one was refused")
	}
	if !slices.Equal(p.entries, []string{"aaa", "bbb"}) || p.dropped != 2 || p.next != 5+1<<20+4 {
		t.Fatalf("page = %v, dropped %d, next %d", p.entries, p.dropped, p.next)
	}
}

// What the transcriber still holds when the page ends is not on it: the
// page goes back to the last line that left it holding nothing, entries,
// bytes, drops and cursor alike. Regression: a reply still being written
// was cut in two, and the next page, read with a fresh transcriber, lost
// its first chunks.
func TestAPageEndsWhereTheTranscriberLastHeldNothing(t *testing.T) {
	p := newPageTally(0, tallyReq(10, 1<<10, 4))
	p.line(entries("aaa"), false, 4, false)
	p.line(entries("bbb", "far too big"), false, 4, true)
	p.line(nil, false, 4, true)
	if p.finish(true, true) {
		t.Fatal("a page that settled after its start is partial")
	}
	if !slices.Equal(p.entries, []string{"aaa"}) || p.bytes != 3 || p.dropped != 0 || p.next != 4 {
		t.Fatalf("page = %v, bytes %d, dropped %d, next %d", p.entries, p.bytes, p.dropped, p.next)
	}
}

// A page held since its start and cut by its bounds moves on, said
// partial. Regression: the page went back to its start, so the next read
// asked for the same page again and never got past it.
func TestAPageHeldSinceItsStartAndCutMovesOnPartial(t *testing.T) {
	p := newPageTally(50, tallyReq(10, 1<<10, 1<<10))
	p.line(nil, false, 4, true)
	p.line(nil, false, 4, true)
	if partial := p.finish(true, false); !partial || p.next != 58 {
		t.Fatalf("partial %v, next %d, want a partial page ending at 58", partial, p.next)
	}

	// At the end of what is written it waits instead: the reply is whole only
	// once the file goes quiet.
	p = newPageTally(50, tallyReq(10, 1<<10, 1<<10))
	p.line(nil, false, 4, true)
	if p.finish(true, true) || p.next != 50 {
		t.Fatalf("a page held at the end moved to %d", p.next)
	}
}

// A quiet reply that does not fit beside what the page holds goes back to
// where the page last settled, and the page is full. Regression (947d5e61):
// quiet emptied the transcriber, the page refused the reply for its bounds,
// and the cursor still moved past its lines, so it was on no page.
func TestAQuietReplyThatDoesNotFitGoesBackToTheSettledPoint(t *testing.T) {
	p := newPageTally(0, tallyReq(2, 1<<10, 1<<10))
	p.line(entries("aaa"), false, 4, false)
	p.line(nil, false, 4, true)
	p.line(nil, false, 4, true)
	if p.quiet(entries("reply", "more"), false) {
		t.Fatal("a reply past the page's bounds was placed")
	}
	if p.finish(false, false) || !slices.Equal(p.entries, []string{"aaa"}) || p.next != 4 {
		t.Fatalf("page = %v, next %d, want it to end before the reply", p.entries, p.next)
	}
}

// On a page with nothing else on it, a quiet reply is placed as far as it
// fits and settles the page: going back would leave it empty forever.
// Regression: a reply bigger than a page was never read.
func TestAQuietReplyOnAnEmptyPageIsPlacedAsFarAsItFits(t *testing.T) {
	p := newPageTally(0, tallyReq(1, 1<<10, 1<<10))
	p.line(nil, false, 4, true)
	if !p.quiet(entries("reply", "more"), false) {
		t.Fatal("the reply was refused on an empty page")
	}
	if p.finish(false, true) || !slices.Equal(p.entries, []string{"reply"}) || p.dropped != 1 || p.next != 4 {
		t.Fatalf("page = %v, dropped %d, next %d", p.entries, p.dropped, p.next)
	}
}
