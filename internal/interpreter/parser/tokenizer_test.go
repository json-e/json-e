package parser

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTokenizer(t *testing.T) {
	tok := NewTokenizer(`\s+`, append([]string{`**`},
		strings.Split(`** + - * / [ ] . ( ) { } : , >= <= < > == != ! && || true false in null number identifier string`, " ")...,
	), map[string]string{
		"number":     `[0-9]+(?:\.[0-9]+)?`,
		"identifier": `[a-zA-Z_][a-zA-Z_0-9]*`,
		"string":     `'[^']*'|"[^"]*"`,
	})
	require.NotNil(t, tok)
	tokens, err := tok.Tokenize(`myvar >= 234 + 2 / 4    in null true () . ,`, 0)
	require.NoError(t, err)
	expected := []string{
		"identifier",
		">=",
		"number",
		"+",
		"number",
		"/",
		"number",
		"in",
		"null",
		"true",
		"(",
		")",
		".",
		",",
	}
	var kinds []string
	for _, token := range tokens {
		kinds = append(kinds, token.Kind)
	}
	require.EqualValues(t, expected, kinds)
}
