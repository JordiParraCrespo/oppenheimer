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
	github.com/jordiparracrespo/oppenheimer/packages/go/health v0.0.0
	github.com/jordiparracrespo/oppenheimer/packages/go/httpx v0.0.0
	github.com/jordiparracrespo/oppenheimer/packages/go/postgres v0.0.0
	github.com/jordiparracrespo/oppenheimer/packages/go/selfupdate v0.0.0
	github.com/jordiparracrespo/oppenheimer/packages/go/ws v0.0.0
)

require (
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	golang.org/x/crypto v0.37.0 // indirect
	golang.org/x/sync v0.17.0 // indirect
	golang.org/x/text v0.29.0 // indirect
)

replace (
	github.com/jordiparracrespo/oppenheimer/packages/go/auth => ../../packages/go/auth
	github.com/jordiparracrespo/oppenheimer/packages/go/config => ../../packages/go/config
	github.com/jordiparracrespo/oppenheimer/packages/go/core => ../../packages/go/core
	github.com/jordiparracrespo/oppenheimer/packages/go/health => ../../packages/go/health
	github.com/jordiparracrespo/oppenheimer/packages/go/httpx => ../../packages/go/httpx
	github.com/jordiparracrespo/oppenheimer/packages/go/postgres => ../../packages/go/postgres
	github.com/jordiparracrespo/oppenheimer/packages/go/selfupdate => ../../packages/go/selfupdate
	github.com/jordiparracrespo/oppenheimer/packages/go/ws => ../../packages/go/ws
)
