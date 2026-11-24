package domain

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"time"
)

// BrowserPolicy is whether this host lets bots drive a browser of their own
// on it (`browser.act`, 25 §4.2). Like ComputerPolicy it is the host's own
// setting, in a file the control plane never reads or writes: a browser here
// reaches whatever this machine reaches, its local network included.
type BrowserPolicy struct {
	Enabled bool `json:"enabled"`
}

// BrowserAction is what one `browser.act` does before the page is read.
type BrowserAction string

// The actions, as the protocol names them.
const (
	BrowserOpen       BrowserAction = "open"
	BrowserRead       BrowserAction = "read"
	BrowserScreenshot BrowserAction = "screenshot"
	BrowserClick      BrowserAction = "click"
	BrowserType       BrowserAction = "type"
	BrowserKey        BrowserAction = "key"
	BrowserScroll     BrowserAction = "scroll"
	BrowserBack       BrowserAction = "back"
	BrowserWait       BrowserAction = "wait"
	BrowserClose      BrowserAction = "close"
)

// BrowserRequest is one action on the browser Browser names.
type BrowserRequest struct {
	// Browser is whose browser: one per bot, each with a profile of its own.
	Browser string
	Action  BrowserAction
	URL     string
	// Ref names an element of the last page answered; X and Y a point of its
	// picture, used when Ref is empty and Pointed is set.
	Ref     string
	X, Y    int
	Pointed bool
	ScrollY int
	Text    string
	Keys    []string
	Wait    time.Duration
	// Picture asks for a JPEG of the page with the answer, at most
	// PictureMaxBytes.
	Picture         bool
	PictureMaxBytes int
	// Limits on what the answer lists and quotes.
	MaxElements  int
	MaxTextBytes int
}

// BrowserElement is one thing on the page a bot can act on.
type BrowserElement struct {
	Ref   string
	Role  string
	Name  string
	Value string
}

// BrowserPage is the page after an action.
type BrowserPage struct {
	URL           string
	Title         string
	Elements      []BrowserElement
	MoreElements  bool
	Text          string
	TextTruncated bool
	// JPEG is the page's picture when the request asked for one.
	JPEG []byte
	// Closed is set, alone, after BrowserClose.
	Closed bool
}

// The reasons an action is refused, or a browser cannot be used.
var (
	ErrBrowserActionUnknown = errors.New("unknown action")
	ErrBrowserActionShape   = errors.New("the action does not fit")
	// ErrBrowserRef is a ref the page no longer has: it changed since the
	// answer that listed it.
	ErrBrowserRef = errors.New("no such element on the page now")
	// ErrBrowserNotOpen is an action on a browser that has no page yet.
	ErrBrowserNotOpen = errors.New("the browser has no page open")
	// ErrNoBrowser is a host with no Chrome or Chromium the runner can start.
	ErrNoBrowser = errors.New("no browser to start")
)

var (
	browserIDPattern  = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,63}$`)
	browserRefPattern = regexp.MustCompile(`^e[1-9][0-9]{0,3}$`)
)

// Validate checks the request: the action is known, it has what it needs,
// and an address is one a bot may open.
func (r BrowserRequest) Validate() error {
	if !browserIDPattern.MatchString(r.Browser) {
		return fmt.Errorf("%w: %q does not name a browser", ErrBrowserActionShape, r.Browser)
	}
	if r.Ref != "" && !browserRefPattern.MatchString(r.Ref) {
		return fmt.Errorf("%w: %q is not a ref", ErrBrowserActionShape, r.Ref)
	}
	switch r.Action {
	case BrowserRead, BrowserScreenshot, BrowserBack, BrowserWait, BrowserClose:
		return nil
	case BrowserOpen:
		return validBrowserURL(r.URL)
	case BrowserClick:
		if r.Ref == "" && !r.Pointed {
			return fmt.Errorf("%w: click needs a ref, or x and y", ErrBrowserActionShape)
		}
		return nil
	case BrowserType:
		if r.Text == "" {
			return fmt.Errorf("%w: type needs text", ErrBrowserActionShape)
		}
		return nil
	case BrowserKey:
		if len(r.Keys) == 0 {
			return fmt.Errorf("%w: key needs keys", ErrBrowserActionShape)
		}
		for _, key := range r.Keys {
			if _, err := ParseKeyPress(key); err != nil {
				return err
			}
		}
		return nil
	case BrowserScroll:
		if r.ScrollY == 0 {
			return fmt.Errorf("%w: scroll needs scrollY", ErrBrowserActionShape)
		}
		return nil
	}
	return fmt.Errorf("%w %q", ErrBrowserActionUnknown, r.Action)
}

// validBrowserURL lets a bot open web pages only: never a file on the host,
// the browser's own pages, or a script.
func validBrowserURL(raw string) error {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return fmt.Errorf("%w: %q is not a web address", ErrBrowserActionShape, raw)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return fmt.Errorf("%w: only http and https addresses open, not %q", ErrBrowserActionShape, parsed.Scheme)
	}
	return nil
}
