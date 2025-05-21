package parser

import (
	"fmt"
)

type Parser struct {
	source              string
	tokenizer           Tokenizer
	CurrentToken        Token
	unaryOpTokens       []string
	primitivesTokens    []string
	operatorsByPriority [][]string
	expectedTokens      []string
}

func (p *Parser) NewParser(source string, tokenizer Tokenizer, offset int) (err error) {
	p.source = source
	p.tokenizer = tokenizer
	p.CurrentToken, err = p.tokenizer.Next(p.source, offset)
	p.unaryOpTokens = []string{"-", "+", "!"}
	p.primitivesTokens = []string{"number", "null", "true", "false", "string"}
	p.operatorsByPriority = [][]string{{"||"}, {"&&"}, {"in"}, {"==", "!="}, {">", "<", "<=", ">="}, {"+", "-"}, {"*", "/"}, {"**"}}
	p.expectedTokens = []string{"!", "(", "+", "-", "[", "false", "identifier", "null", "number", "string", "true", "{"}
	return
}

func (p *Parser) takeToken(kinds ...string) error {
	var err error
	if p.CurrentToken.IsEmpty() {
		return SyntaxError{
			Message: "unexpected end of input",
			Source:  p.source,
			Start:   len(p.source) - 1,
			End:     len(p.source),
		}
	}
	if len(kinds) > 0 && !StringsContains(p.CurrentToken.Kind, kinds) {
		return SyntaxError{
			Message:  fmt.Sprintf("unexpected '%s'", p.CurrentToken.Value),
			Source:   p.source,
			Start:    p.CurrentToken.Start,
			End:      p.CurrentToken.End,
			Expected: kinds,
		}
	}
	p.CurrentToken, err = p.tokenizer.Next(p.source, p.CurrentToken.End)
	return err
}

func (p *Parser) Parse(level int) (node IASTNode, err error) {
	//expr : logicalAnd (OR logicalAnd)*
	//logicalAnd : inStatement (AND inStatement)*
	//inStatement : equality (IN equality)*
	//equality : comparison (EQUALITY | INEQUALITY  comparison)*
	//comparison : addition (LESS | GREATER | LESSEQUAL | GREATEREQUAL addition)*
	//addition : multiplication (PLUS | MINUS multiplication)* "
	//multiplication : exponentiation (MUL | DIV exponentiation)*
	//exponentiation : propertyAccessOrFunc (EXP exponentiation)*
	var binaryNode BinOp
	var next IASTNode
	if level == len(p.operatorsByPriority)-1 {
		node, err = p.parsePropertyAccessOrFunc()
		if err != nil {
			return nil, err
		}
		token := p.CurrentToken

		for ; token != (Token{}) && StringsContains(token.Kind, p.operatorsByPriority[level]); token = p.CurrentToken {
			err = p.takeToken(token.Kind)
			if err != nil {
				return nil, err
			}
			next, err = p.Parse(level)
			if err != nil {
				return nil, err
			}
			binaryNode.NewNode(token, next, node)
			node = binaryNode
		}
	} else {
		node, err = p.Parse(level + 1)
		if err != nil {
			return nil, err
		}
		token := p.CurrentToken

		for ; token != (Token{}) && StringsContains(token.Kind, p.operatorsByPriority[level]); token = p.CurrentToken {
			err = p.takeToken(token.Kind)
			if err != nil {
				return nil, err
			}
			next, err = p.Parse(level + 1)
			if err != nil {
				return nil, err
			}
			binaryNode.NewNode(token, node, next)
			node = binaryNode
		}
	}

	return
}

func (p *Parser) parsePropertyAccessOrFunc() (node IASTNode, err error) {
	//propertyAccessOrFunc : unit (accessWithBrackets | DOT id | functionCall)*
	var primitiveNode ASTNode
	var binaryNode BinOp
	node, err = p.parseUnit()
	if err != nil {
		return nil, err
	}
	operators := []string{"[", "(", "."}

	for token := p.CurrentToken; p.CurrentToken != (Token{}) && StringsContains(token.Kind, operators); token = p.CurrentToken {
		switch token.Kind {
		case "[":
			node, err = p.parseAccessWithBrackets(node)
			if err != nil {
				return nil, err
			}
		case ".":
			token = p.CurrentToken
			err = p.takeToken(".")
			if err != nil {
				return nil, err
			}
			primitiveNode.NewNode(p.CurrentToken)
			rightPart := primitiveNode
			err = p.takeToken("identifier")
			if err != nil {
				return nil, err
			}
			binaryNode.NewNode(token, node, rightPart)
			node = binaryNode
		case "(":
			node, err = p.parseFunctionCall(node)
			if err != nil {
				return nil, err
			}
		}
	}

	return
}

func (p *Parser) parseUnit() (node IASTNode, err error) {
	// unit : unaryOp unit | primitives | contextValue | LPAREN expr RPAREN | list | object
	var unaryNode UnaryOp
	var primitiveNode ASTNode
	var contextValueNode ContextValue
	var next IASTNode
	if p.CurrentToken.IsEmpty() {
		return nil, SyntaxError{
			Message: "unexpected end of input",
			Source:  p.source,
			Start:   len(p.source) - 1,
			End:     len(p.source),
		}
	}
	token := p.CurrentToken
	isUnaryOpToken := StringsContains(token.Kind, p.unaryOpTokens)
	isPrimitivesToken := StringsContains(token.Kind, p.primitivesTokens)

	if isUnaryOpToken {
		err = p.takeToken(token.Kind)
		if err != nil {
			return nil, err
		}
		next, err = p.parseUnit()
		if err != nil {
			return nil, err
		}
		unaryNode.NewNode(token, next)
		node = unaryNode
	} else if isPrimitivesToken {
		err = p.takeToken(token.Kind)
		if err != nil {
			return nil, err
		}
		primitiveNode.NewNode(token)
		node = primitiveNode
	} else if token.Kind == "identifier" {
		err = p.takeToken(token.Kind)
		if err != nil {
			return nil, err
		}
		contextValueNode.NewNode(token)
		node = contextValueNode
	} else if token.Kind == "(" {
		err = p.takeToken("(")
		if err != nil {
			return nil, err
		}
		node, err = p.Parse(0)
		if err != nil {
			return nil, err
		}
		if node == nil {
			return nil, SyntaxError{
				Message:  fmt.Sprintf("Found '%s'", p.CurrentToken.Kind),
				Source:   p.source,
				Start:    p.CurrentToken.Start,
				End:      p.CurrentToken.End,
				Expected: p.expectedTokens,
			}
		}
		err = p.takeToken(")")
		if err != nil {
			return nil, err
		}
	} else if token.Kind == "[" {
		node, err = p.parseList()
		if err != nil {
			return nil, err
		}
	} else if token.Kind == "{" {
		node, err = p.parseObject()
		if err != nil {
			return nil, err
		}
	}
	return
}

func (p *Parser) parseFunctionCall(name IASTNode) (node IASTNode, err error) {
	//    functionCall: LPAREN (expr ( COMMA expr)*)? RPAREN
	var args []IASTNode
	var functionCallNode FunctionCall
	token := p.CurrentToken
	err = p.takeToken("(")
	if err != nil {
		return nil, err
	}

	if p.CurrentToken.Kind != ")" {
		node, err = p.Parse(0)
		if err != nil {
			return nil, err
		}
		args = append(args, node)

		for p.CurrentToken != (Token{}) && p.CurrentToken.Kind == "," {
			if args[len(args)-1] == nil {
				return nil, SyntaxError{
					Message:  fmt.Sprintf("Found '%s'", p.CurrentToken.Kind),
					Source:   p.source,
					Start:    p.CurrentToken.Start,
					End:      p.CurrentToken.End,
					Expected: p.expectedTokens,
				}
			}
			err = p.takeToken(",")
			if err != nil {
				return nil, err
			}
			node, err = p.Parse(0)
			if err != nil {
				return nil, err
			}
			args = append(args, node)
		}
	}
	err = p.takeToken(")")
	if err != nil {
		return nil, err
	}
	functionCallNode.NewNode(token, name, args)
	node = functionCallNode

	return
}

func (p *Parser) parseList() (node IASTNode, err error) {
	//    list : LSQAREBRAKET (expr ( COMMA expr)*)? RSQAREBRAKET)
	var list []IASTNode
	var listNode List
	var token = p.CurrentToken
	err = p.takeToken("[")
	if err != nil {
		return nil, err
	}

	if p.CurrentToken.Kind != "]" {
		node, err = p.Parse(0)
		if err != nil {
			return nil, err
		}
		list = append(list, node)

		for p.CurrentToken.Kind == "," {
			if list[len(list)-1] == nil {
				return nil, SyntaxError{
					Message:  fmt.Sprintf("Found '%s'", p.CurrentToken.Kind),
					Source:   p.source,
					Start:    p.CurrentToken.Start,
					End:      p.CurrentToken.End,
					Expected: p.expectedTokens,
				}
			}
			err = p.takeToken(",")
			if err != nil {
				return nil, err
			}
			node, err = p.Parse(0)
			if err != nil {
				return nil, err
			}
			if node == nil {
				return nil, SyntaxError{
					Message:  fmt.Sprintf("Found '%s'", p.CurrentToken.Kind),
					Source:   p.source,
					Start:    p.CurrentToken.Start,
					End:      p.CurrentToken.End,
					Expected: p.expectedTokens,
				}
			}
			list = append(list, node)
		}
	}
	err = p.takeToken("]")
	if err != nil {
		return nil, err
	}
	listNode.NewNode(token, list)
	node = listNode
	return
}

func (p *Parser) parseAccessWithBrackets(node IASTNode) (IASTNode, error) {
	//    valueAccess : LSQAREBRAKET expr |(expr? SEMI expr?)  RSQAREBRAKET)
	var arrayNode ValueAccess
	var left, right IASTNode
	var err error
	token := p.CurrentToken
	isInterval := false

	err = p.takeToken("[")
	if err != nil {
		return nil, err
	}
	if p.CurrentToken.Kind == "]" {
		return nil, SyntaxError{
			Message:  fmt.Sprintf("Found '%s'", p.CurrentToken.Kind),
			Source:   p.source,
			Start:    p.CurrentToken.Start,
			End:      p.CurrentToken.End,
			Expected: p.expectedTokens,
		}
	}
	if p.CurrentToken.Kind != ":" {
		left, err = p.Parse(0)
		if err != nil {
			return nil, err
		}
	}
	if p.CurrentToken.Kind == ":" {
		isInterval = true
		err = p.takeToken(":")
		if err != nil {
			return nil, err
		}
	}
	if p.CurrentToken.Kind != "]" {
		right, err = p.Parse(0)
		if err != nil {
			return nil, err
		}
	}
	if isInterval && right == nil && p.CurrentToken.Kind != "]" {
		return nil, SyntaxError{
			Message:  fmt.Sprintf("Found '%s'", p.CurrentToken.Kind),
			Source:   p.source,
			Start:    p.CurrentToken.Start,
			End:      p.CurrentToken.End,
			Expected: p.expectedTokens,
		}
	}

	err = p.takeToken("]")
	if err != nil {
		return nil, err
	}
	arrayNode.NewNode(token, node, isInterval, left, right)
	node = arrayNode

	return node, err
}

func (p *Parser) parseObject() (node IASTNode, err error) {
	//    object : LCURLYBRACE ( STR | ID COLON expr (COMMA STR | ID COLON expr)*)? RCURLYBRACE
	var objectNode Object
	var objValue IASTNode
	obj := make(map[string]IASTNode)
	token := p.CurrentToken
	err = p.takeToken("{")
	if err != nil {
		return nil, err
	}

	for p.CurrentToken.Kind == "string" || p.CurrentToken.Kind == "identifier" {
		key := p.CurrentToken.Value
		if p.CurrentToken.Kind == "string" {
			key = parseString(key)
		}
		err = p.takeToken(p.CurrentToken.Kind)
		if err != nil {
			return nil, err
		}
		err = p.takeToken(":")
		if err != nil {
			return nil, err
		}
		objValue, err = p.Parse(0)
		if objValue == nil {
			return nil, SyntaxError{
				Message:  fmt.Sprintf("Found '%s'", p.CurrentToken.Kind),
				Source:   p.source,
				Start:    p.CurrentToken.Start,
				End:      p.CurrentToken.End,
				Expected: p.expectedTokens,
			}
		}
		if err != nil {
			return nil, err
		}
		obj[key] = objValue
		if p.CurrentToken.Kind == "}" {
			break
		} else {
			err = p.takeToken(",")
			if err != nil {
				return nil, err
			}
		}
	}
	err = p.takeToken("}")
	if err != nil {
		return nil, err
	}
	objectNode.NewNode(token, obj)
	node = objectNode

	return
}

func parseString(s string) string {
	return s[1 : len(s)-1]
}
