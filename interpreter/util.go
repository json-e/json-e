package interpreter

import (
	"fmt"
	"reflect"
	"regexp"
	"runtime"
)

func isString(v interface{}) bool {
	_, ok := v.(string)
	return ok
}

func isNumber(v interface{}) bool {
	_, ok := v.(float64)
	return ok
}

func isBool(v interface{}) bool {
	_, ok := v.(bool)
	return ok
}

// IsJSON returns true, if v is pure JSON
func IsJSON(v interface{}) bool {
	if isString(v) || isNumber(v) || isBool(v) || v == nil {
		return true
	}
	switch val := v.(type) {
	case []interface{}:
		for _, entry := range val {
			if !IsJSON(entry) {
				return false
			}
		}
		return true
	case map[string]interface{}:
		for _, entry := range val {
			if !IsJSON(entry) {
				return false
			}
		}
		return true
	}
	return false
}

// IsTruthy returns true, if value is truthy
func IsTruthy(v interface{}) bool {
	switch val := v.(type) {
	case nil:
		return false
	case []interface{}:
		return len(val) > 0
	case map[string]interface{}:
		return len(val) > 0
	case string:
		return len(val) > 0
	case float64:
		return val != 0
	case bool:
		return val
	case *function:
		return val.Function != nil
	default:
		panic("value is not valid json")
	}
}

type function struct {
	Function    interface{}
	WithContext bool
}

var allowedTypes = []reflect.Type{
	reflect.TypeOf(float64(0)),
	reflect.TypeOf(""),
	reflect.TypeOf(true),
	reflect.TypeOf((*interface{})(nil)).Elem(),
	reflect.TypeOf([]interface{}(nil)),
	reflect.TypeOf(map[string]interface{}(nil)),
}

var typeOfError = reflect.TypeOf((*error)(nil)).Elem()
var typeOfInterface = reflect.TypeOf((*interface{})(nil)).Elem()

func injectedFunctionError(f interface{}, m string) error {
	fn := runtime.FuncForPC(reflect.ValueOf(f).Pointer())
	file, line := fn.FileLine(fn.Entry())
	return fmt.Errorf("injected function %s:%d %s %s", file, line, fn, m)
}

// IsWrappedFunction returns true, if the value is a function wrapped by
// WrapFunction
func IsWrappedFunction(value interface{}) bool {
	_, ok := value.(*function)
	return ok
}

// WrapFunction wraps a function for usage in context passed to
// the interpreter, panics if function is not valid.
//
// This is necessary to ensure that function values can be compared.
func WrapFunction(f interface{}) interface{} {
	v, err := wrapFunction(f, false)
	if err != nil {
		panic(err)
	}
	return v
}

// WrapFunctionWithContext wraps a function for usage in context passed to
// the interpreter, panics if function is not valid.
//
// This requires the function to take map[string]interface{} as first argument,
// this will be the interpreter context.
//
// This is necessary to ensure that function values can be compared.
func WrapFunctionWithContext(f interface{}) interface{} {
	v, err := wrapFunction(f, true)
	if err != nil {
		panic(err)
	}
	return v
}

func wrapFunction(f interface{}, withContext bool) (interface{}, error) {
	t := reflect.TypeOf(f)
	if t.Kind() != reflect.Func {
		return nil, fmt.Errorf("wrapFunction must be given a function")
	}
	WithCtx := 0 // int to use as offset, if there is context
	if withContext {
		WithCtx = 1
		// Check first argument
		if t.In(0) != reflect.TypeOf(map[string]interface{}(nil)) {
			return nil, injectedFunctionError(f, "must have map[string]interface{} as first arguments if accepting context")
		}
	}
	// Check input arguments
	for i := WithCtx; i < t.NumIn(); i++ {
		ok := false
		for _, typ := range allowedTypes {
			if t.In(i) == typ || (i == t.NumIn()-1 && t.IsVariadic() && t.In(i) == reflect.SliceOf(typ)) {
				ok = true
			}
		}
		if !ok {
			return nil, injectedFunctionError(f, "may only accept: bool, string, float64, []interface{}, map[string]interface{} and interface{}")
		}
	}
	// Check return values
	if t.NumOut() == 0 {
		return nil, injectedFunctionError(f, "must return at-least one value")
	}
	if t.NumOut() > 2 {
		return nil, injectedFunctionError(f, "must return at-most two values")
	}
	ok := false
	for _, typ := range allowedTypes {
		if t.Out(0) == typ {
			ok = true
		}
	}
	if !ok {
		return nil, injectedFunctionError(f, "must return: bool, string, float64, []interface{}, map[string]interface{} and interface{}")
	}
	if t.NumOut() == 2 && t.Out(1) != typeOfError {
		return nil, injectedFunctionError(f, "may only have one non-error return value")
	}
	return &function{
		Function:    f,
		WithContext: withContext,
	}, nil
}

func (f *function) Invoke(ctx map[string]interface{}, params []interface{}) (interface{}, error) {
	t := reflect.TypeOf(f.Function)
	WithCtx := 0 // int to use as offset, if there is context
	if f.WithContext {
		WithCtx = 1
	}
	// Validate number of parameters
	if t.NumIn()-WithCtx == 0 && len(params) > 0 {
		return nil, fmt.Errorf("expected zero arguments received %d", len(params))
	}
	if t.IsVariadic() && t.NumIn()-WithCtx-1 > len(params) {
		return nil, fmt.Errorf("expected at-least %d arguments received %d", t.NumIn()-WithCtx-1, len(params))
	}
	if !t.IsVariadic() && t.NumIn()-WithCtx != len(params) {
		return nil, fmt.Errorf("expected %d arguments received %d", t.NumIn()-WithCtx, len(params))
	}

	// Validate parameter types
	for i, param := range params {
		var typ reflect.Type
		if !t.IsVariadic() || i+WithCtx < t.NumIn()-1 {
			typ = t.In(i + WithCtx)
		} else {
			typ = t.In(t.NumIn() - 1).Elem()
		}
		if reflect.TypeOf(param) != typ && typ != typeOfInterface {
			return nil, fmt.Errorf("expected argument number %d to be %s, but received %T",
				i+1, typ.String(), param,
			)
		}
	}

	// Call function
	parameters := make([]reflect.Value, len(params)+WithCtx)
	if f.WithContext {
		parameters[0] = reflect.ValueOf(ctx)
	}
	for i, param := range params {
		if param == nil {
			parameters[i+WithCtx] = reflect.Zero(typeOfInterface)
		} else {
			parameters[i+WithCtx] = reflect.ValueOf(param)
		}
	}
	values := reflect.ValueOf(f.Function).Call(parameters)

	// Validate the return value
	err := IsValidData(values[0].Interface())
	if err != nil {
		fn := runtime.FuncForPC(reflect.ValueOf(f.Function).Pointer())
		file, line := fn.FileLine(fn.Entry())
		panic(fmt.Errorf("function %s:%d %s returned illegal value: %s", file, line, fn.Name(), err.Error()))
	}

	// Interpret result values
	if len(values) == 1 || values[1].Interface() == nil {
		return values[0].Interface(), nil
	}
	return values[0].Interface(), values[1].Interface().(error)
}

// IsValidData returns an error explaining why data isn't valid, or nil
func IsValidData(data interface{}) error {
	if data == nil {
		return nil
	}
	switch val := data.(type) {
	case *function, string, float64, bool:
		return nil
	case []interface{}:
		for _, value := range val {
			if err := IsValidData(value); err != nil {
				return err
			}
		}
		return nil
	case map[string]interface{}:
		for _, value := range val {
			if err := IsValidData(value); err != nil {
				return err
			}
		}
		return nil
	}
	if reflect.TypeOf(data).Kind() == reflect.Func {
		fn := runtime.FuncForPC(reflect.ValueOf(data).Pointer())
		file, line := fn.FileLine(fn.Entry())
		return fmt.Errorf("function %s:%d %s must be wrapped with WrapFunction", file, line, fn.Name())
	}
	return fmt.Errorf("cannot inject type %s", reflect.TypeOf(data).String())
}

var contextVariablePattern = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

// IsValidContext returns false if context contains illegal variables.
func IsValidContext(context map[string]interface{}) error {
	for k, v := range context {
		if !contextVariablePattern.MatchString(k) {
			return fmt.Errorf("context variable '%s' doesn't match pattern: %s", k, contextVariablePattern.String())
		}
		if err := IsValidData(v); err != nil {
			return err
		}
	}
	return nil
}

// normalizeData will wrap functions and return an error if the data structure
// contains illegal types.
func normalizeData(v interface{}) (interface{}, error) {
	if v == nil {
		return nil, nil
	}
	switch val := v.(type) {
	case *function, string, float64, bool:
		return val, nil
	case []interface{}:
		result := make([]interface{}, len(val))
		for i, value := range val {
			var err error
			result[i], err = normalizeData(value)
			if err != nil {
				return nil, err
			}
		}
		return result, nil
	case map[string]interface{}:
		result := make(map[string]interface{}, len(val))
		for key, value := range val {
			var err error
			result[key], err = normalizeData(value)
			if err != nil {
				return nil, err
			}
		}
		return result, nil
	}
	if reflect.TypeOf(v).Kind() == reflect.Func {
		val, err := wrapFunction(v, false)
		if err != nil {
			return nil, err
		}
		return val, nil
	}
	return nil, fmt.Errorf("cannot inject type %s", reflect.TypeOf(v).String())
}

func deepEquals(a, b interface{}) bool {
	switch A := a.(type) {
	case *function:
		B, ok := b.(*function)
		return ok && A == B
	case string:
		B, ok := b.(string)
		return ok && A == B
	case float64:
		B, ok := b.(float64)
		return ok && A == B
	case bool:
		B, ok := b.(bool)
		return ok && A == B
	case nil:
		return b == nil
	case []interface{}:
		if B, ok := b.([]interface{}); ok {
			if len(A) != len(B) {
				return false
			}
			for i, v := range A {
				if !deepEquals(v, B[i]) {
					return false
				}
			}
			return true
		}
		return false
	case map[string]interface{}:
		if B, ok := b.(map[string]interface{}); ok {
			if len(A) != len(B) {
				return false
			}
			for k, vA := range A {
				if vB, ok := B[k]; !ok || !deepEquals(vA, vB) {
					return false
				}
			}
			return true
		}
		return false
	default:
		panic(fmt.Errorf("cannot compare unsupported type: %T", a))
	}
}
