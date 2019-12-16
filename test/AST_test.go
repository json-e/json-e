package tests

import (
	"AST"
	"reflect"
	"testing"
)

func TestTermConstructor(t *testing.T) {
	var node AST.Term
	var token AST.Tkn

	node.NewNode(token)

	if reflect.TypeOf(node).Name() != "Term" {
		t.Error()
	}

}

func TestBinOpConstructor(t *testing.T) {
	var node AST.BinOp
	var left, right AST.UnaryOp
	var op AST.Tkn

	node.NewNode(left, right, op)

	if reflect.TypeOf(node).Name() != "BinOp" {
		t.Error()
	}

}

func TestUnaryOpConstructor(t *testing.T) {
	var node AST.UnaryOp
	var expr AST.Term
	var op AST.Tkn

	node.NewNode(op, expr)

	if reflect.TypeOf(node).Name() != "UnaryOp" {
		t.Error()
	}

}

func TestBuiltinConstructor(t *testing.T) {
	var node AST.Builtin
	var token AST.Tkn
	var args []AST.AST
	var builtin string

	node.NewNode(builtin, args, token)

	if reflect.TypeOf(node).Name() != "Builtin" {
		t.Error()
	}

}
