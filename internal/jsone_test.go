package jsone

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	yaml "gopkg.in/yaml.v2"
)

// testCase represents an entry in specification.yml
type testCase struct {
	Section  string                 `json:"section"` // nil, if not a section
	Title    string                 `json:"title"`
	Context  map[string]interface{} `json:"context"`
	Template interface{}            `json:"template"`
	Result   interface{}            `json:"result"`
	Error    interface{}            `json:"error"` // bool, string or nil
}

func (c *testCase) Test(t *testing.T) {
	require.Empty(t, c.Section, "sections aren't test cases")

	// Set a fixed 'now', if one isn't specified
	context := make(map[string]interface{})
	context["now"] = "2017-01-19T16:27:20.974Z"
	for k, v := range c.Context {
		context[k] = v
	}

	result, err := Render(c.Template, context)
	if c.Error == nil {
		require.NoError(t, err)
		require.Equal(t, c.Result, result, "expected a different result")
	} else {
		require.Error(t, err)
	}
}

// TestSpec will load specification.yml into testCase structs and call
// testCase.Test(t) for each test case.
func TestSpec(t *testing.T) {
	// NOTE: this does some ugly YAML hacks to get around type mismatches
	// between YAML and JSON in golang, as well as lack of document support
	// in gopkg.in/yaml.v2

	// Read specification.yml
	data, err := os.ReadFile("../specification.yml")
	require.NoError(t, err, "failed to read specification.yml")
	// Parse as YAML (split for each document)
	var rawSpec []interface{}
	for _, doc := range strings.Split(string(data), "\n---\n") {
		var rawDoc interface{}
		err = yaml.Unmarshal([]byte(doc), &rawDoc)
		require.NoError(t, err, "failed to parse specification.yml")
		rawSpec = append(rawSpec, convertSimpleJSONTypes(rawDoc))
	}
	// Dump as JSON and parse from JSON to []testCase
	data, err = json.Marshal(rawSpec)
	require.NoError(t, err, "couldn't dump specification.yml as JSON")
	var spec []testCase
	err = json.Unmarshal(data, &spec)
	require.NoError(t, err, "failed to parse specification from JSON")

	// Test for each test case
	for i, s := range spec {
		if s.Section == "" {
			continue
		}
		t.Run(s.Section, func(t *testing.T) {
			for _, c := range spec[i+1:] {
				if c.Section != "" {
					break
				}
				t.Run(c.Title, c.Test)
			}
		})
	}
}

// convertSimpleJSONTypes changes types from gopkg.in/yaml.v2 to types used
// for representing JSON in golang, see encoding/json
func convertSimpleJSONTypes(val interface{}) interface{} {
	switch val := val.(type) {
	case []interface{}:
		r := make([]interface{}, len(val))
		for i, v := range val {
			r[i] = convertSimpleJSONTypes(v)
		}
		return r
	case map[interface{}]interface{}:
		r := make(map[string]interface{})
		for k, v := range val {
			s, ok := k.(string)
			if !ok {
				s = fmt.Sprintf("%v", k)
			}
			r[s] = convertSimpleJSONTypes(v)
		}
		return r
	case int:
		return float64(val)
	default:
		return val
	}
}
