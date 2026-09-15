package scope

import "testing"

func TestWriteImpliesRead(t *testing.T) {
	s := NewSet("jobs:write")
	if !s.Has("jobs:read") || !s.Has("jobs:write") {
		t.Fatal("write should imply read")
	}
	if s.Has("keys:read") {
		t.Fatal("unrelated resource granted")
	}
	if NewSet("jobs:read").Has("jobs:write") {
		t.Fatal("read must not imply write")
	}
}

func TestCatalog(t *testing.T) {
	c := NewCatalog("jobs:read", "jobs:write", "keys:write")
	got, err := c.ParseAll([]string{"jobs:read", " jobs:read", "keys:write"})
	if err != nil || len(got) != 2 {
		t.Fatalf("got %v, %v", got, err)
	}
	if _, err := c.ParseAll([]string{"admin:root"}); err == nil {
		t.Fatal("unknown scope accepted")
	}
	if all := c.All(); len(all) != 3 || all[0] != "jobs:read" {
		t.Fatalf("all = %v", all)
	}
	defer func() {
		if recover() == nil {
			t.Fatal("malformed catalog entry should panic")
		}
	}()
	NewCatalog("nonsense")
}

func TestParseSet(t *testing.T) {
	s := ParseSet("jobs:write  events:read")
	if len(s) != 2 || !s.Has("jobs:read") || s.Has("keys:read") {
		t.Fatalf("set = %v", s)
	}
}
