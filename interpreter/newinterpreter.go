package interpreter

import (
	"fmt"
	"json-e/interpreter/newparser"
	"math"
	"reflect"
	"strconv"
	"strings"
)

type NewInterpreter struct{}

func (i NewInterpreter) visit(node newparser.IASTNode) interface{} {
	nodeType := strings.Split(fmt.Sprintf("%T", node), ".")[1]
	funcName := "Visit_" + nodeType

	arg := make([]reflect.Value, 1)
	arg[0] = reflect.ValueOf(node)

	val := reflect.ValueOf(i).MethodByName(funcName).Call(arg)

	return val[0].Interface()
}

func (i NewInterpreter) Visit_ASTNode(node newparser.IASTNode) interface{} {
	token := node.GetToken()

	switch token.Kind {
	case "number":
		value, _ := strconv.ParseFloat(token.Value, 64)
		return value
	case "null":
		return nil
	case "string":
		return token.Value
	case "true":
		return true
	case "false":
		return false
	}
	return nil
}

func (i NewInterpreter) Visit_UnaryOp(node newparser.IASTNode) interface{} {
	next := i.visit(*node.GetLeftChild())

	switch node.GetToken().Kind {
	case "+":
		return +next.(float64)
	case "-":
		return -next.(float64)
	case "!":
		return NOT(next)
	case "true":
		return true
	case "false":
		return false
	}
	return nil
}

func (i NewInterpreter) Visit_BinOp(node newparser.IASTNode) interface{} {
	left := i.visit(*node.GetLeftChild())
	right := i.visit(*node.GetRightChild())

	switch node.GetToken().Kind {
	case "&&":
		return IsTruthy(left) && IsTruthy(right)
	case "||":
		return IsTruthy(left) || IsTruthy(right)
	case "==":
		return deepEquals(left, right)
	case "!=":
		return !deepEquals(left, right)
	}

	if isNumber(left) && isNumber(right) {
		l := left.(float64)
		r := right.(float64)

		switch node.GetToken().Kind {
		case ">=":
			return l >= r
		case "<=":
			return l <= r
		case "<":
			return l < r
		case ">":
			return l > r
		case "-":
			return l - r
		case "+":
			return l + r
		case "*":
			return l * r
		case "/":
			return l / r
		case "**":
			return math.Pow(l, r)
		}
	} else if isString(left) && isString(right) {
		l := left.(string)
		r := right.(string)
		switch node.GetToken().Kind {
		case "+":
			return l >= r
		case ">=":
			return l >= r
		case "<=":
			return l <= r
		case "<":
			return l < r
		case ">":
			return l > r
		}
	}

	return nil
}

func (i NewInterpreter) Interpret(node newparser.IASTNode) interface{} {
	res := i.visit(node)

	return res
}

func NOT(value interface{}) bool {
	valueType := fmt.Sprintf("%T", value)

	switch valueType {
	case "int":
		if value == 0 {
			return false
		} else {
			return true
		}
	case "string":
		{
			if value == "" {
				return false
			} else {
				return true
			}
		}
	case "bool":
		{
			if value == false {
				return false
			} else {
				return true
			}
		}
	}
	return false

}
