package cli

// `browser.act`: a bot driving a browser of its own on this host (25 §4.2,
// "Using a browser"), through the host service, which reads this host's own
// setting first. Answered with `browser.page`, or `command.failed` with a
// BROWSER_* code.

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

// laneBrowser prefixes the lane of one bot's browser.
const laneBrowser = "browser:"

// The limits of one `browser.page`, as packages/shared's browserPageSchema
// states them. They do not bound the frame: JSON writes some characters as
// six bytes, so fitBrowserPage trims a page that came out too large.
const (
	browserElementsMax = 150
	browserTextMax     = 24 << 10
)

func (h *linkHandler) browserAct(ctx context.Context, m link.BrowserAct) {
	if left, ok := h.pages.get(m.CommandID); ok {
		_ = h.client.Send(left)
		return
	}
	page, err := h.app.Host.Browser(ctx, hostdomain.BrowserRequest{
		Browser: m.Browser, Action: hostdomain.BrowserAction(m.Action),
		URL: m.URL, Ref: m.Ref, X: m.X, Y: m.Y,
		// A click with no ref points at (x, y): the wire leaves a zero out,
		// so the top left corner is a point like any other.
		Pointed: m.Ref == "" && m.Action == string(hostdomain.BrowserClick),
		ScrollY: m.ScrollY, Text: m.Text, Keys: m.Keys,
		Wait:    time.Duration(m.Seconds) * time.Second,
		Picture: m.Picture, PictureMaxBytes: link.ComputerScreenshotMaxBytes,
		MaxElements: browserElementsMax, MaxTextBytes: browserTextMax,
	})
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	left := link.BrowserPage{
		Type: link.TypeBrowserPage, CommandID: m.CommandID,
		URL: cutTo(page.URL, 2048), Title: page.Title, MoreElements: page.MoreElements,
		Text: page.Text, TextTruncated: page.TextTruncated, Closed: page.Closed,
	}
	for _, element := range page.Elements {
		left.Elements = append(left.Elements, link.BrowserPageElements{
			Ref: element.Ref, Role: cutTo(element.Role, 32), Name: element.Name, Value: element.Value,
		})
	}
	if len(page.JPEG) > 0 {
		left.Image = base64.StdEncoding.EncodeToString(page.JPEG)
	}
	if !fitBrowserPage(&left, link.MaxFrameBytes) {
		h.fail(m.CommandID, hostdomain.ErrBrowserFailed.WithDetail("the page is too large to send, even cut down"))
		return
	}
	h.pages.putWithin(m.CommandID, left, shotsRemembered)
	if err := h.client.Send(left); err != nil {
		h.fail(m.CommandID, hostdomain.ErrBrowserFailed.WithDetail("the page could not be sent: %v", err))
	}
}

// fitBrowserPage trims page until it is a frame of at most limit bytes: its
// text first, by halves, then its elements, each cut marked the way a longer
// page is. It answers false when even the bare page does not fit.
func fitBrowserPage(page *link.BrowserPage, limit int) bool {
	for {
		body, err := json.Marshal(page)
		if err != nil {
			return false
		}
		if len(body) <= limit {
			return true
		}
		switch {
		case page.Text != "":
			page.Text = strings.ToValidUTF8(page.Text[:len(page.Text)/2], "")
			page.TextTruncated = true
		case len(page.Elements) > 0:
			page.Elements = page.Elements[:len(page.Elements)/2]
			page.MoreElements = true
		default:
			return false
		}
	}
}

// cutTo keeps the first max bytes of text: the link's schema bounds it.
func cutTo(text string, max int) string {
	if len(text) <= max {
		return text
	}
	return text[:max]
}
