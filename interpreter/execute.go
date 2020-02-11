package interpreter

import (
	"./newparser"
	"github.com/taskcluster/json-e/interpreter/prattparser"
)

// Execute expression with given context starting from offset.
//
// Values of context must be valid, see IsValidContext()
func Execute(expression string, offset int, context map[string]interface{}) (interface{}, error) {
	if err := IsValidContext(context); err != nil {
		panic(err)
	}
	return Interpreter.Parse(expression, offset, context)
}

// ExecuteUntil will execute expression from offset with given context, expecting
// to find terminator after the expression, returns value and end-offset or error.
//
// Values of context must be valid, see IsValidContext()
func ExecuteUntil(expression string, offset int, terminator string, context map[string]interface{}) (interface{}, int, error) {
	if err := IsValidContext(context); err != nil {
		panic(err)
	}
	return Interpreter.ParseUntil(expression, offset, terminator, context)
}

func NewParse(source string, offset int, context interface{}) (interface{}, error) {
	var parser newparser.Parser
	var newInterpreter NewInterpreter
	tokenizer := newparser.CreateTokenizer()

	err := parser.NewParser(source, tokenizer, 0)
	if err != nil {
		return nil, err
	}
	tree, err := parser.Parse()
	if err != nil {
		return nil, err
	}
	if !parser.CurrentToken.IsEmpty() {
		return nil, prattparser.SyntaxError{
			Message: "expected end of input",
			Source:  source,
			Start:   parser.CurrentToken.Start,
			End:     parser.CurrentToken.End,
		}
	}
	newInterpreter.AddContext(context.(map[string]interface{}))
	return newInterpreter.Interpret(tree)

}

func NewParseUntilTerminator(source string, offset int, terminator string, context interface{}) (interface{}, int, error) {
	var parser newparser.Parser
	var newInterpreter NewInterpreter
	tokenizer := newparser.CreateTokenizer()

	err := parser.NewParser(source, tokenizer, offset)
	if err != nil {
		return nil, 0, err
	}
	tree, err := parser.Parse()
	if err != nil {
		return nil, 0, err
	}
	if parser.CurrentToken.Kind != terminator {
		return nil, 0, prattparser.SyntaxError{
			Source:   source,
			Start:    parser.CurrentToken.Start,
			End:      parser.CurrentToken.End,
			Expected: []string{terminator},
		}
	}
	newInterpreter.AddContext(context.(map[string]interface{}))
	result, err := newInterpreter.Interpret(tree)
	if err != nil {
		return nil, 0, err
	}

	return result, parser.CurrentToken.End, nil
}
