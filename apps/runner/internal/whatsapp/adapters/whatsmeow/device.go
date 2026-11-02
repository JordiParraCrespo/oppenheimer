// Package whatsmeow is the host's WhatsApp linked device on whatsmeow, the Go
// implementation of the WhatsApp Web multi-device protocol (mautrix's; the
// route OpenClaw takes with Baileys, its TypeScript twin). It is the only
// package that imports whatsmeow or the SQLite driver; internal/arch holds it
// to that.
//
// # What WhatsApp counts, and how this keeps a number safe
//
// A linked device has no published rate limit: what WhatsApp counts is the
// number, and the way it says "stop" is a 429 (`rate-overlimit`) on a send or,
// worse, a temporary or permanent ban of the number. So the budget is ours:
// domain.SendsPerMinute and domain.SendsPerDay per host, spent in the app
// layer before a send reaches this package, and a 429 refuses the send
// (WA_003, with WhatsApp's words) without a retry. Beyond the budget,
// the device behaves the way OpenClaw found keeps numbers alive:
//
//   - it never shows as online: presence is sent as unavailable on every
//     connect, and it never sends read receipts (nothing here marks read);
//   - it asks for no history and ignores what the phone sends anyway
//     (ManualHistorySyncDownload, events.HistorySync dropped), and the
//     domain drops anything sent before pairing or long before it arrived;
//   - status updates, broadcast lists and newsletters are never handed on;
//   - reconnects back off from 2 s to 30 s, and a logout is final.
package whatsmeow

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waCompanionReg"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/domain"
)

// DeviceName is how the device is listed under the phone's Linked devices.
const DeviceName = "Oppenheimer"

// maxReconnectErrors caps whatsmeow's linear backoff (2 s per failed attempt)
// at 30 s.
const maxReconnectErrors = 15

// groupNameTTL is how long a group's subject is trusted before it is read
// again: a rename shows within the hour.
const groupNameTTL = time.Hour

// Options are the device's settings.
type Options struct {
	// Dir is the WhatsApp state directory, ~/.oppenheimer/state/whatsapp.
	Dir    string
	Logger *slog.Logger
	// HTTPClient fetches the current WhatsApp Web version; nil is a default.
	HTTPClient *http.Client
}

// Device is app.Device and app.Outbox over one SQLite file.
type Device struct {
	opts   Options
	logger *slog.Logger

	mu        sync.Mutex
	db        *sql.DB
	container *sqlstore.Container
	client    *whatsmeow.Client
	events    app.Events
	outbox    *Outbox
	handler   uint32

	groups sync.Map // types.JID → groupName
}

type groupName struct {
	name string
	at   time.Time
}

var (
	_ app.Device = (*Device)(nil)
	_ app.Outbox = (*Device)(nil)
)

// New builds the device; nothing is opened until Open.
func New(opts Options) *Device {
	logger := opts.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return &Device{opts: opts, logger: logger}
}

func init() {
	// What the phone lists, and what this device asks of history: as little
	// as WhatsApp lets a companion ask for.
	store.DeviceProps.Os = proto.String(DeviceName)
	store.DeviceProps.PlatformType = waCompanionReg.DeviceProps_DESKTOP.Enum()
	store.DeviceProps.RequireFullSync = proto.Bool(false)
	if cfg := store.DeviceProps.HistorySyncConfig; cfg != nil {
		cfg.RecentSyncDaysLimit = proto.Uint32(1)
		cfg.StorageQuotaMb = proto.Uint32(1)
		cfg.SupportCallLogHistory = proto.Bool(false)
		cfg.SupportGroupHistory = proto.Bool(false)
	}
}

// Open opens the store, reads the stored device and starts the outbox.
func (d *Device) Open(ctx context.Context, listener app.Events) (app.Paired, error) {
	db, err := openDB(d.opts.Dir)
	if err != nil {
		return app.Paired{}, err
	}
	container := sqlstore.NewWithDB(db, "sqlite3", waLog.Noop)
	if err := container.Upgrade(ctx); err != nil {
		_ = db.Close()
		return app.Paired{}, fmt.Errorf("whatsapp store: %w", err)
	}
	outbox, err := newOutbox(ctx, db, d.logger)
	if err != nil {
		_ = db.Close()
		return app.Paired{}, err
	}
	d.refreshVersion(ctx)
	device, err := container.GetFirstDevice(ctx)
	if err != nil {
		_ = db.Close()
		return app.Paired{}, fmt.Errorf("whatsapp store: %w", err)
	}
	d.mu.Lock()
	d.db, d.container, d.events, d.outbox = db, container, listener, outbox
	d.useClientLocked(device)
	d.mu.Unlock()
	if device.ID == nil {
		return app.Paired{}, nil
	}
	return app.Paired{Phone: device.ID.ToNonAD().String(), Name: device.PushName}, nil
}

// refreshVersion asks WhatsApp Web which client version it serves, so a
// runner older than WhatsApp's floor is not refused as outdated. A failure
// keeps the version compiled in.
func (d *Device) refreshVersion(ctx context.Context) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	client := d.opts.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	version, err := whatsmeow.GetLatestVersion(ctx, client)
	if err != nil {
		d.logger.Debug("whatsapp: could not read the current web version; keeping the built-in one", slog.Any("error", err))
		return
	}
	store.SetWAVersion(*version)
}

// useClientLocked makes the client for device, replacing any earlier one.
func (d *Device) useClientLocked(device *store.Device) {
	if d.client != nil {
		d.client.RemoveEventHandler(d.handler)
		d.client.Disconnect()
	}
	client := whatsmeow.NewClient(device, waLog.Noop)
	client.ManualHistorySyncDownload = true
	client.EnableAutoReconnect = true
	client.AutoReconnectHook = func(error) bool {
		client.AutoReconnectErrors = min(client.AutoReconnectErrors, maxReconnectErrors)
		return true
	}
	d.client = client
	d.handler = client.AddEventHandler(d.onEvent)
}

func (d *Device) current() (*whatsmeow.Client, app.Events) {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.client, d.events
}

// Connect brings the stored device online; whatsmeow keeps it there.
func (d *Device) Connect(_ context.Context) error {
	client, _ := d.current()
	if client == nil {
		return errors.New("whatsapp store not open")
	}
	if client.Store.ID == nil {
		return errors.New("no device is paired")
	}
	return client.Connect()
}

// Pair makes a fresh device and waits for one of its QR codes to be scanned.
func (d *Device) Pair(ctx context.Context, onCode func(code string, expires time.Time)) (app.Paired, error) {
	d.mu.Lock()
	if d.container == nil {
		d.mu.Unlock()
		return app.Paired{}, errors.New("whatsapp store not open")
	}
	d.useClientLocked(d.container.NewDevice())
	client := d.client
	d.mu.Unlock()

	codes, err := client.GetQRChannel(ctx)
	if err != nil {
		return app.Paired{}, err
	}
	if err := client.Connect(); err != nil {
		return app.Paired{}, err
	}
	for item := range codes {
		switch item.Event {
		case whatsmeow.QRChannelEventCode:
			onCode(item.Code, time.Now().Add(item.Timeout).UTC())
		case whatsmeow.QRChannelSuccess.Event:
			if client.Store.ID == nil {
				return app.Paired{}, errors.New("paired, but WhatsApp named no device")
			}
			return app.Paired{Phone: client.Store.ID.ToNonAD().String(), Name: client.Store.PushName}, nil
		case whatsmeow.QRChannelEventError:
			client.Disconnect()
			return app.Paired{}, fmt.Errorf("pairing failed: %w", item.Error)
		default:
			// Timed out, scanned without multidevice, client outdated.
			client.Disconnect()
			return app.Paired{}, fmt.Errorf("pairing ended: %s", item.Event)
		}
	}
	client.Disconnect()
	return app.Paired{}, errors.New("pairing ended")
}

// Logout removes the device from the phone and deletes its keys; when
// WhatsApp cannot be told, the keys are deleted anyway, and the phone drops
// the device once it stops answering.
func (d *Device) Logout(ctx context.Context) error {
	client, _ := d.current()
	if client == nil || client.Store.ID == nil {
		return nil
	}
	err := client.Logout(ctx)
	if err != nil {
		client.Disconnect()
		if deleteErr := client.Store.Delete(ctx); deleteErr != nil {
			return errors.Join(err, deleteErr)
		}
	}
	d.mu.Lock()
	if d.container != nil {
		d.useClientLocked(d.container.NewDevice())
	}
	d.mu.Unlock()
	return err
}

// Send sends a text message.
func (d *Device) Send(ctx context.Context, chatID, text string) (string, time.Time, error) {
	client, _ := d.current()
	if client == nil || !client.IsLoggedIn() {
		return "", time.Time{}, domain.ErrNotConnected
	}
	to, err := types.ParseJID(chatID)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("not a WhatsApp chat: %w", err)
	}
	resp, err := client.SendMessage(ctx, to, &waE2E.Message{Conversation: proto.String(text)})
	if errors.Is(err, whatsmeow.ErrIQRateOverLimit) || (err != nil && strings.Contains(err.Error(), "rate-overlimit")) {
		return "", time.Time{}, fmt.Errorf("%w: %w", domain.ErrRateLimited, err)
	}
	if err != nil {
		return "", time.Time{}, err
	}
	return resp.ID, resp.Timestamp, nil
}

// Close disconnects and closes the file.
func (d *Device) Close() {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.client != nil {
		d.client.Disconnect()
	}
	if d.db != nil {
		_ = d.db.Close()
	}
}

/* ---------------------------------------------------------------- the outbox, on the same file */

func (d *Device) box() (*Outbox, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.outbox == nil {
		return nil, errors.New("whatsapp store not open")
	}
	return d.outbox, nil
}

// Put keeps a message for the control plane.
func (d *Device) Put(ctx context.Context, message domain.Inbound) error {
	box, err := d.box()
	if err != nil {
		return err
	}
	return box.Put(ctx, message)
}

// Pending is what waits for the control plane, oldest first.
func (d *Device) Pending(ctx context.Context, limit int) ([]domain.Inbound, error) {
	box, err := d.box()
	if err != nil {
		return nil, err
	}
	return box.Pending(ctx, limit)
}

// Ack forgets what the control plane stored.
func (d *Device) Ack(ctx context.Context, keys []string) error {
	box, err := d.box()
	if err != nil {
		return err
	}
	return box.Ack(ctx, keys)
}

// Clear forgets everything waiting for the control plane.
func (d *Device) Clear(ctx context.Context) error {
	box, err := d.box()
	if err != nil {
		return err
	}
	return box.Clear(ctx)
}

/* ---------------------------------------------------------------- events */

func (d *Device) onEvent(raw any) {
	client, listener := d.current()
	if listener == nil || client == nil {
		return
	}
	switch evt := raw.(type) {
	case *events.Message:
		listener.Received(received(evt, clientNames{d: d, client: client}))
	case *events.Connected:
		// Never online: presence is what makes a linked device look like a
		// person at a keyboard, and a bot that never sleeps is what gets
		// numbers flagged.
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			_ = client.SendPresence(ctx, types.PresenceUnavailable)
		}()
		phone, name := "", client.Store.PushName
		if client.Store.ID != nil {
			phone = client.Store.ID.ToNonAD().String()
		}
		listener.Connected(phone, name)
	case *events.Disconnected, *events.KeepAliveTimeout:
		listener.Disconnected()
	case *events.LoggedOut:
		// whatsmeow has already deleted the keys.
		listener.LoggedOut("logged out: " + evt.Reason.String())
	case *events.StreamReplaced:
		// Another process opened the same keys: whatsmeow stops; so does this.
		listener.LoggedOut("another process opened this device")
	case *events.TemporaryBan:
		listener.LoggedOut("WhatsApp banned the number for now: " + evt.String())
	case *events.ClientOutdated:
		listener.Disconnected()
	case *events.HistorySync:
		// Asked for none; dropped unread.
	}
}

// clientNames reads names off the client's store and, for groups, WhatsApp.
type clientNames struct {
	d      *Device
	client *whatsmeow.Client
}

func (n clientNames) chatName(chat types.JID) string {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	chat = chat.ToNonAD()
	if chat.Server == types.GroupServer {
		if cached, ok := n.d.groups.Load(chat); ok {
			if g := cached.(groupName); time.Since(g.at) < groupNameTTL {
				return g.name
			}
		}
		info, err := n.client.GetGroupInfo(ctx, chat)
		if err != nil || info == nil {
			return ""
		}
		n.d.groups.Store(chat, groupName{name: info.Name, at: time.Now()})
		return info.Name
	}
	contact, err := n.client.Store.Contacts.GetContact(ctx, chat)
	if err != nil || !contact.Found {
		return ""
	}
	for _, name := range []string{contact.FullName, contact.FirstName, contact.BusinessName, contact.PushName} {
		if name != "" {
			return name
		}
	}
	return ""
}
