package interpreter

import (
	"strings"

	p "github.com/json-e/json-e/v4/internal/interpreter/parser"
)

var tokenizer = *p.NewTokenizer(`\s+`, strings.Split(
	`** + - * / [ ] . ( ) { } : , >= <= < > == != ! && || true false in null number identifier string`, " ",
), map[string]string{
	"number":     `[0-9]+(?:\.[0-9]+)?`,
	"identifier": `[a-zA-Z_][a-zA-Z_0-9]*`,
	"string":     `'[^']*'|"[^"]*"`,
	"true":       `true\b`,
	"false":      `false\b`,
	"in":         `in\b`,
	"null":       `null\b`,
})

var expectedInfixTokens = strings.Split(
	`!= && ( * ** + - . / < <= == > >= [ in ||`, " ",
)

func Parse(source string, context interface{}) (interface{}, error) {
	var parser p.Parser
	var newInterpreter NewInterpreter
	err := parser.NewParser(source, tokenizer, 0)
	if err != nil {
		return nil, err
	}
	tree, err := parser.Parse(0)
	if err != nil {
		return nil, err
	}
	if !parser.CurrentToken.IsEmpty() {
		return nil, p.SyntaxError{
			Source:   source,
			Start:    parser.CurrentToken.Start,
			End:      parser.CurrentToken.End,
			Expected: expectedInfixTokens,
		}
	}
	newInterpreter.AddContext(context.(map[string]interface{}))
	return newInterpreter.Interpret(tree)

}

func ParseUntilTerminator(source string, offset int, terminator string, context interface{}) (interface{}, int, error) {
	var parser p.Parser
	var newInterpreter NewInterpreter

	err := parser.NewParser(source, tokenizer, offset)
	if err != nil {
		return nil, 0, err
	}
	tree, err := parser.Parse(0)
	if err != nil {
		return nil, 0, err
	}
	if parser.CurrentToken.IsEmpty() {
		return nil, 0, p.SyntaxError{
			Message: "unterminated ${..} expression",
		}
	}
	if parser.CurrentToken.Kind != terminator {
		return nil, 0, p.SyntaxError{
			Source:   source,
			Start:    parser.CurrentToken.Start,
			End:      parser.CurrentToken.End,
			Expected: expectedInfixTokens,
		}
	}
	newInterpreter.AddContext(context.(map[string]interface{}))
	result, err := newInterpreter.Interpret(tree)
	if err != nil {
		return nil, 0, err
	}

	return result, parser.CurrentToken.End, nil
}
