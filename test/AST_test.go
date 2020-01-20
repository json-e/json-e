package tests

import (
	"../interpreter"
	"../interpreter/newparser"
	"../interpreter/prattparser"
	"reflect"
	"testing"
)

func TestTermConstructor(t *testing.T) {
	var node newparser.ASTNode
	var token prattparser.Token

	node.NewNode(token)

	if reflect.TypeOf(node).Name() != "ASTNode" {
		t.Error("Constructor for binary operations failed")
	}

}

func TestBinOpConstructor(t *testing.T) {
	var node newparser.BinOp
	var left, right newparser.UnaryOp
	var token prattparser.Token

	node.NewNode(token, left, right)

	if reflect.TypeOf(node).Name() != "BinOp" {
		t.Error("Constructor for binary operations failed")
	}

}

func TestUnaryOpConstructor(t *testing.T) {
	var node newparser.UnaryOp
	var expr newparser.ASTNode
	var token prattparser.Token

	node.NewNode(token, expr)

	if reflect.TypeOf(node).Name() != "UnaryOp" {
		t.Error("Constructor for unary operations failed")
	}

}

func TestBuiltinConstructor(t *testing.T) {
	var node newparser.Builtin
	var token prattparser.Token
	var args []newparser.IASTNode

	node.NewNode(token, args)

	if reflect.TypeOf(node).Name() != "Builtin" {
		t.Error("Constructor for builtins failed")
	}

}

func TestParserForPrimitives(t *testing.T) {
	var parser newparser.Parser

	tokenizer := newparser.CreateTokenizer()
	parser.NewParser("2", tokenizer)
	node := parser.Parse()
	token := node.GetToken()

	if token.Kind != "number" || token.Value != "2" {
		t.Error("Expression '2' failed excepted value = 2, kind = number"+
			"got value = ", token.Value, "kind = ", token.Kind)
	}
}

func TestParserForUnaryOp(t *testing.T) {
	var parser newparser.Parser

	tokenizer := newparser.CreateTokenizer()
	parser.NewParser("-2", tokenizer)
	node := parser.Parse()
	token := node.GetToken()

	if token.Kind == "-" && token.Value == "-" {
		child := node.GetLeftChild()
		childToken := (*child).GetToken()
		if childToken.Kind != "number" || childToken.Value != "2" {
			t.Error("Expression '-2' failed")
		}
	} else {
		t.Error("Expression '-2' failed")
	}
}

func TestParserForBinaryOp(t *testing.T) {
	var parser newparser.Parser

	tokenizer := newparser.CreateTokenizer()
	parser.NewParser("5-2", tokenizer)
	node := parser.Parse()
	token := node.GetToken()

	if token.Kind == "-" && token.Value == "-" {
		leftChild := node.GetLeftChild()
		leftChildToken := (*leftChild).GetToken()
		rightChild := node.GetRightChild()
		rightChildToken := (*rightChild).GetToken()
		if leftChildToken.Kind != "number" || leftChildToken.Value != "5" {
			t.Error("Expression '5-2' failed")
		}
		if rightChildToken.Kind != "number" || rightChildToken.Value != "2" {
			t.Error("Expression '5-2' failed")
		}
	} else {
		t.Error("Expression '5-2' failed")
	}
}

func TestInterpreterForUnaryMinus(t *testing.T) {
	expr := "5"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, "")

	if newInterpreter.Interpret(tree) != oldresult {
		t.Error("Expression '5' failed")
	}
}

func TestInterpreterForUnaryPlus(t *testing.T) {
	expr := "+7"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, "")

	if newInterpreter.Interpret(tree) != oldresult {
		t.Error("Expression '+7' failed")
	}
}

func TestInterpreterForNot(t *testing.T) {
	expr := "!5"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, "")

	if newInterpreter.Interpret(tree) != oldresult {
		t.Error("Expression '!5' failed")
	}
}

func TestInterpreterForBinaryPlus(t *testing.T) {
	expr := "2+3"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, "")

	if newInterpreter.Interpret(tree) != oldresult {
		t.Error("Expression '2+3' failed")
	}
}

func TestInterpreterForBinaryMinus(t *testing.T) {
	expr := "2-3"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, "")

	if newInterpreter.Interpret(tree) != oldresult {
		t.Error("Expression '2-3' failed")
	}
}

func TestInterpreterForDiv(t *testing.T) {
	expr := "6/2"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, "")

	if newInterpreter.Interpret(tree) != oldresult {
		t.Error("Expression '6/2' failed")
	}
}

func TestInterpreterForMul(t *testing.T) {
	expr := "2*3"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, "")

	if newInterpreter.Interpret(tree) != oldresult {
		t.Error("Expression '2*3' failed")
	}
}

func TestInterpreterForGreater(t *testing.T) {
	expr := "5>2"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, "")

	if newInterpreter.Interpret(tree) != oldresult {
		t.Error("Expression '5>2' failed")
	}
}

func TestInterpreterForLess(t *testing.T) {
	expr := "4<7"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, "")

	if newInterpreter.Interpret(tree) != oldresult {
		t.Error("Expression '4<7' failed")
	}
}

func TestInterpreterForMoreOrEqual(t *testing.T) {
	expr := "3>=3"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, "")

	if newInterpreter.Interpret(tree) != oldresult {
		t.Error("Expression '3>=3' failed")
	}
}

func TestInterpreterForLessOrEqual(t *testing.T) {
	expr := "6<=2"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, "")

	if newInterpreter.Interpret(tree) != oldresult {
		t.Error("Expression '6<=2' failed")
	}
}

func TestInterpreterForNotEqual(t *testing.T) {
	expr := "2!=3"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, "")

	if newInterpreter.Interpret(tree) != oldresult {
		t.Error("Expression '2!=3' failed")
	}
}

func TestInterpreterForEqual(t *testing.T) {
	expr := "5==2"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, "")

	if newInterpreter.Interpret(tree) != oldresult {
		t.Error("Expression '5==2' failed")
	}
}

func TestInterpreterForOr(t *testing.T) {
	expr := "false||false"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, "")

	if newInterpreter.Interpret(tree) != oldresult {
		t.Error("Expression 'false||false' failed")
	}
}

func TestInterpreterForAND(t *testing.T) {
	expr := "true&&false"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, "")

	if newInterpreter.Interpret(tree) != oldresult {
		t.Error("Expression 'true&&false' failed")
	}
}

func TestInterpreterForSquaring(t *testing.T) {
	expr := "2**3"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, "")

	if newInterpreter.Interpret(tree) != oldresult {
		t.Error("Expression '2**3' failed")
	}
}
