package jsone

import (
	"errors"
	"testing"

	"github.com/json-e/json-e/v4/internal/interpreter"
	"github.com/stretchr/testify/require"
)

func TestNoArgFunction(t *testing.T) {
	// Set a fixed 'now', if one isn't specified
	context := make(map[string]interface{})
	context["noargs"] = interpreter.WrapFunction(func() float64 { return 42.0 })

	result, err := Render(map[string]interface{}{"$eval": "noargs()"}, context)
	require.NoError(t, err)
	require.Equal(t, result, 42.0)
}

func TestAllowedArgAndResultTypes(t *testing.T) {
	context := map[string]interface{}{
		"float64":      62.0,
		"string":       "str",
		"bool":         true,
		"array":        []interface{}{"a", "b"},
		"map":          map[string]interface{}{"key": "value"},
		"float64_func": interpreter.WrapFunction(func(x float64) float64 { return x + 2.0 }),
		"string_func":  interpreter.WrapFunction(func(x string) string { return "Hello, " + x }),
		"bool_func":    interpreter.WrapFunction(func(x bool) bool { return !x }),
		"array_func":   interpreter.WrapFunction(func(x []interface{}) []interface{} { return []interface{}{x[1], x[0]} }),
		"map_func":     interpreter.WrapFunction(func(x map[string]interface{}) map[string]interface{} { return map[string]interface{}{"nested": x} }),
	}

	template := map[string]interface{}{}
	addInvocation := func(template map[string]interface{}, call string) {
		template[call] = map[string]interface{}{"$eval": call}
	}

	addInvocation(template, "float64_func(float64)")
	addInvocation(template, "string_func(string)")
	addInvocation(template, "bool_func(bool)")
	addInvocation(template, "array_func(array)")
	addInvocation(template, "map_func(map)")

	expected := map[string]interface{}{
		"float64_func(float64)": 64.0,
		"string_func(string)":   "Hello, str",
		"bool_func(bool)":       false,
		"array_func(array)":     []interface{}{"b", "a"},
		"map_func(map)":         map[string]interface{}{"nested": map[string]interface{}{"key": "value"}},
	}

	actual, err := Render(template, context)
	require.NoError(t, err)
	require.Equal(t, expected, actual)
}

func TestErrorFromFunction(t *testing.T) {
	f := func(fail bool) error {
		if fail == true {
			return errors.New("obvious error")
		}
		return nil
	}
	context := map[string]interface{}{
		"float64_func": interpreter.WrapFunction(func(fail bool) (float64, error) { return 0, f(fail) }),
		"string_func":  interpreter.WrapFunction(func(fail bool) (string, error) { return "", f(fail) }),
		"bool_func":    interpreter.WrapFunction(func(fail bool) (bool, error) { return false, f(fail) }),
		"array_func":   interpreter.WrapFunction(func(fail bool) ([]interface{}, error) { return []interface{}{}, f(fail) }),
		"map_func":     interpreter.WrapFunction(func(fail bool) (map[string]interface{}, error) { return map[string]interface{}{}, f(fail) }),
	}

	for name := range context {
		_, err := Render(map[string]interface{}{"$eval": name + "(false)"}, context)
		require.NoError(t, err)
		_, err = Render(map[string]interface{}{"$eval": name + "(true)"}, context)
		require.Errorf(t, err, "obvious error")
	}
}
