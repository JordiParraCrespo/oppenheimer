package cli

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

// CredentialHelper implements git's credential protocol on stdin and stdout.
// git calls it whenever it needs a password; it asks the runner over the
// local Unix socket, and the runner answers with the short-lived installation
// token the control plane minted for that session's repository.
//
// Nothing is written to disk and nothing is passed on a command line. A
// runner that has no token — today, because the control-plane link is the
// next slice — answers nothing, which is how git's protocol says "I have no
// credentials for that"; git then falls back to whatever else is configured,
// exactly as it would with no helper at all.
func (a *App) CredentialHelper(ctx context.Context, operation string, in io.Reader, out io.Writer) error {
	request := map[string]string{}
	scanner := bufio.NewScanner(in)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			break
		}
		key, value, found := strings.Cut(line, "=")
		if found {
			request[key] = value
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	// `store` and `erase` are git telling us what it did with a credential.
	// The runner keeps nothing, so there is nothing to record or forget.
	if operation != "get" {
		return nil
	}
	request["session"] = os.Getenv("OPPENHEIMER_SESSION")

	credential, err := a.askForCredential(ctx, request)
	if err != nil || credential.Password == "" {
		// No token, or no runner listening: say nothing. git treats that as
		// "this helper has no credentials", which is the truth.
		return nil //nolint:nilerr // an empty answer is the protocol's "I have none"
	}
	_, err = fmt.Fprintf(out, "username=%s\npassword=%s\n", credential.Username, credential.Password)
	return err
}

type credential struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// askForCredential calls the running daemon over its Unix socket. The socket
// is 0600, so only this user's processes can ask — and a helper invoked from
// a shell outside a session sends no session id and gets nothing.
func (a *App) askForCredential(ctx context.Context, request map[string]string) (credential, error) {
	body, err := json.Marshal(request)
	if err != nil {
		return credential{}, err
	}
	client := &http.Client{
		Timeout: 5 * time.Second,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				return (&net.Dialer{}).DialContext(ctx, "unix", a.Paths.Socket())
			},
		},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "http://runner/v1/credentials", strings.NewReader(string(body)))
	if err != nil {
		return credential{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return credential{}, err
	}
	defer resp.Body.Close() //nolint:errcheck // read-only body
	if resp.StatusCode != http.StatusOK {
		return credential{}, fmt.Errorf("the runner has no credential for this request (%s)", resp.Status)
	}
	var out credential
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<16)).Decode(&out); err != nil {
		return credential{}, err
	}
	return out, nil
}
