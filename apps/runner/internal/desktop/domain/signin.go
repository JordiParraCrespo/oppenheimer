package domain

import (
	"bytes"
	"crypto/aes"
	"crypto/des" //nolint:gosec // RFB's VNC authentication is DES by definition (RFC 6143 §7.2.2)
	"crypto/md5" //nolint:gosec // Apple Remote Desktop derives its AES key with MD5; the protocol, not a choice
	"encoding/binary"
	"fmt"
	"io"
	"math/big"
	"slices"
	"strings"
)

// The security types the runner can complete (RFC 6143 §7.2, and Apple's).
const (
	securityNone    = 1
	securityVNCAuth = 2
	securityARD     = 30
)

// maxReason bounds a failure reason a server sends; anything longer is not one.
const maxReason = 4096

// maxARDKey bounds an Apple Remote Desktop key: 2048 bits is what macOS sends.
const maxARDKey = 1024

type rfbVersion int

const (
	rfb33 rfbVersion = iota
	rfb37
	rfb38
)

// SignIn is the client half of RFB's handshake against the screen-sharing
// server on rw, with the host's own credentials, up to and including a
// successful SecurityResult. After it the next message the server reads is
// ClientInit, which is the browser's to send: the runner hands it a stream
// already signed in, so no password ever leaves the host.
//
// random is where the keys and padding Apple's sign-in needs come from.
func SignIn(rw io.ReadWriter, creds Credentials, random io.Reader) error {
	version, err := readServerVersion(rw)
	if err != nil {
		return err
	}
	reply := map[rfbVersion]string{rfb33: "RFB 003.003\n", rfb37: "RFB 003.007\n", rfb38: "RFB 003.008\n"}[version]
	if _, err := io.WriteString(rw, reply); err != nil {
		return ErrUnreachable.WithDetail("the server hung up: %v", err).WithCause(err)
	}
	chosen, err := chooseSecurity(rw, version, creds)
	if err != nil {
		return err
	}
	switch chosen {
	case securityVNCAuth:
		err = vncAuth(rw, creds.Password)
	case securityARD:
		err = ardAuth(rw, creds, random)
	}
	if err != nil {
		return err
	}
	// RFB 3.8 answers every type, None included; before it, None has no result.
	if chosen == securityNone && version != rfb38 {
		return nil
	}
	return readSecurityResult(rw, version)
}

func readServerVersion(r io.Reader) (rfbVersion, error) {
	var raw [12]byte
	if _, err := io.ReadFull(r, raw[:]); err != nil {
		return 0, ErrUnreachable.WithDetail("the server sent no RFB version: %v", err).WithCause(err)
	}
	var major, minor int
	if n, err := fmt.Sscanf(string(raw[:]), "RFB %03d.%03d\n", &major, &minor); n != 2 || err != nil || major != 3 {
		return 0, ErrUnreachable.WithDetail("the server on this port does not speak RFB (%q)", strings.TrimSpace(string(raw[:])))
	}
	switch {
	// 3.889 is Apple Remote Desktop's, which runs the 3.8 handshake.
	case minor >= 8:
		return rfb38, nil
	case minor == 7:
		return rfb37, nil
	default:
		return rfb33, nil
	}
}

// chooseSecurity reads what the server offers and answers the type the
// runner will complete: no password first, then the ones the host's
// credentials allow.
func chooseSecurity(rw io.ReadWriter, version rfbVersion, creds Credentials) (byte, error) {
	if version == rfb33 {
		var chosen uint32
		if err := binary.Read(rw, binary.BigEndian, &chosen); err != nil {
			return 0, ErrUnreachable.WithDetail("the server hung up: %v", err).WithCause(err)
		}
		switch chosen {
		case 0:
			return 0, ErrRefused.WithDetail("%s", readReason(rw))
		case securityNone:
			return securityNone, nil
		case securityVNCAuth:
			if creds.Password == "" {
				return 0, ErrRefused.WithDetail("the server asks for a VNC password and this host has none: runner desktop on --password-file <file>")
			}
			return securityVNCAuth, nil
		default:
			return 0, ErrUnsupported.WithDetail("security type %d", chosen)
		}
	}
	var count [1]byte
	if _, err := io.ReadFull(rw, count[:]); err != nil {
		return 0, ErrUnreachable.WithDetail("the server hung up: %v", err).WithCause(err)
	}
	if count[0] == 0 {
		return 0, ErrRefused.WithDetail("%s", readReason(rw))
	}
	offered := make([]byte, count[0])
	if _, err := io.ReadFull(rw, offered); err != nil {
		return 0, ErrUnreachable.WithDetail("the server hung up: %v", err).WithCause(err)
	}
	chosen, err := pickSecurity(offered, creds)
	if err != nil {
		return 0, err
	}
	if _, err := rw.Write([]byte{chosen}); err != nil {
		return 0, ErrUnreachable.WithDetail("the server hung up: %v", err).WithCause(err)
	}
	return chosen, nil
}

func pickSecurity(offered []byte, creds Credentials) (byte, error) {
	switch {
	case slices.Contains(offered, securityNone):
		return securityNone, nil
	case slices.Contains(offered, securityARD) && creds.Username != "" && creds.Password != "":
		return securityARD, nil
	case slices.Contains(offered, securityVNCAuth) && creds.Password != "":
		return securityVNCAuth, nil
	case slices.Contains(offered, securityARD):
		return 0, ErrRefused.WithDetail("the server asks for a macOS account: runner desktop on --username <account> --password-file <file>")
	case slices.Contains(offered, securityVNCAuth):
		return 0, ErrRefused.WithDetail("the server asks for a VNC password: runner desktop on --password-file <file>")
	default:
		return 0, ErrUnsupported.WithDetail("security types %v", offered)
	}
}

func readSecurityResult(r io.Reader, version rfbVersion) error {
	var result uint32
	if err := binary.Read(r, binary.BigEndian, &result); err != nil {
		return ErrUnreachable.WithDetail("the server hung up during sign-in: %v", err).WithCause(err)
	}
	if result == 0 {
		return nil
	}
	if version == rfb38 {
		return ErrRefused.WithDetail("%s", readReason(r))
	}
	return ErrRefused.WithDetail("the server refused the password")
}

// readReason is a failure's text, or a placeholder when the server sends
// none worth reading.
func readReason(r io.Reader) string {
	var size uint32
	if err := binary.Read(r, binary.BigEndian, &size); err != nil || size == 0 || size > maxReason {
		return "the server gave no reason"
	}
	reason := make([]byte, size)
	if _, err := io.ReadFull(r, reason); err != nil {
		return "the server gave no reason"
	}
	return strings.ToValidUTF8(string(reason), "?")
}

// vncAuth answers RFB's DES challenge (RFC 6143 §7.2.2): the password's first
// eight bytes, each bit-reversed, are the key.
func vncAuth(rw io.ReadWriter, password string) error {
	var challenge [16]byte
	if _, err := io.ReadFull(rw, challenge[:]); err != nil {
		return ErrUnreachable.WithDetail("the server hung up during sign-in: %v", err).WithCause(err)
	}
	var key [8]byte
	copy(key[:], password)
	for i, b := range key {
		key[i] = reverseBits(b)
	}
	block, err := des.NewCipher(key[:]) //nolint:gosec // see the import
	if err != nil {
		return fmt.Errorf("vnc auth: %w", err)
	}
	var response [16]byte
	block.Encrypt(response[:8], challenge[:8])
	block.Encrypt(response[8:], challenge[8:])
	if _, err := rw.Write(response[:]); err != nil {
		return ErrUnreachable.WithDetail("the server hung up during sign-in: %v", err).WithCause(err)
	}
	return nil
}

func reverseBits(b byte) byte {
	var out byte
	for range 8 {
		out = out<<1 | b&1
		b >>= 1
	}
	return out
}

// ardAuth is Apple Remote Desktop's sign-in (security type 30), what macOS
// Screen Sharing asks for: a Diffie-Hellman exchange on the server's group,
// whose shared secret's MD5 is an AES-128 key that encrypts the account name
// and password, 64 bytes each, NUL-terminated and padded with random bytes.
func ardAuth(rw io.ReadWriter, creds Credentials, random io.Reader) error {
	var head struct{ Generator, KeyLength uint16 }
	if err := binary.Read(rw, binary.BigEndian, &head); err != nil {
		return ErrUnreachable.WithDetail("the server hung up during sign-in: %v", err).WithCause(err)
	}
	if head.KeyLength == 0 || head.KeyLength > maxARDKey {
		return ErrUnsupported.WithDetail("an Apple Remote Desktop key of %d bytes", head.KeyLength)
	}
	material := make([]byte, 2*int(head.KeyLength))
	if _, err := io.ReadFull(rw, material); err != nil {
		return ErrUnreachable.WithDetail("the server hung up during sign-in: %v", err).WithCause(err)
	}
	prime := new(big.Int).SetBytes(material[:head.KeyLength])
	peer := new(big.Int).SetBytes(material[head.KeyLength:])
	if prime.Sign() == 0 {
		return ErrUnsupported.WithDetail("an Apple Remote Desktop group with no prime")
	}

	secretKey := make([]byte, head.KeyLength)
	if _, err := io.ReadFull(random, secretKey); err != nil {
		return fmt.Errorf("ard auth: %w", err)
	}
	private := new(big.Int).SetBytes(secretKey)
	public := new(big.Int).Exp(big.NewInt(int64(head.Generator)), private, prime)
	shared := new(big.Int).Exp(peer, private, prime)
	key := md5.Sum(shared.FillBytes(make([]byte, head.KeyLength))) //nolint:gosec // see the import

	plain := make([]byte, 128)
	if _, err := io.ReadFull(random, plain); err != nil {
		return fmt.Errorf("ard auth: %w", err)
	}
	if err := putCredential(plain[:64], creds.Username); err != nil {
		return err
	}
	if err := putCredential(plain[64:], creds.Password); err != nil {
		return err
	}
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return fmt.Errorf("ard auth: %w", err)
	}
	sealed := make([]byte, len(plain))
	for offset := 0; offset < len(plain); offset += aes.BlockSize {
		block.Encrypt(sealed[offset:offset+aes.BlockSize], plain[offset:offset+aes.BlockSize])
	}
	out := append(sealed, public.FillBytes(make([]byte, head.KeyLength))...)
	if _, err := rw.Write(out); err != nil {
		return ErrUnreachable.WithDetail("the server hung up during sign-in: %v", err).WithCause(err)
	}
	return nil
}

// putCredential writes value NUL-terminated at the start of field.
func putCredential(field []byte, value string) error {
	if len(value) > len(field)-1 || bytes.IndexByte([]byte(value), 0) >= 0 {
		return ErrInvalidInput.WithDetail("an Apple Remote Desktop credential is at most %d bytes", len(field)-1)
	}
	copy(field, value)
	field[len(value)] = 0
	return nil
}
