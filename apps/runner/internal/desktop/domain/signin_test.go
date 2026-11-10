package domain_test

import (
	"bytes"
	"crypto/aes"
	"crypto/md5" //nolint:gosec // the server half of Apple's sign-in, as the protocol defines it
	"crypto/rand"
	"encoding/binary"
	"errors"
	"io"
	"math/big"
	"net"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/desktop/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// isCode is whether err is the catalog entry want, detail and all.
func isCode(err error, want *problem.Error) bool {
	var prob *problem.Error
	return errors.As(err, &prob) && prob.Code == want.Code
}

// serve runs script as the screen-sharing server on one end of a pipe and
// SignIn on the other, and returns SignIn's error and the script's.
func serve(t *testing.T, creds domain.Credentials, script func(server net.Conn) error) (error, error) {
	t.Helper()
	client, server := net.Pipe()
	scripted := make(chan error, 1)
	go func() {
		err := script(server)
		_ = server.Close()
		scripted <- err
	}()
	err := domain.SignIn(client, creds, rand.Reader)
	_ = client.Close()
	return err, <-scripted
}

func expect(r io.Reader, want []byte) error {
	got := make([]byte, len(want))
	if _, err := io.ReadFull(r, got); err != nil {
		return err
	}
	if !bytes.Equal(got, want) {
		return errors.New("unexpected bytes: " + string(got))
	}
	return nil
}

func TestSignInTakesNoneOnRFB38AndReadsItsResult(t *testing.T) {
	err, serverErr := serve(t, domain.Credentials{}, func(s net.Conn) error {
		_, _ = s.Write([]byte("RFB 003.008\n"))
		if err := expect(s, []byte("RFB 003.008\n")); err != nil {
			return err
		}
		_, _ = s.Write([]byte{2, 2, 1}) // VNC auth and None: None wins
		if err := expect(s, []byte{1}); err != nil {
			return err
		}
		_, _ = s.Write([]byte{0, 0, 0, 0})
		return nil
	})
	if err != nil || serverErr != nil {
		t.Fatalf("sign-in = %v, server = %v", err, serverErr)
	}
}

func TestSignInAnswersAppleWithTheThreeEightHandshake(t *testing.T) {
	// macOS Screen Sharing names 3.889; a 3.7 reply would end the handshake.
	err, serverErr := serve(t, domain.Credentials{}, func(s net.Conn) error {
		_, _ = s.Write([]byte("RFB 003.889\n"))
		if err := expect(s, []byte("RFB 003.008\n")); err != nil {
			return err
		}
		_, _ = s.Write([]byte{1, 1})
		if err := expect(s, []byte{1}); err != nil {
			return err
		}
		_, _ = s.Write([]byte{0, 0, 0, 0})
		return nil
	})
	if err != nil || serverErr != nil {
		t.Fatalf("sign-in = %v, server = %v", err, serverErr)
	}
}

func TestSignInOnRFB33WithNoneReadsNoResult(t *testing.T) {
	err, serverErr := serve(t, domain.Credentials{}, func(s net.Conn) error {
		_, _ = s.Write([]byte("RFB 003.003\n"))
		if err := expect(s, []byte("RFB 003.003\n")); err != nil {
			return err
		}
		_, _ = s.Write([]byte{0, 0, 0, 1})
		return nil
	})
	if err != nil || serverErr != nil {
		t.Fatalf("sign-in = %v, server = %v", err, serverErr)
	}
}

func TestSignInWithAVNCPasswordAnswersTheChallengeAndSurfacesARefusal(t *testing.T) {
	err, serverErr := serve(t, domain.Credentials{Password: "hunter2"}, func(s net.Conn) error {
		_, _ = s.Write([]byte("RFB 003.008\n"))
		if err := expect(s, []byte("RFB 003.008\n")); err != nil {
			return err
		}
		_, _ = s.Write([]byte{1, 2})
		if err := expect(s, []byte{2}); err != nil {
			return err
		}
		_, _ = s.Write(make([]byte, 16))
		response := make([]byte, 16)
		if _, err := io.ReadFull(s, response); err != nil {
			return err
		}
		if bytes.Equal(response, make([]byte, 16)) {
			return errors.New("the response is the challenge unencrypted")
		}
		reason := "Authentication failed"
		_, _ = s.Write([]byte{0, 0, 0, 1})
		_ = binary.Write(s, binary.BigEndian, uint32(len(reason)))
		_, _ = s.Write([]byte(reason))
		return nil
	})
	if serverErr != nil {
		t.Fatal(serverErr)
	}
	if !isCode(err, domain.ErrRefused) || !strings.Contains(err.Error(), "Authentication failed") {
		t.Fatalf("sign-in = %v, want DESKTOP_003 with the server's reason", err)
	}
}

func TestSignInWithoutAPasswordSaysHowToGiveOne(t *testing.T) {
	err, _ := serve(t, domain.Credentials{}, func(s net.Conn) error {
		_, _ = s.Write([]byte("RFB 003.008\n"))
		_ = expect(s, []byte("RFB 003.008\n"))
		_, _ = s.Write([]byte{1, 2})
		return nil
	})
	if !isCode(err, domain.ErrRefused) || !strings.Contains(err.Error(), "--password-file") {
		t.Fatalf("sign-in = %v, want DESKTOP_003 naming --password-file", err)
	}
}

func TestSignInRefusesAPortThatDoesNotSpeakRFB(t *testing.T) {
	err, _ := serve(t, domain.Credentials{}, func(s net.Conn) error {
		_, _ = s.Write([]byte("HTTP/1.1 400"))
		return nil
	})
	if !isCode(err, domain.ErrUnreachable) {
		t.Fatalf("sign-in = %v, want DESKTOP_002", err)
	}
}

func TestSignInToAppleRemoteDesktopSealsTheAccountForTheServer(t *testing.T) {
	creds := domain.Credentials{Username: "jordi", Password: "correct horse"}
	var gotUser, gotPassword string
	err, serverErr := serve(t, creds, func(s net.Conn) error {
		_, _ = s.Write([]byte("RFB 003.889\n"))
		if err := expect(s, []byte("RFB 003.008\n")); err != nil {
			return err
		}
		_, _ = s.Write([]byte{2, 30, 2})
		if err := expect(s, []byte{30}); err != nil {
			return err
		}
		// The server's half of the exchange, on a small safe prime.
		const keyLength = 16
		prime, _ := new(big.Int).SetString("ffffffffffffffffffffffffffffff61", 16)
		private := big.NewInt(0x1234567)
		public := new(big.Int).Exp(big.NewInt(2), private, prime)
		_ = binary.Write(s, binary.BigEndian, struct{ G, L uint16 }{2, keyLength})
		_, _ = s.Write(prime.FillBytes(make([]byte, keyLength)))
		_, _ = s.Write(public.FillBytes(make([]byte, keyLength)))

		reply := make([]byte, 128+keyLength)
		if _, err := io.ReadFull(s, reply); err != nil {
			return err
		}
		clientPublic := new(big.Int).SetBytes(reply[128:])
		shared := new(big.Int).Exp(clientPublic, private, prime)
		key := md5.Sum(shared.FillBytes(make([]byte, keyLength))) //nolint:gosec // see the import
		block, _ := aes.NewCipher(key[:])
		plain := make([]byte, 128)
		for i := 0; i < 128; i += aes.BlockSize {
			block.Decrypt(plain[i:i+aes.BlockSize], reply[i:i+aes.BlockSize])
		}
		gotUser, _, _ = strings.Cut(string(plain[:64]), "\x00")
		gotPassword, _, _ = strings.Cut(string(plain[64:]), "\x00")
		_, _ = s.Write([]byte{0, 0, 0, 0})
		return nil
	})
	if err != nil || serverErr != nil {
		t.Fatalf("sign-in = %v, server = %v", err, serverErr)
	}
	if gotUser != creds.Username || gotPassword != creds.Password {
		t.Fatalf("the server read %q / %q", gotUser, gotPassword)
	}
}
