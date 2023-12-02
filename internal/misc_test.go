package jsone

import (
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
