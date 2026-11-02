module github.com/jordiparracrespo/oppenheimer/apps/runner

go 1.24.0

toolchain go1.24.7

require (
	github.com/coder/websocket v1.8.15
	github.com/creack/pty v1.1.24
	github.com/golang-jwt/jwt/v5 v5.3.1
	github.com/jackc/pgx/v5 v5.7.6
	github.com/jordiparracrespo/oppenheimer/packages/go/auth v0.0.0
	github.com/jordiparracrespo/oppenheimer/packages/go/config v0.0.0
	github.com/jordiparracrespo/oppenheimer/packages/go/core v0.0.0
	github.com/jordiparracrespo/oppenheimer/packages/go/execx v0.0.0
	github.com/jordiparracrespo/oppenheimer/packages/go/health v0.0.0
	github.com/jordiparracrespo/oppenheimer/packages/go/httpx v0.0.0
	github.com/jordiparracrespo/oppenheimer/packages/go/postgres v0.0.0
	github.com/jordiparracrespo/oppenheimer/packages/go/selfupdate v0.0.0
	github.com/jordiparracrespo/oppenheimer/packages/go/ws v0.0.0
	github.com/pion/webrtc/v4 v4.2.23
	go.mau.fi/whatsmeow v0.0.0-20260211193157-7b33f6289f98
	golang.org/x/crypto v0.48.0
	google.golang.org/protobuf v1.36.11
	modernc.org/sqlite v1.38.2
)

require (
	filippo.io/edwards25519 v1.1.0 // indirect
	github.com/beeper/argo-go v1.1.2 // indirect
	github.com/dustin/go-humanize v1.0.1 // indirect
	github.com/elliotchance/orderedmap/v3 v3.1.0 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/mattn/go-colorable v0.1.14 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/ncruces/go-strftime v0.1.9 // indirect
	github.com/petermattis/goid v0.0.0-20260113132338-7c7de50cc741 // indirect
	github.com/pion/datachannel v1.6.3 // indirect
	github.com/pion/dtls/v3 v3.1.10 // indirect
	github.com/pion/ice/v4 v4.4.7 // indirect
	github.com/pion/interceptor v0.1.49 // indirect
	github.com/pion/logging v0.2.4 // indirect
	github.com/pion/mdns/v2 v2.2.2 // indirect
	github.com/pion/randutil v0.1.0 // indirect
	github.com/pion/rtcp v1.2.19 // indirect
	github.com/pion/rtp v1.10.5 // indirect
	github.com/pion/sctp v1.12.0 // indirect
	github.com/pion/sdp/v3 v3.0.20 // indirect
	github.com/pion/srtp/v3 v3.1.3 // indirect
	github.com/pion/stun/v4 v4.0.1 // indirect
	github.com/pion/transport/v5 v5.1.1 // indirect
	github.com/pion/turn/v5 v5.1.2 // indirect
	github.com/remyoudompheng/bigfft v0.0.0-20230129092748-24d4a6f8daec // indirect
	github.com/rs/zerolog v1.34.0 // indirect
	github.com/vektah/gqlparser/v2 v2.5.27 // indirect
	github.com/wlynxg/anet v0.0.5 // indirect
	go.mau.fi/libsignal v0.2.1 // indirect
	go.mau.fi/util v0.9.5 // indirect
	golang.org/x/exp v0.0.0-20260112195511-716be5621a96 // indirect
	golang.org/x/net v0.50.0 // indirect
	golang.org/x/sync v0.19.0 // indirect
	golang.org/x/sys v0.41.0 // indirect
	golang.org/x/text v0.34.0 // indirect
	golang.org/x/time v0.14.0 // indirect
	modernc.org/libc v1.66.3 // indirect
	modernc.org/mathutil v1.7.1 // indirect
	modernc.org/memory v1.11.0 // indirect
)

replace (
	github.com/jordiparracrespo/oppenheimer/packages/go/auth => ../../packages/go/auth
	github.com/jordiparracrespo/oppenheimer/packages/go/config => ../../packages/go/config
	github.com/jordiparracrespo/oppenheimer/packages/go/core => ../../packages/go/core
	github.com/jordiparracrespo/oppenheimer/packages/go/execx => ../../packages/go/execx
	github.com/jordiparracrespo/oppenheimer/packages/go/health => ../../packages/go/health
	github.com/jordiparracrespo/oppenheimer/packages/go/httpx => ../../packages/go/httpx
	github.com/jordiparracrespo/oppenheimer/packages/go/postgres => ../../packages/go/postgres
	github.com/jordiparracrespo/oppenheimer/packages/go/selfupdate => ../../packages/go/selfupdate
	github.com/jordiparracrespo/oppenheimer/packages/go/ws => ../../packages/go/ws
)
