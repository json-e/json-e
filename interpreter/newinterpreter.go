package interpreter

import (
	"../interpreter/newparser"
	"fmt"
	"math"
	"reflect"
	"strconv"
	"strings"
)

type NewInterpreter struct {
	context map[string]interface{}
}

func (i *NewInterpreter) AddContext(context map[string]interface{}) {
	i.context = context
}

func (i NewInterpreter) visit(node newparser.IASTNode) interface{} {
	nodeType := strings.Split(fmt.Sprintf("%T", node), ".")[1]
	funcName := "Visit_" + nodeType

	arg := make([]reflect.Value, 1)
	arg[0] = reflect.ValueOf(node)

	val := reflect.ValueOf(i).MethodByName(funcName).Call(arg)

	return val[0].Interface()
}

func (i NewInterpreter) Visit_ASTNode(node newparser.ASTNode) interface{} {
	token := node.Token

	switch token.Kind {
	case "number":
		value, _ := strconv.ParseFloat(token.Value, 64)
		return value
	case "null":
		return nil
	case "string":
		return token.Value[1 : len(token.Value)-1]
	case "true":
		return true
	case "false":
		return false
	case "identifier":
		return node.GetToken().Value
	}
	return nil
}

func (i NewInterpreter) Visit_UnaryOp(node newparser.UnaryOp) interface{} {
	next := i.visit(node.Expr)

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

func (i NewInterpreter) Visit_BinOp(node newparser.BinOp) interface{} {
	var right interface{}
	left := i.visit(node.Left)

	switch node.GetToken().Kind {
	case "||":
		return IsTruthy(left) || IsTruthy(i.visit(node.Right))
	case "&&":
		return IsTruthy(left) && IsTruthy(right)
	default:
		right = i.visit(node.Right)
	}

	switch node.GetToken().Kind {
	case "==":
		return DeepEquals(left, right)
	case "!=":
		return !DeepEquals(left, right)
	case ".":
		obj := left
		key := right.(string)
		if target, ok := obj.(map[string]interface{}); ok {
			if value, ok := target[key]; ok {
				return value
			}
		}
	case "in":
		// A in B, where B is a string
		if s, ok := right.(string); ok {
			return strings.Contains(s, left.(string))
		}

		// A in B; where B is an object
		if o, ok := right.(map[string]interface{}); ok {
			_, result := o[left.(string)]
			return result
		}

		// A in B; where B is an array
		if a, ok := right.([]interface{}); ok {
			for _, val := range a {
				if DeepEquals(left, val) {
					return true
				}
			}
			return false
		}
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
			return math.Pow(r, l)
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

func (i NewInterpreter) Visit_List(node newparser.List) interface{} {
	var list []interface{}

	if len(node.List) > 0 {
		for _, element := range node.List {
			list = append(list, i.visit(element))
		}
	}

	return list
}

func (i NewInterpreter) Visit_ValueAccess(node newparser.ValueAccess) interface{} {
	arr := i.visit(node.Arr)
	var right, left interface{}
	var end, start int
	if node.Left != nil {
		left = i.visit(node.Left)
	}
	if node.Right != nil {
		right = i.visit(node.Right)
	}
	if key, ok := left.(string); ok {
		return arr.(map[string]interface{})[key]
	} else {
		if node.Left == nil {
			start = 0
		} else {
			start = int(left.(float64))
		}
		length := len(arr.([]interface{}))

		if start < 0 {
			start = length + start
		}

		if node.IsInterval {
			if node.Right == nil {
				end = length
			} else {
				end = int(right.(float64))
			}
			if end < 0 {
				end = length + end
				if end < 0 {
					end = 0
				}
			}
			if start > end {
				start = end
			}

			return arr.([]interface{})[start:end]
		}

		return arr.([]interface{})[start]
	}
}

func (i NewInterpreter) Visit_Builtin(node newparser.Builtin) interface{} {
	builtin := i.context[node.GetToken().Value]
	var args []interface{}
	f, ok := builtin.(*function)
	if ok {
		var result interface{}

		for _, element := range node.Args {
			args = append(args, i.visit(element))
		}

		result, _ = f.Invoke(i.context, args)
		return result
	}
	return builtin
}

func (i NewInterpreter) Visit_Object(node newparser.Object) interface{} {
	obj := make(map[string]interface{})
	for key, element := range node.Obj {
		obj[key] = i.visit(element)
	}
	return obj
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
