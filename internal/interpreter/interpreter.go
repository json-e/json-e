package interpreter

import (
	"fmt"
	"math"
	"reflect"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/json-e/json-e/v4/internal/interpreter/parser"
)

type NewInterpreter struct {
	context map[string]interface{}
}

func (i *NewInterpreter) AddContext(context map[string]interface{}) {
	i.context = context
}

func (i NewInterpreter) visit(node parser.IASTNode) (interface{}, error) {
	var err error
	nodeType := strings.Split(fmt.Sprintf("%T", node), ".")[1]
	funcName := "Visit_" + nodeType

	arg := make([]reflect.Value, 1)
	arg[0] = reflect.ValueOf(node)

	val := reflect.ValueOf(i).MethodByName(funcName).Call(arg)
	if val[1].Interface() == nil {
		err = nil
	} else {
		err = val[1].Interface().(error)
	}
	return val[0].Interface(), err
}

func (i NewInterpreter) Visit_ASTNode(node parser.ASTNode) (interface{}, error) {
	token := node.Token

	switch token.Kind {
	case "number":
		value, _ := strconv.ParseFloat(token.Value, 64)
		return value, nil
	case "null":
		return nil, nil
	case "string":
		return token.Value[1 : len(token.Value)-1], nil
	case "true":
		return true, nil
	case "false":
		return false, nil
	case "identifier":
		return node.Token.Value, nil
	}
	panic(fmt.Sprintf("unknown primitive token: '%s'", node.Token.Kind))
}

func (i NewInterpreter) Visit_UnaryOp(node parser.UnaryOp) (interface{}, error) {
	value, err := i.visit(node.Expr)
	if err != nil {
		return nil, err
	}

	switch node.Token.Kind {
	case "+":
		if !isNumber(value) {
			return nil, parser.SyntaxError{
				Message: "Expected number after +",
			}
		}
		return +value.(float64), nil
	case "-":
		if !isNumber(value) {
			return nil, parser.SyntaxError{
				Message: "Expected number after -",
			}
		}
		return -value.(float64), nil
	case "!":
		return !IsTruthy(value), nil
	case "true":
		return true, nil
	case "false":
		return false, nil
	}
	panic(fmt.Sprintf("unknown unary operator: '%s'", node.Token.Kind))
}

func (i NewInterpreter) Visit_BinOp(node parser.BinOp) (interface{}, error) {
	var right interface{}
	mathOperators := []string{"-", "*", "/", "**"}
	compareOperators := []string{"<=", ">=", "<", ">"}
	tokenKind := node.Token.Kind
	left, err := i.visit(node.Left)
	if err != nil {
		return nil, err
	}

	switch tokenKind {
	case "||":
		if IsTruthy(left) {
			return true, nil
		} else {
			right, err = i.visit(node.Right)
			return IsTruthy(right), err
		}
	case "&&":
		if !IsTruthy(left) {
			return false, nil
		} else {
			right, err = i.visit(node.Right)
			return IsTruthy(right), err
		}
	default:
		right, err = i.visit(node.Right)
		if err != nil {
			return nil, err
		}
	}

	switch tokenKind {
	case "==":
		return deepEquals(left, right), nil
	case "!=":
		return !deepEquals(left, right), nil
	case ".":
		obj := left
		key := right.(string)
		if target, ok := obj.(map[string]interface{}); ok {
			if value, ok := target[key]; ok {
				return value, nil
			}
			return nil, parser.SyntaxError{
				Message: "object has no such property",
			}
		}
		return nil, parser.SyntaxError{
			Message: "cannot access properties of non-object",
		}
	case "in":
		// A in B, where B is a string
		if s, ok := right.(string); ok {
			if !isString(left) {
				return nil, parser.SyntaxError{
					Message: "in operator expected a string when querying on a string",
				}
			}
			return strings.Contains(s, left.(string)), nil
		}

		// A in B; where B is an object
		if o, ok := right.(map[string]interface{}); ok {
			if !isString(left) {
				return nil, parser.SyntaxError{
					Message: "in operator expected a string when querying on an object",
				}
			}
			_, result := o[left.(string)]
			return result, nil
		}

		// A in B; where B is an array
		if a, ok := right.([]interface{}); ok {
			for _, val := range a {
				if deepEquals(left, val) {
					return true, nil
				}
			}
			return false, nil
		}

		return nil, parser.SyntaxError{
			Message: "in operator expected string, array or object",
		}
	case "+":
		if isNumber(left) && isNumber(right) {
			return left.(float64) + right.(float64), nil
		}
		if isString(left) && isString(right) {
			return left.(string) + right.(string), nil
		}
		return nil, parser.SyntaxError{
			Message: "Expected either number of string operands",
		}

	}

	if parser.StringsContains(tokenKind, mathOperators) {
		return mathOp(left, right, tokenKind)
	} else if parser.StringsContains(tokenKind, compareOperators) {
		return comparisonOp(left, right, tokenKind)
	}

	panic(fmt.Sprintf("unknown binary operator: '%s'", node.Token.Kind))
}

func (i NewInterpreter) Visit_List(node parser.List) (interface{}, error) {
	var list []interface{}

	if len(node.List) > 0 {
		for _, element := range node.List {
			elem, err := i.visit(element)
			if err != nil {
				return nil, err
			}
			list = append(list, elem)
		}
	}

	return list, nil
}

func (i NewInterpreter) Visit_ValueAccess(node parser.ValueAccess) (interface{}, error) {
	arr, err := i.visit(node.Arr)
	if err != nil {
		return nil, err
	}
	var right, left interface{}
	if node.Left != nil {
		left, err = i.visit(node.Left)
		if err != nil {
			return nil, err
		}
	} else {
		left = float64(0)
	}
	if node.Right != nil {
		right, err = i.visit(node.Right)
		if err != nil {
			return nil, err
		}
	}
	// handle access to object properties
	if !node.IsInterval {
		if target, ok := arr.(map[string]interface{}); ok {
			if k, ok := left.(string); ok {
				if value, ok := target[k]; ok {
					return value, nil
				}
				return nil, nil
			}
			return nil, parser.SyntaxError{
				Message: "object properties must be accessed with strings",
			}
		}
	}

	// Check that we have integer arguments
	A, aok := left.(float64)
	B, bok := right.(float64)
	if !aok || A != float64(int(A)) || (right != nil && !(bok && B == float64(int(B)))) {
		return nil, parser.SyntaxError{
			Message: "slicing can only be used with integer arguments",
		}
	}

	// Handle slicing of arrays
	if target, ok := arr.([]interface{}); ok {
		start := int(A)
		end := int(B)
		if right == nil {
			end = len(target)
		}
		if start < 0 {
			start = len(target) + start
			if start < 0 {
				start = 0
			}
		}
		if end < 0 {
			end = len(target) + end
			if end < 0 {
				end = 0
			}
		}
		if end > len(target) {
			end = len(target)
		}
		if start > end {
			start = end
		}
		if !node.IsInterval {
			if start >= len(target) {
				return nil, parser.SyntaxError{
					Message: "string index out of bounds",
				}
			}
			return target[start], nil
		}
		return target[start:end], nil
	}
	// Handle slicing of strings
	if target, ok := arr.(string); ok {
		runeLen := utf8.RuneCountInString(target)
		start := int(A)
		end := int(B)
		if right == nil {
			end = runeLen
		}
		if start < 0 {
			start = runeLen + start
			if start < 0 {
				start = 0
			}
		}
		if end < 0 {
			end = runeLen + end
			if end < 0 {
				end = 0
			}
		}
		if end > runeLen {
			end = len(target)
		}
		if start > end {
			start = end
		}
		if runeLen == len(target) {
			// The target contains only 1-byte offsets, so we can
			// simply slice or index it.
			if !node.IsInterval {
				if start >= runeLen {
					return nil, parser.SyntaxError{
						Message: "string index out of bounds",
					}
				}
				return string(target[start]), nil
			}
			return target[start:end], nil
		}
		// The target contains multi-byte characters, so we must
		// iterate over it from the beginning.
		i, c := 0, 0
		for c < start {
			var width int
			_, width = utf8.DecodeRuneInString(target[i:])
			i += width
			c++
		}
		if !node.IsInterval {
			r, _ := utf8.DecodeRuneInString(target[i:])
			return string(r), nil
		}
		start_i := i
		for c < end {
			_, width := utf8.DecodeRuneInString(target[i:])
			i += width
			c++
		}
		end_i := i
		return target[start_i:end_i], nil
	}

	return nil, parser.SyntaxError{
		Message: "slicing can only be used on arrays and strings",
	}
}

func (i NewInterpreter) Visit_ContextValue(node parser.ContextValue) (interface{}, error) {
	if contextValue, ok := i.context[node.Token.Value]; ok {
		return contextValue, nil
	}
	return nil, parser.SyntaxError{
		Message: fmt.Sprintf("undefined variable %s", node.Token.Value),
	}
}
func (i NewInterpreter) Visit_FunctionCall(node parser.FunctionCall) (interface{}, error) {

	var args []interface{}
	funcName, err := i.visit(node.Name)
	if err != nil {
		return nil, err
	}
	f, ok := funcName.(*function)
	if ok {
		var result interface{}

		for _, element := range node.Args {
			elem, err := i.visit(element)
			if err != nil {
				return nil, err
			}
			args = append(args, elem)
		}

		result, err := f.Invoke(i.context, args)
		if err != nil {
			return nil, err
		}
		return result, nil
	}
	return nil, parser.SyntaxError{
		Message: fmt.Sprintf("%s is not callable", funcName),
	}
}

func (i NewInterpreter) Visit_Object(node parser.Object) (interface{}, error) {
	var err error
	obj := make(map[string]interface{})
	for key, element := range node.Obj {
		obj[key], err = i.visit(element)
		if err != nil {
			return nil, err
		}
	}
	return obj, nil
}

func (i NewInterpreter) Interpret(node parser.IASTNode) (result interface{}, err error) {
	result, err = i.visit(node)
	return
}

func mathOp(left, right interface{}, tokenKind string) (interface{}, error) {

	if isNumber(left) && isNumber(right) {
		l := left.(float64)
		r := right.(float64)
		switch tokenKind {
		case "-":
			return l - r, nil
		case "*":
			return l * r, nil
		case "/":
			if r == 0.0 {
				return nil, parser.SyntaxError{
					Message: "division by zero",
				}
			}
			return l / r, nil
		case "**":
			return math.Pow(r, l), nil
		default:
			panic("unknown operator")
		}
	}
	return nil, parser.SyntaxError{
		Message: "expected number operands",
	}
}

func comparisonOp(left, right interface{}, tokenKind string) (interface{}, error) {
	if isNumber(left) && isNumber(right) {
		l := left.(float64)
		r := right.(float64)
		switch tokenKind {
		case ">=":
			return l >= r, nil
		case "<=":
			return l <= r, nil
		case "<":
			return l < r, nil
		case ">":
			return l > r, nil
		}
	} else if isString(left) && isString(right) {
		l := left.(string)
		r := right.(string)
		switch tokenKind {
		case ">=":
			return l >= r, nil
		case "<=":
			return l <= r, nil
		case "<":
			return l < r, nil
		case ">":
			return l > r, nil
		}
	} else {
		return nil, parser.SyntaxError{
			Message: "comparison operator requires two strings or numbers",
		}
	}
	panic(fmt.Sprintf("unknown comparison operator: '%s'", tokenKind))
}
