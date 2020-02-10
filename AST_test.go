package jsone

import (
	"./interpreter"
	"./interpreter/newparser"
	"./interpreter/prattparser"
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
		child := node.(newparser.UnaryOp).Expr
		childToken := child.GetToken()
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
		leftChild := node.(newparser.BinOp).Left
		leftChildToken := leftChild.GetToken()
		rightChild := node.(newparser.BinOp).Right
		rightChildToken := rightChild.GetToken()
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

func TestInterpreterForBuiltinFunction(t *testing.T) {
	expr := "max(5,2,9)"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter

	c := make(map[string]interface{}, len(Builtin)+1)
	for k, v := range Builtin {
		c[k] = v
	}

	newInterpreter.AddContext(c)
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, c)
	newresult := newInterpreter.Interpret(tree)

	if newresult != oldresult {
		t.Error("Expression 'max(5,2,9)' failed")
	}
}

func TestInterpreterForBuiltin(t *testing.T) {
	expr := "a"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	context := map[string]interface{}{"a": 3}

	c := make(map[string]interface{}, len(context)+len(Builtin)+1)
	for k, v := range Builtin {
		c[k] = v
	}
	for k, v := range context {
		c[k] = v
	}

	newInterpreter.AddContext(c)
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, c)
	newresult := newInterpreter.Interpret(tree)

	if newresult != oldresult {
		t.Error("Expression 'a' with context 'a: 3' failed")
	}
}

func TestInterpreterForEmptyList(t *testing.T) {
	expr := "[]"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter

	c := make(map[string]interface{}, len(Builtin)+1)
	for k, v := range Builtin {
		c[k] = v
	}

	newInterpreter.AddContext(c)
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, c)
	newresult := newInterpreter.Interpret(tree)

	if !interpreter.DeepEquals(oldresult, newresult) {
		t.Error("Expression '[]'  failed")
	}
}

func TestInterpreterForList(t *testing.T) {
	expr := "[2,5]"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter

	c := make(map[string]interface{}, len(Builtin)+1)
	for k, v := range Builtin {
		c[k] = v
	}

	newInterpreter.AddContext(c)
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, c)
	newresult := newInterpreter.Interpret(tree)

	if !interpreter.DeepEquals(oldresult, newresult) {
		t.Error("Expression '[2,5]' with context failed")
	}
}

func TestInterpreterForArrayAccess(t *testing.T) {
	expr := "a[2]"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	contextList := []interface{}{1, 2, 3, 4}
	context := map[string]interface{}{"a": contextList}

	c := make(map[string]interface{}, len(context)+len(Builtin)+1)
	for k, v := range Builtin {
		c[k] = v
	}
	for k, v := range context {
		c[k] = v
	}

	newInterpreter.AddContext(c)
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, c)
	newresult := newInterpreter.Interpret(tree)

	if oldresult != newresult {
		t.Error("Expression 'a[2]' failed")
	}
}

func TestInterpreterForIntervalWithOneLeftArg(t *testing.T) {
	expr := "a[2:]"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	contextList := []interface{}{1, 2, 3, 4}
	context := map[string]interface{}{"a": contextList}

	c := make(map[string]interface{}, len(context)+len(Builtin)+1)
	for k, v := range Builtin {
		c[k] = v
	}
	for k, v := range context {
		c[k] = v
	}

	newInterpreter.AddContext(c)
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, c)
	newresult := newInterpreter.Interpret(tree)

	if !equal(oldresult.([]interface{}), newresult.([]interface{})) {
		t.Error("Expression 'a[2:]' failed")
	}
}

func TestInterpreterForIntervalWithOneRightArg(t *testing.T) {
	expr := "a[:2]"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	contextList := []interface{}{1, 2, 3, 4}
	context := map[string]interface{}{"a": contextList}

	c := make(map[string]interface{}, len(context)+len(Builtin)+1)
	for k, v := range Builtin {
		c[k] = v
	}
	for k, v := range context {
		c[k] = v
	}

	newInterpreter.AddContext(c)
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, c)
	newresult := newInterpreter.Interpret(tree)

	if !equal(oldresult.([]interface{}), newresult.([]interface{})) {
		t.Error("Expression 'a[:2]' failed")
	}
}

func TestInterpreterForInterval(t *testing.T) {
	expr := "a[2:4]"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	contextList := []interface{}{1, 2, 3, 4}
	context := map[string]interface{}{"a": contextList}

	c := make(map[string]interface{}, len(context)+len(Builtin)+1)
	for k, v := range Builtin {
		c[k] = v
	}
	for k, v := range context {
		c[k] = v
	}

	newInterpreter.AddContext(c)
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, c)
	newresult := newInterpreter.Interpret(tree)

	if !equal(oldresult.([]interface{}), newresult.([]interface{})) {
		t.Error("Expression 'a[2:3]' failed")
	}
}

func TestInterpreterForEmptyObject(t *testing.T) {
	expr := "{}"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	context := map[string]interface{}{}

	newInterpreter.AddContext(context)
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, context)
	newresult := newInterpreter.Interpret(tree)

	if !interpreter.DeepEquals(oldresult, newresult) {
		t.Error("Expression {} failed")
	}
}

func TestInterpreterForObject(t *testing.T) {
	expr := "{k : 2}"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	context := map[string]interface{}{}

	newInterpreter.AddContext(context)
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, context)
	newresult := newInterpreter.Interpret(tree)

	if !interpreter.DeepEquals(oldresult, newresult) {
		t.Error("Expression {k : 2} failed")
	}
}

func TestInterpreterForComplexObject(t *testing.T) {
	expr := "{\"a\" : 2+5, b : \"zxc\"}"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	context := map[string]interface{}{}

	newInterpreter.AddContext(context)
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, context)
	newresult := newInterpreter.Interpret(tree)

	if !interpreter.DeepEquals(oldresult, newresult) {
		t.Error("Expression {\"a\" : 2+5, b : \"zxc\"} failed")
	}
}

func TestInterpreterForDotOp(t *testing.T) {
	expr := "{a: 1}.a"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	context := map[string]interface{}{}

	newInterpreter.AddContext(context)
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, context)
	newresult := newInterpreter.Interpret(tree)

	if !interpreter.DeepEquals(oldresult, newresult) {
		t.Error("Expression {a: 1}.a failed")
	}
}

func TestInterpreterForDotOpWithContext(t *testing.T) {
	expr := "k.b"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	b := map[string]interface{}{"b": 8}
	context := map[string]interface{}{"k": b}

	newInterpreter.AddContext(context)
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, context)
	newresult := newInterpreter.Interpret(tree)

	if oldresult != newresult {
		t.Error("Expression k.b failed")
	}
}

func TestInterpreterForInOpWithArray(t *testing.T) {
	expr := "5 in [\"5\", \"five\"]"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	context := map[string]interface{}{}

	newInterpreter.AddContext(context)
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, context)
	newresult := newInterpreter.Interpret(tree)

	if oldresult != newresult {
		t.Error("Expression '5 in [\"5\", \"five\"]' failed")
	}
}

func TestInterpreterForInOpWithObject(t *testing.T) {
	expr := "\"5\" in {\"5\": \"five\"}"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	context := map[string]interface{}{}

	newInterpreter.AddContext(context)
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, context)
	newresult := newInterpreter.Interpret(tree)

	if oldresult != newresult {
		t.Error("Expression '5\" in {\"5\": \"five\"}' failed")
	}
}

func TestInterpreterForInOpWithString(t *testing.T) {
	expr := "\"abc\" in \"aabc\""
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	context := map[string]interface{}{}

	newInterpreter.AddContext(context)
	oldInterpreter := interpreter.Interpreter
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	oldresult, _ := oldInterpreter.Parse(expr, 0, context)
	newresult := newInterpreter.Interpret(tree)

	if oldresult != newresult {
		t.Error("Expression \"abc\" in \"aabc\" failed")
	}
}

func TestInterpreterForOrShortCircuitEvaluation(t *testing.T) {
	expr := "true || a"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	context := map[string]interface{}{}

	newInterpreter.AddContext(context)
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	newresult := newInterpreter.Interpret(tree)

	if newresult != true {
		t.Error("Expression 'true || a' failed")
	}
}

func TestInterpreterForAndShortCircuitEvaluation(t *testing.T) {
	expr := "false && a"
	var parser newparser.Parser
	var newInterpreter interpreter.NewInterpreter
	context := map[string]interface{}{}

	newInterpreter.AddContext(context)
	tokenizer := newparser.CreateTokenizer()

	parser.NewParser(expr, tokenizer)
	tree := parser.Parse()
	newresult := newInterpreter.Interpret(tree)

	if newresult != false {
		t.Error("Expression 'false && a' failed")
	}
}

func equal(a, b []interface{}) bool {
	if len(a) != len(b) {
		return false
	}
	for i, v := range a {
		if v != b[i] {
			return false
		}
	}
	return true
}
