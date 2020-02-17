package interpreter

import (
	p "json-e/interpreter/parser"
)

func Parse(source string, offset int, context interface{}) (interface{}, error) {
	var parser p.Parser
	var newInterpreter NewInterpreter
	tokenizer := p.CreateTokenizer()
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
			Message: "expected end of input",
			Source:  source,
			Start:   parser.CurrentToken.Start,
			End:     parser.CurrentToken.End,
		}
	}
	newInterpreter.AddContext(context.(map[string]interface{}))
	return newInterpreter.Interpret(tree)

}

func ParseUntilTerminator(source string, offset int, terminator string, context interface{}) (interface{}, int, error) {
	var parser p.Parser
	var newInterpreter NewInterpreter
	tokenizer := p.CreateTokenizer()

	err := parser.NewParser(source, tokenizer, offset)
	if err != nil {
		return nil, 0, err
	}
	tree, err := parser.Parse(0)
	if err != nil {
		return nil, 0, err
	}
	if parser.CurrentToken.Kind != terminator {
		return nil, 0, p.SyntaxError{
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
