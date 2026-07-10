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

// InterpreterError indicates an error while evaluating an expression.
type InterpreterError struct {
	Message  string
	Location []string
}

func (e InterpreterError) Error() string {
	location := ""
	if len(e.Location) > 0 {
		location = " at template" + strings.Join(e.Location, "")
	}
	return fmt.Sprintf("InterpreterError%s: %s", location, e.Message)
}

// AddLocation returns a copy of the error with a location prepended.
func (e InterpreterError) AddLocation(location string) error {
	e.Location = append([]string{location}, e.Location...)
	return e
}

// BuiltinError indicates invalid arguments to a builtin function.
type BuiltinError struct {
	Message  string
	Location []string
}

func (e BuiltinError) Error() string {
	location := ""
	if len(e.Location) > 0 {
		location = " at template" + strings.Join(e.Location, "")
	}
	return fmt.Sprintf("BuiltinError%s: %s", location, e.Message)
}

// AddLocation returns a copy of the error with a location prepended.
func (e BuiltinError) AddLocation(location string) error {
	e.Location = append([]string{location}, e.Location...)
	return e
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
			return nil, InterpreterError{
				Message: "unary + expects number",
			}
		}
		return +value.(float64), nil
	case "-":
		if !isNumber(value) {
			return nil, InterpreterError{
				Message: "unary - expects number",
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
			return nil, InterpreterError{
				Message: fmt.Sprintf("object has no property %q", key),
			}
		}
		return nil, InterpreterError{
			Message: "infix: . expects objects",
		}
	case "in":
		// A in B, where B is a string
		if s, ok := right.(string); ok {
			if !isString(left) {
				return nil, InterpreterError{
					Message: "in operator expected a string when querying on a string",
				}
			}
			return strings.Contains(s, left.(string)), nil
		}

		// A in B; where B is an object
		if o, ok := right.(map[string]interface{}); ok {
			if !isString(left) {
				return nil, InterpreterError{
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

		return nil, InterpreterError{
			Message: "in operator expected string, array or object",
		}
	case "+":
		if isNumber(left) && isNumber(right) {
			return left.(float64) + right.(float64), nil
		}
		if isString(left) && isString(right) {
			return left.(string) + right.(string), nil
		}
		return nil, InterpreterError{
			Message: "infix: + expects numbers/strings + numbers/strings",
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
	value, err := i.visit(node.Arr)
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
	if target, ok := value.(map[string]interface{}); ok {
		if node.IsInterval {
			return nil, InterpreterError{
				Message: `infix: "[..]" expects object, array, or string`,
			}
		}
		key, ok := left.(string)
		if !ok {
			return nil, InterpreterError{
				Message: "object keys must be strings",
			}
		}
		if result, ok := target[key]; ok {
			return result, nil
		}
		return nil, nil
	}
	if _, ok := value.([]interface{}); !ok {
		if _, ok := value.(string); !ok {
			return nil, InterpreterError{
				Message: `infix: "[..]" expects object, array, or string`,
			}
		}
	}

	startValue, startOK := left.(float64)
	endValue, endOK := right.(float64)
	validStart := startOK && startValue == float64(int(startValue))
	validEnd := right == nil || endOK && endValue == float64(int(endValue))
	if !validStart || !validEnd {
		message := "should only use integers to access arrays or strings"
		if node.IsInterval {
			message = "cannot perform interval access with non-integers"
		}
		return nil, InterpreterError{
			Message: message,
		}
	}

	// Handle slicing of arrays
	if target, ok := value.([]interface{}); ok {
		start := int(startValue)
		end := int(endValue)
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
				return nil, InterpreterError{
					Message: "index out of bounds",
				}
			}
			return target[start], nil
		}
		return target[start:end], nil
	}
	// Handle slicing of strings
	if target, ok := value.(string); ok {
		runeLen := utf8.RuneCountInString(target)
		start := int(startValue)
		end := int(endValue)
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
					return nil, InterpreterError{
						Message: "index out of bounds",
					}
				}
				return string(target[start]), nil
			}
			return target[start:end], nil
		}
		if !node.IsInterval && start >= runeLen {
			return nil, InterpreterError{
				Message: "index out of bounds",
			}
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

	panic("value access target was not an array, string, or object")
}

func (i NewInterpreter) Visit_ContextValue(node parser.ContextValue) (interface{}, error) {
	if contextValue, ok := i.context[node.Token.Value]; ok {
		return contextValue, nil
	}
	return nil, InterpreterError{
		Message: fmt.Sprintf("unknown context value %s", node.Token.Value),
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
			name := "unknown"
			if contextValue, ok := node.Name.(parser.ContextValue); ok {
				name = contextValue.Token.Value
			}
			message := fmt.Sprintf("invalid arguments to builtin: %s", name)
			if len(args) == 0 && (name == "min" || name == "max") {
				message += ": expected at least 1 arguments"
			}
			return nil, BuiltinError{Message: message}
		}
		return result, nil
	}
	return nil, InterpreterError{
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
				return nil, InterpreterError{
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
	return nil, InterpreterError{
		Message: fmt.Sprintf("infix: %s expects number %s number", tokenKind, tokenKind),
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
		return nil, InterpreterError{
			Message: fmt.Sprintf("infix: %s expects numbers/strings %s numbers/strings", tokenKind, tokenKind),
		}
	}
	panic(fmt.Sprintf("unknown comparison operator: '%s'", tokenKind))
}
