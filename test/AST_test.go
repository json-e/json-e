package tests

import (
	"json-e/interpreter/newparser"
	"json-e/interpreter/prattparser"
	"reflect"
	"testing"
)

func TestTermConstructor(t *testing.T) {
	var node newparser.ASTnode
	var token prattparser.Token

	node.NewNode(token)

	if reflect.TypeOf(node).Name() != "ASTnode" {
		t.Error("Constructor for binary operations failed")
	}

}

func TestBinOpConstructor(t *testing.T) {
	var node newparser.BinOp
	var left, right newparser.UnaryOp
	var op prattparser.Token

	node.NewNode(op, left, right)

	if reflect.TypeOf(node).Name() != "BinOp" {
		t.Error("Constructor for binary operations failed")
	}

}

func TestUnaryOpConstructor(t *testing.T) {
	var node newparser.UnaryOp
	var expr newparser.ASTnode
	var op prattparser.Token

	node.NewNode(op, expr)

	if reflect.TypeOf(node).Name() != "UnaryOp" {
		t.Error("Constructor for unary operations failed")
	}

}

func TestBuiltinConstructor(t *testing.T) {
	var node newparser.Builtin
	var token prattparser.Token
	var args []newparser.ASTnodeIntr
	var builtin string

	node.NewNode(token, builtin, args)

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
