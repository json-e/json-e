package parser

import (
	"fmt"
	"strings"
)

type Parser struct {
	source           string
	tokenizer        Tokenizer
	CurrentToken     Token
	unaryOpTokens    []string
	binOpTokens      []string
	primitivesTokens []string
}

func (p *Parser) NewParser(source string, tokenizer Tokenizer, offset int) (err error) {
	p.source = source
	p.tokenizer = tokenizer
	p.CurrentToken, err = p.tokenizer.Next(p.source, offset)
	p.unaryOpTokens = []string{"-", "+", "!"}
	p.primitivesTokens = []string{"number", "null", "true", "false"}
	return
}

func (p *Parser) eat(kinds ...string) error {
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

func (p *Parser) Parse() (node IASTNode, err error) {
	//    logicalOr : logicalAnd (OR logicalAnd)*
	var binaryNode BinOp
	var next IASTNode

	node, err = p.logicalAnd()
	if err != nil {
		return nil, err
	}
	token := p.CurrentToken

	for ; token != (Token{}) && token.Kind == "||"; token = p.CurrentToken {
		err = p.eat(token.Kind)
		if err != nil {
			return nil, err
		}
		next, err = p.logicalAnd()
		if err != nil {
			return nil, err
		}
		binaryNode.NewNode(token, node, next)
		node = binaryNode
	}

	return
}

func (p *Parser) logicalAnd() (node IASTNode, err error) {
	//    logicalAnd : equality (AND equality)*
	var binaryNode BinOp
	var next IASTNode
	node, err = p.inStatement()
	if err != nil {
		return nil, err
	}
	token := p.CurrentToken

	for ; token != (Token{}) && token.Kind == "&&"; token = p.CurrentToken {
		err = p.eat(token.Kind)
		if err != nil {
			return nil, err
		}
		next, err = p.inStatement()
		if err != nil {
			return nil, err
		}
		binaryNode.NewNode(token, node, next)
		node = binaryNode
	}

	return
}

func (p *Parser) inStatement() (node IASTNode, err error) {
	//    inStatement : equality (IN equality)*
	var binaryNode BinOp
	var next IASTNode
	node, err = p.equality()
	if err != nil {
		return nil, err
	}
	token := p.CurrentToken

	for ; token != (Token{}) && token.Kind == "in"; token = p.CurrentToken {
		err = p.eat(token.Kind)
		if err != nil {
			return nil, err
		}
		next, err = p.equality()
		if err != nil {
			return nil, err
		}
		binaryNode.NewNode(token, node, next)
		node = binaryNode
	}

	return
}

func (p *Parser) equality() (node IASTNode, err error) {
	//    equality : comparison (EQUALITY | INEQUALITY  comparison)*
	var binaryNode BinOp
	operations := []string{"==", "!="}
	var next IASTNode
	node, err = p.comparison()
	if err != nil {
		return nil, err
	}
	token := p.CurrentToken

	for token != (Token{}) && StringsContains(token.Kind, operations) {
		err = p.eat(token.Kind)
		if err != nil {
			return nil, err
		}
		next, err = p.comparison()
		if err != nil {
			return nil, err
		}
		binaryNode.NewNode(token, node, next)
		node = binaryNode
		token = p.CurrentToken
	}

	return
}

func (p *Parser) comparison() (node IASTNode, err error) {
	//    comparison : addition (LESS | GREATER | LESSEQUAL | GREATEREQUAL addition)*
	var binaryNode BinOp
	var next IASTNode
	operations := []string{"<", ">", ">=", "<="}
	node, err = p.addition()
	if err != nil {
		return nil, err
	}
	token := p.CurrentToken

	for token != (Token{}) && StringsContains(token.Kind, operations) {
		err = p.eat(token.Kind)
		if err != nil {
			return nil, err
		}
		next, err = p.addition()
		if err != nil {
			return nil, err
		}
		binaryNode.NewNode(token, node, next)
		node = binaryNode
		token = p.CurrentToken
	}

	return
}

func (p *Parser) addition() (node IASTNode, err error) {
	//    addition : multiplication (PLUS | MINUS multiplication)*
	var binaryNode BinOp
	var next IASTNode
	operations := []string{"-", "+"}
	node, err = p.multiplication()
	if err != nil {
		return nil, err
	}
	token := p.CurrentToken

	for token != (Token{}) && StringsContains(token.Kind, operations) {
		err = p.eat(token.Kind)
		if err != nil {
			return nil, err
		}
		next, err = p.multiplication()
		if err != nil {
			return nil, err
		}
		binaryNode.NewNode(token, node, next)
		node = binaryNode
		token = p.CurrentToken
	}

	return
}

func (p *Parser) multiplication() (node IASTNode, err error) {
	//    multiplication : exponentiation (MUL | DIV exponentiation)*
	var binaryNode BinOp
	var next IASTNode
	operations := []string{"*", "/"}
	node, err = p.exponentiation()
	if err != nil {
		return nil, err
	}
	token := p.CurrentToken

	for token != (Token{}) && StringsContains(token.Kind, operations) {
		err = p.eat(token.Kind)
		if err != nil {
			return nil, err
		}
		next, err = p.exponentiation()
		if err != nil {
			return nil, err
		}
		binaryNode.NewNode(token, node, next)
		node = binaryNode
		token = p.CurrentToken
	}

	return
}

func (p *Parser) exponentiation() (node IASTNode, err error) {
	//    exponentiation : factor (EXP exponentiation)*
	var binaryNode BinOp
	var next IASTNode
	node, err = p.factor()
	if err != nil {
		return nil, err
	}
	token := p.CurrentToken

	for ; token != (Token{}) && token.Kind == "**"; token = p.CurrentToken {
		err = p.eat(token.Kind)
		if err != nil {
			return nil, err
		}
		next, err = p.exponentiation()
		if err != nil {
			return nil, err
		}
		binaryNode.NewNode(token, next, node)
		node = binaryNode
	}

	return
}

func (p *Parser) factor() (node IASTNode, err error) {
	// factor : unaryOp factor | primitives | (string | list | builtin) (valueAccess)? | LPAREN expr RPAREN | object
	var unaryNode UnaryOp
	var primitiveNode ASTNode
	var next IASTNode
	token := p.CurrentToken
	isUnaryOpToken := StringsContains(token.Kind, p.unaryOpTokens)
	isPrimitivesToken := StringsContains(token.Kind, p.primitivesTokens)

	if isUnaryOpToken {
		err = p.eat(token.Kind)
		if err != nil {
			return nil, err
		}
		next, err = p.factor()
		if err != nil {
			return nil, err
		}
		unaryNode.NewNode(token, next)
		node = unaryNode
	} else if isPrimitivesToken {
		err = p.eat(token.Kind)
		if err != nil {
			return nil, err
		}
		primitiveNode.NewNode(token)
		node = primitiveNode
	} else if token.Kind == "string" {
		err = p.eat(token.Kind)
		if err != nil {
			return nil, err
		}
		primitiveNode.NewNode(token)
		node = primitiveNode
		node, err = p.valueAccess(node)
		if err != nil {
			return nil, err
		}
	} else if token.Kind == "(" {
		err = p.eat("(")
		if err != nil {
			return nil, err
		}
		node, err = p.Parse()
		if err != nil {
			return nil, err
		}
		err = p.eat(")")
		if err != nil {
			return nil, err
		}
	} else if token.Kind == "[" {
		node, err = p.list()
		if err != nil {
			return nil, err
		}
		node, err = p.valueAccess(node)
		if err != nil {
			return nil, err
		}
	} else if token.Kind == "{" {
		node, err = p.object()
		if err != nil {
			return nil, err
		}
	} else if token.Kind == "identifier" {
		node, err = p.builtins()
		if err != nil {
			return nil, err
		}
		node, err = p.valueAccess(node)
		if err != nil {
			return nil, err
		}
	}
	return
}

func (p *Parser) builtins() (node IASTNode, err error) {
	//    builtins : (LPAREN (expr ( COMMA expr)*)? RPAREN)? | (DOT ID)*)
	var args []IASTNode
	var token = p.CurrentToken
	var builtinNode Builtin
	var binOpNode BinOp
	var simpleNode ASTNode
	err = p.eat("identifier")
	if err != nil {
		return nil, err
	}
	args = nil
	if p.CurrentToken != (Token{}) && p.CurrentToken.Kind == "(" {
		err = p.eat("(")
		if err != nil {
			return nil, err
		}
		node, err = p.Parse()
		if err != nil {
			return nil, err
		}
		if node != nil {
			args = append(args, node)
		}

		for p.CurrentToken.Kind == "," {
			err = p.eat(",")
			if err != nil {
				return nil, err
			}
			node, err = p.Parse()
			if err != nil {
				return nil, err
			}
			args = append(args, node)
		}
		err = p.eat(")")
		if err != nil {
			return nil, err
		}
	}
	builtinNode.NewNode(token, args)
	node = builtinNode
	token = p.CurrentToken
	for token != (Token{}) && token.Kind == "." {
		err = p.eat(".")
		if err != nil {
			return nil, err
		}
		simpleNode.NewNode(p.CurrentToken)
		err = p.eat(p.CurrentToken.Kind)
		if err != nil {
			return nil, err
		}
		binOpNode.NewNode(token, node, simpleNode)
		node = binOpNode
		token = p.CurrentToken
	}

	return
}

func (p *Parser) list() (node IASTNode, err error) {
	//    list : LSQAREBRAKET (expr ( COMMA expr)*)? RSQAREBRAKET)
	var list []IASTNode
	var listNode List
	var token = p.CurrentToken
	err = p.eat("[")
	if err != nil {
		return nil, err
	}

	if p.CurrentToken.Kind != "]" {
		node, err = p.Parse()
		if err != nil {
			return nil, err
		}
		list = append(list, node)

		for p.CurrentToken.Kind == "," {
			err = p.eat(",")
			if err != nil {
				return nil, err
			}
			node, err = p.Parse()
			if err != nil {
				return nil, err
			}
			list = append(list, node)
		}
	}
	err = p.eat("]")
	if err != nil {
		return nil, err
	}
	listNode.NewNode(token, list)
	node = listNode
	return
}

func (p *Parser) valueAccess(node IASTNode) (IASTNode, error) {
	//    valueAccess : LSQAREBRAKET expr |(expr? SEMI expr?)  RSQAREBRAKET)
	var arrayNode ValueAccess
	var left, right IASTNode
	var err error
	token := p.CurrentToken
	isInterval := false

	token = p.CurrentToken
	for token != (Token{}) && token.Kind == "[" {
		err = p.eat("[")
		if err != nil {
			return nil, err
		}
		if p.CurrentToken.Kind != ":" {
			left, err = p.Parse()
			if err != nil {
				return nil, err
			}
		}
		if p.CurrentToken.Kind == ":" {
			isInterval = true
			err = p.eat(":")
			if err != nil {
				return nil, err
			}
			if p.CurrentToken.Kind != "]" {
				right, err = p.Parse()
				if err != nil {
					return nil, err
				}
			}
		}

		err = p.eat("]")
		if err != nil {
			return nil, err
		}
		arrayNode.NewNode(token, node, isInterval, left, right)
		node = arrayNode
		token = p.CurrentToken
	}
	return node, err
}

func (p *Parser) object() (node IASTNode, err error) {
	//    object : LCURLYBRACE ( STR | ID SEMI expr (COMMA STR | ID SEMI expr)*)? RCURLYBRACE (DOT ID)?
	var objectNode Object
	var binOpNode BinOp
	var simpleNode ASTNode
	var objValue IASTNode
	obj := make(map[string]IASTNode)
	token := p.CurrentToken
	err = p.eat("{")
	if err != nil {
		return nil, err
	}

	for p.CurrentToken.Kind == "string" || p.CurrentToken.Kind == "identifier" {
		key := p.CurrentToken.Value
		if p.CurrentToken.Kind == "string" {
			key = parseString(key)
		}
		err = p.eat(p.CurrentToken.Kind)
		if err != nil {
			return nil, err
		}
		err = p.eat(":")
		if err != nil {
			return nil, err
		}
		objValue, err = p.Parse()
		if err != nil {
			return nil, err
		}
		obj[key] = objValue
		if p.CurrentToken.Kind == "}" {
			break
		} else {
			err = p.eat(",")
			if err != nil {
				return nil, err
			}
		}
	}
	err = p.eat("}")
	if err != nil {
		return nil, err
	}
	objectNode.NewNode(token, obj)
	node = objectNode
	token = p.CurrentToken
	for token != (Token{}) && token.Kind == "." {
		err = p.eat(".")
		if err != nil {
			return nil, err
		}
		simpleNode.NewNode(p.CurrentToken)
		err = p.eat(p.CurrentToken.Kind)
		if err != nil {
			return nil, err
		}
		binOpNode.NewNode(token, node, simpleNode)
		node = binOpNode
		token = p.CurrentToken
	}
	return
}

func parseString(s string) string {
	return s[1 : len(s)-1]
}

func CreateTokenizer() (tokenizer Tokenizer) {
	tokenizer = *NewTokenizer(`\s+`, strings.Split(
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
	return
}
