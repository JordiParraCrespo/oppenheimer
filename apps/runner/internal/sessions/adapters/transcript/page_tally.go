package transcript

import "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"

// pageTally is a page of a conversation as it is read (`page.go`): what it
// holds, and where it ends. It decides what a page is, with nothing read
// from a file: each whole line's entries join it or end it, and a
// transcriber that holds lines back (Grok's) is followed by where it last
// held nothing, settled, which is where the page goes back to when what it
// holds cannot be placed.
type pageTally struct {
	req   app.TranscriptPageRequest
	start int64

	entries []string
	bytes   int
	dropped int
	next    int64
	// lines is how many whole lines have joined the page.
	lines int

	// settled is the page as it stood after the last line that left the
	// transcriber holding nothing.
	settled tallyMark
}

// tallyMark is how far a pageTally had got: its entries are the first
// entries of the page's.
type tallyMark struct {
	entries, bytes, dropped int
	next                    int64
}

// newPageTally is an empty page that starts at start, settled there.
func newPageTally(start int64, req app.TranscriptPageRequest) *pageTally {
	return &pageTally{req: req, start: start, entries: []string{}, next: start, settled: tallyMark{next: start}}
}

// fits is whether out would join the page whole within its bounds.
func (p *pageTally) fits(out [][]byte) bool {
	n, size := len(p.entries), p.bytes
	for _, entry := range out {
		if len(entry) > 0 && len(entry) <= p.req.EntryMax {
			n++
			size += len(entry)
		}
	}
	return n <= p.req.Limit && size <= p.req.BytesMax
}

// take adds out to the page, as much of it as fits; the rest is dropped.
func (p *pageTally) take(out [][]byte) {
	for _, entry := range out {
		switch {
		case len(entry) == 0:
		case len(entry) > p.req.EntryMax, len(p.entries) >= p.req.Limit, p.bytes+len(entry) > p.req.BytesMax:
			p.dropped++
		default:
			p.entries = append(p.entries, string(entry))
			p.bytes += len(entry)
		}
	}
}

// line places one whole line of size bytes in the file, whose entries are
// out, or a long one (read past, not transcribed), which is dropped. False,
// and nothing placed, when its entries would take the page past its bounds,
// though never for the page's first line, so a cursor always moves. holds is
// whether the transcriber still holds lines back once it read this one;
// a line that leaves it holding nothing settles the page.
func (p *pageTally) line(out [][]byte, long bool, size int64, holds bool) bool {
	if p.lines > 0 && !p.fits(out) {
		return false
	}
	p.take(out)
	if long {
		p.dropped++
	}
	p.next += size
	p.lines++
	if !holds {
		p.settle()
	}
	return true
}

// quiet places what the transcriber gave up once the file went quiet, out,
// after which it holds what holds says. What does not fit beside entries
// already on the page is not placed: quiet has emptied the transcriber, so
// the page goes back to where it last settled and the next page reads those
// lines again whole. False then, and the page is full.
func (p *pageTally) quiet(out [][]byte, holds bool) bool {
	if len(out) > 0 && !p.fits(out) && len(p.entries) > 0 {
		p.rollback()
		return false
	}
	p.take(out)
	if !holds {
		p.settle()
	}
	return true
}

// finish ends the page once its last line is read, with the transcriber
// holding what holds says and atEnd whether the read reached the end of
// what is written. What it still holds is not on the page, which goes back
// to where it last settled, so the next page reads those lines again; but a
// page held since its start and cut by its bounds moves on, and finish says
// it is partial: what was held is not placed.
func (p *pageTally) finish(holds, atEnd bool) (partial bool) {
	if !holds {
		return false
	}
	if p.settled.next > p.start || atEnd {
		p.rollback()
		return false
	}
	return true
}

// settle marks the page as it stands as the point to go back to.
func (p *pageTally) settle() {
	p.settled = tallyMark{entries: len(p.entries), bytes: p.bytes, dropped: p.dropped, next: p.next}
}

// rollback puts the page back where it last settled. The entries past that
// point are cut with their capacity, so nothing appended later reuses them.
func (p *pageTally) rollback() {
	s := p.settled
	p.entries = p.entries[:s.entries:s.entries]
	p.bytes, p.dropped, p.next = s.bytes, s.dropped, s.next
}
