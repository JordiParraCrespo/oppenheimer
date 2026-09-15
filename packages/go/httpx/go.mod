module github.com/jordiparracrespo/oppenheimer/packages/go/httpx

go 1.24

require github.com/jordiparracrespo/oppenheimer/packages/go/core v0.0.0

// Relative replaces keep the module tidy-able and buildable without go.work.
replace github.com/jordiparracrespo/oppenheimer/packages/go/core => ../core
