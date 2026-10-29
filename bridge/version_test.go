package main

import "testing"

// 2.10 comes after 2.9: versions are compared number by number, not as text
func TestNewerVersion(t *testing.T) {
	for _, c := range []struct {
		a, b string
		want bool
	}{{"2.10.0", "2.9.0", true}, {"2.9.0", "2.10.0", false}, {"2.10.0", "2.10.0", false}, {"3.0.0", "2.10.5", true}, {"2.10.1", "2.10.0", true}} {
		if got := newer(c.a, c.b); got != c.want {
			t.Errorf("newer(%q, %q) = %v, want %v", c.a, c.b, got, c.want)
		}
	}
}
