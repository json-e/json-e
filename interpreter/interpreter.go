package interpreter

import (
	"fmt"
	"math"
	"strconv"
	"strings"

	pp "json-e/interpreter/prattparser"
)

var Interpreter = pp.New(`\s+`, strings.Split(
	`** + - * / [ ] . ( ) { } : , >= <= < > == != ! && || true false in null number identifier string`, " ",
), map[string]string{
	"number":     `[0-9]+(?:\.[0-9]+)?`,
	"identifier": `[a-zA-Z_][a-zA-Z_0-9]*`,
	"string":     `'[^']*'|"[^"]*"`,
	"true":       `true\b`,
	"false":      `false\b`,
	"in":         `in\b`,
	"null":       `null\b`,
}, [][]string{
	{"||"},
	{"&&"},
	{"in"},
	{"==", "!="},
	{">=", "<=", "<", ">"},
	{"+", "-"},
	{"*", "/"},
	{"**-right-associative"},
	{"**"},
	{"[", "."},
	{"("},
	{"unary"},
}, prefixRules, infixRules)

var prefixRules = map[string]pp.PrefixRule{
	"number": func(token pp.Token, ctx *pp.Context) (interface{}, error) {
		value, _ := strconv.ParseFloat(token.Value, 64)
		return value, nil
	},
	"!": func(token pp.Token, ctx *pp.Context) (interface{}, error) {
		v, err := ctx.Parse("unary")
		if err != nil {
			return nil, err
		}
		return !IsTruthy(v), nil
	},
	"-": func(token pp.Token, ctx *pp.Context) (interface{}, error) {
		v, err := ctx.Parse("unary")
		if err != nil {
			return nil, err
		}
		if !isNumber(v) {
			return nil, pp.SyntaxError{
				Message: fmt.Sprintf("Expected number after %s", token.Value),
				Source:  ctx.Source(),
				Start:   token.End,
				End:     token.End,
			}
		}
		return -v.(float64), nil
	},
	"+": func(token pp.Token, ctx *pp.Context) (interface{}, error) {
		v, err := ctx.Parse("unary")
		if err != nil {
			return nil, err
		}
		if !isNumber(v) {
			return nil, pp.SyntaxError{
				Message: fmt.Sprintf("Expected number after %s", token.Value),
				Source:  ctx.Source(),
				Start:   token.End,
				End:     token.End,
			}
		}
		return +v.(float64), nil
	},
	"identifier": func(token pp.Token, ctx *pp.Context) (interface{}, error) {
		m := ctx.Context().(map[string]interface{})
		if v, ok := m[token.Value]; ok {
			return v, nil
		}
		return nil, pp.SyntaxError{
			Message: fmt.Sprintf("undefined variable %s", token.Value),
			Source:  ctx.Source(),
			Start:   token.Start,
			End:     token.End,
		}
	},
	"null": func(token pp.Token, ctx *pp.Context) (interface{}, error) {
		return nil, nil
	},
	"[": func(token pp.Token, ctx *pp.Context) (interface{}, error) {
		var value []interface{}
		term, err := ctx.Attempt("]")
		if err != nil {
			return nil, err
		}
		if term.IsEmpty() {
			for {
				v, err := ctx.Parse("")
				if err != nil {
					return nil, err
				}
				value = append(value, v)
				sep, err := ctx.Attempt(",")
				if err != nil {
					return nil, err
				}
				if sep.IsEmpty() {
					break
				}
			}
			if _, err := ctx.Require("]"); err != nil {
				return nil, err
			}
		}
		return value, nil
	},
	"(": func(token pp.Token, ctx *pp.Context) (interface{}, error) {
		v, err := ctx.Parse("")
		if err != nil {
			return nil, err
		}
		if _, err = ctx.Require(")"); err != nil {
			return nil, err
		}
		return v, nil
	},
	"{": func(token pp.Token, ctx *pp.Context) (interface{}, error) {
		obj := make(map[string]interface{})
		term, err := ctx.Attempt("}")
		if err != nil {
			return nil, err
		}
		if term.IsEmpty() {
			for {
				var k, sep pp.Token
				k, err = ctx.Require("identifier", "string")
				if err != nil {
					return nil, err
				}
				if k.Kind == "string" {
					k.Value = parseString(k.Value)
				}
				if _, err = ctx.Require(":"); err != nil {
					return nil, err
				}
				var v interface{}
				v, err = ctx.Parse("")
				if err != nil {
					return nil, err
				}
				obj[k.Value] = v
				sep, err = ctx.Attempt(",")
				if err != nil {
					return nil, err
				}
				if sep.IsEmpty() {
					break
				}
			}
			if _, err = ctx.Require("}"); err != nil {
				return nil, err
			}
		}
		return obj, nil
	},
	"string": func(token pp.Token, ctx *pp.Context) (interface{}, error) {
		return parseString(token.Value), nil
	},
	"true": func(token pp.Token, ctx *pp.Context) (interface{}, error) {
		return true, nil
	},
	"false": func(token pp.Token, ctx *pp.Context) (interface{}, error) {
		return false, nil
	},
}

func parseString(s string) string {
	return s[1 : len(s)-1] // TODO: Ensure this is correct...
}

var infixRules = map[string]pp.InfixRule{
	"+": func(left interface{}, token pp.Token, ctx *pp.Context) (interface{}, error) {
		right, err := ctx.Parse(token.Kind)
		if err != nil {
			return nil, err
		}
		if isNumber(left) && isNumber(right) {
			return left.(float64) + right.(float64), nil
		}
		if isString(left) && isString(right) {
			return left.(string) + right.(string), nil
		}
		return nil, pp.SyntaxError{
			Message: "Expected either number of string operands",
			Source:  ctx.Source(),
			Start:   token.Start,
			End:     token.End,
		}
	},
	"-":  mathOperator,
	"*":  mathOperator,
	"/":  mathOperator,
	"**": mathOperator,
	"[":  intervalOperator,
	".": func(left interface{}, token pp.Token, ctx *pp.Context) (interface{}, error) {
		// Read the identifier
		id, err := ctx.Require("identifier")
		if err != nil {
			return nil, err
		}

		// Return value from target, if it's an object
		if target, ok := left.(map[string]interface{}); ok {
			if value, ok := target[id.Value]; ok {
				return value, nil
			}
			return nil, pp.SyntaxError{
				Message: "object has no such property",
				Source:  ctx.Source(),
				Start:   token.Start,
				End:     token.End,
			}
		}
		// Return error, if not given an object
		return nil, pp.SyntaxError{
			Message: "cannot access properties of non-object",
			Source:  ctx.Source(),
			Start:   token.Start,
			End:     token.End,
		}
	},
	"(": func(left interface{}, token pp.Token, ctx *pp.Context) (interface{}, error) {
		var params []interface{}
		term, err := ctx.Attempt(")")
		if err != nil {
			return nil, err
		}
		if term.IsEmpty() {
			for {
				var value interface{}
				value, err = ctx.Parse("")
				if err != nil {
					return nil, err
				}
				params = append(params, value)
				var sep pp.Token
				sep, err = ctx.Attempt(",")
				if err != nil {
					return nil, err
				}
				if sep.IsEmpty() {
					break
				}
			}
			term, err = ctx.Require(")")
			if err != nil {
				return nil, err
			}
		}

		if f, ok := left.(*function); ok {
			var result interface{}
			result, err = f.Invoke(ctx.Context().(map[string]interface{}), params)
			if err != nil {
				return nil, pp.SyntaxError{
					Message: err.Error(),
					Source:  ctx.Source(),
					Start:   token.Start,
					End:     term.End,
				}
			}
			return result, nil
		}

		return nil, pp.SyntaxError{
			Message: "cannot invoke function call on non-function value",
			Source:  ctx.Source(),
			Start:   token.Start,
			End:     term.End,
		}
	},
	"==": comparisonOperator,
	"!=": comparisonOperator,
	"<=": comparisonOperator,
	">=": comparisonOperator,
	"<":  comparisonOperator,
	">":  comparisonOperator,
	"||": logicalOperator,
	"&&": logicalOperator,
	"in": inOperator,
}

func intervalOperator(left interface{}, token pp.Token, ctx *pp.Context) (interface{}, error) {
	var a, b interface{}

	var isInterval bool
	sep, err := ctx.Attempt(":")
	if err != nil {
		return nil, err
	}
	if !sep.IsEmpty() {
		a = float64(0)
		isInterval = true
	} else {
		a, err = ctx.Parse("")
		if err != nil {
			return nil, err
		}
		sep, err = ctx.Attempt(":")
		if err != nil {
			return nil, err
		}
		isInterval = !sep.IsEmpty()
	}

	if isInterval {
		var term pp.Token
		term, err = ctx.Attempt("]")
		if err != nil {
			return nil, err
		}
		if term.IsEmpty() {
			b, err = ctx.Parse("")
			if err != nil {
				return nil, err
			}
			_, err = ctx.Require("]")
			if err != nil {
				return nil, err
			}
		}
	} else {
		_, err = ctx.Require("]")
		if err != nil {
			return nil, err
		}
	}

	// handle access to object properties
	if !isInterval {
		if target, ok := left.(map[string]interface{}); ok {
			if k, ok := a.(string); ok {
				if value, ok := target[k]; ok {
					return value, nil
				}
				return nil, nil
			}
			return nil, pp.SyntaxError{
				Message: "object properties must be accessed with strings",
				Source:  ctx.Source(),
				Start:   token.Start,
				End:     token.End,
			}
		}
	}

	// Check that we have integer arguments
	A, aok := a.(float64)
	B, bok := b.(float64)
	if !aok || A != float64(int(A)) || (b != nil && !(bok && B == float64(int(B)))) {
		return nil, pp.SyntaxError{
			Message: "slicing can only be used with integer arguments",
			Source:  ctx.Source(),
			Start:   token.Start,
			End:     token.End,
		}
	}

	// Handle slicing of arrays
	if target, ok := left.([]interface{}); ok {
		start := int(A)
		end := int(B)
		if b == nil {
			end = len(target)
		}
		if start < 0 {
			start = len(target) + start
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
		if !isInterval {
			if start >= len(target) {
				return nil, pp.SyntaxError{
					Message: "string index out of bounds",
					Source:  ctx.Source(),
					Start:   token.Start,
					End:     token.End,
				}
			}
			return target[start], nil
		}
		return target[start:end], nil
	}

	// Handle slicing of strings
	if target, ok := left.(string); ok {
		// TODO: Handle utf-8 encoding...
		start := int(A)
		end := int(B)
		if b == nil {
			end = len(target)
		}
		if start < 0 {
			start = len(target) + start
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
		if !isInterval {
			if start >= len(target) {
				return nil, pp.SyntaxError{
					Message: "string index out of bounds",
					Source:  ctx.Source(),
					Start:   token.Start,
					End:     token.End,
				}
			}
			return string(target[start]), nil
		}
		return target[start:end], nil
	}

	return nil, pp.SyntaxError{
		Message: "slicing can only be used on arrays and strings",
		Source:  ctx.Source(),
		Start:   token.Start,
		End:     token.End,
	}
}

func mathOperator(left interface{}, token pp.Token, ctx *pp.Context) (interface{}, error) {
	prec := token.Kind
	if prec == "**" {
		prec = "**-right-associative"
	}
	right, err := ctx.Parse(prec)
	if err != nil {
		return nil, err
	}
	if isNumber(left) && isNumber(right) {
		l := left.(float64)
		r := right.(float64)
		switch token.Kind {
		case "-":
			return l - r, nil
		case "*":
			return l * r, nil
		case "/":
			return l / r, nil
		case "**":
			return math.Pow(l, r), nil
		default:
			panic("unknown operator")
		}
	}
	return nil, pp.SyntaxError{
		Message: "expected number operands",
		Source:  ctx.Source(),
		Start:   token.Start,
		End:     token.End,
	}
}

func comparisonOperator(left interface{}, token pp.Token, ctx *pp.Context) (interface{}, error) {
	right, err := ctx.Parse(token.Kind)
	if err != nil {
		return nil, err
	}

	if token.Kind == "==" {
		return DeepEquals(left, right), nil
	}
	if token.Kind == "!=" {
		return !DeepEquals(left, right), nil
	}

	if isNumber(left) && isNumber(right) {
		l := left.(float64)
		r := right.(float64)
		switch token.Kind {
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
		switch token.Kind {
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
		return nil, pp.SyntaxError{
			Message: "comparison operator requires two strings or numbers",
			Source:  ctx.Source(),
			Start:   token.Start,
			End:     token.End,
		}
	}
	panic(fmt.Sprintf("unknown comparison operator: '%s'", token.Kind))
}

func logicalOperator(left interface{}, token pp.Token, ctx *pp.Context) (interface{}, error) {
	right, err := ctx.Parse(token.Kind)
	if err != nil {
		return nil, err
	}

	switch token.Kind {
	case "&&":
		return IsTruthy(left) && IsTruthy(right), nil
	case "||":
		return IsTruthy(left) || IsTruthy(right), nil
	}
	panic(fmt.Sprintf("unknown logical operator: %s", token.Kind))
}

func inOperator(left interface{}, token pp.Token, ctx *pp.Context) (interface{}, error) {
	right, err := ctx.Parse(token.Kind)
	if err != nil {
		return nil, err
	}

	// A in B, where B is a string
	if s, ok := right.(string); ok {
		if !isString(left) {
			return nil, pp.SyntaxError{
				Message: "in operator expected a string when querying on a string",
				Source:  ctx.Source(),
				Start:   token.Start,
				End:     token.End,
			}
		}
		return strings.Contains(s, left.(string)), nil
	}

	// A in B; where B is an object
	if o, ok := right.(map[string]interface{}); ok {
		if !isString(left) {
			return nil, pp.SyntaxError{
				Message: "in operator expected a string when querying on an object",
				Source:  ctx.Source(),
				Start:   token.Start,
				End:     token.End,
			}
		}
		_, result := o[left.(string)]
		return result, nil
	}

	// A in B; where B is an array
	if a, ok := right.([]interface{}); ok {
		for _, val := range a {
			if DeepEquals(left, val) {
				return true, nil
			}
		}
		return false, nil
	}

	return nil, pp.SyntaxError{
		Message: "in operator expected string, array or object",
		Source:  ctx.Source(),
		Start:   token.Start,
		End:     token.End,
	}
}
