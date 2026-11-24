package domain

import (
	"errors"
	"testing"
)

// What a bot may open is the web: a file on the host or the browser's own
// pages would read the machine, not a site.
func TestBrowserRequestValidate(t *testing.T) {
	cases := []struct {
		name string
		req  BrowserRequest
		want error
	}{
		{"open a site", BrowserRequest{Action: BrowserOpen, URL: "https://example.com/a?b=1"}, nil},
		{"open a local dev server", BrowserRequest{Action: BrowserOpen, URL: "http://localhost:5173"}, nil},
		{"open a file", BrowserRequest{Action: BrowserOpen, URL: "file:///etc/passwd"}, ErrBrowserActionShape},
		{"open the browser's settings", BrowserRequest{Action: BrowserOpen, URL: "chrome://settings"}, ErrBrowserActionShape},
		{"open a script", BrowserRequest{Action: BrowserOpen, URL: "javascript:alert(1)"}, ErrBrowserActionShape},
		{"open nothing", BrowserRequest{Action: BrowserOpen}, ErrBrowserActionShape},
		{"click a ref", BrowserRequest{Action: BrowserClick, Ref: "e12"}, nil},
		{"click a point", BrowserRequest{Action: BrowserClick, Pointed: true}, nil},
		{"click nothing", BrowserRequest{Action: BrowserClick}, ErrBrowserActionShape},
		{"a ref that is not one", BrowserRequest{Action: BrowserClick, Ref: "#submit"}, ErrBrowserActionShape},
		{"type with no text", BrowserRequest{Action: BrowserType, Ref: "e1"}, ErrBrowserActionShape},
		{"key that is a word", BrowserRequest{Action: BrowserKey, Keys: []string{"ctrl+banana"}}, ErrComputerKey},
		{"scroll nowhere", BrowserRequest{Action: BrowserScroll}, ErrBrowserActionShape},
		{"unknown action", BrowserRequest{Action: "download"}, ErrBrowserActionUnknown},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			c.req.Browser = "juno-3f2a"
			if err := c.req.Validate(); !errors.Is(err, c.want) {
				t.Fatalf("Validate = %v, want %v", err, c.want)
			}
		})
	}
	if err := (BrowserRequest{Browser: "../other", Action: BrowserRead}).Validate(); !errors.Is(err, ErrBrowserActionShape) {
		t.Fatalf("a browser named as a path = %v, want ErrBrowserActionShape", err)
	}
}
