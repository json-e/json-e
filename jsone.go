package jsone

import (
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	i "github.com/taskcluster/json-e/interpreter"
)

// Render template with given context
func Render(template interface{}, context map[string]interface{}) (interface{}, error) {
	// Validate input
	if err := i.IsValidContext(context); err != nil {
		panic(err)
	}

	// Inherit functions from builtins
	c := make(map[string]interface{}, len(context)+len(builtin)+1)
	c["now"] = time.Now().UTC().Format(timeFormat)
	for k, v := range builtin {
		c[k] = v
	}
	for k, v := range context {
		c[k] = v
	}
	// Render template
	result, err := render(template, c)
	if err != nil {
		return nil, err
	}

	//Handle deleteMarker
	if result == deleteMarker {
		result = nil
	}

	if result != nil && reflect.TypeOf(result).Kind() == reflect.Ptr {
		return nil, TemplateError{
			Message:  "$eval: function doesn't get any arguments in template",
			Template: template,
		}
	}

	// return result
	return result, nil
}

var deleteMarker = struct{}{}

type operator func(template, context map[string]interface{}) (interface{}, error)

// TemplateError is an error in the template.
type TemplateError struct {
	Message  string
	Template interface{}
}

func (t TemplateError) Error() string {
	data, _ := json.Marshal(t.Template)
	return fmt.Sprintf("%s in template %s", t.Message, string(data))
}

// restrictProperties returns an error if the template contains properties other
// than those listed as allowed
func restrictProperties(template map[string]interface{}, allowed ...string) error {
	for k := range template {
		matched := false
		for _, s := range allowed {
			if s == k {
				matched = true
				break
			}
		}
		if !matched {
			return TemplateError{
				Message:  fmt.Sprintf("property '%s' is not permitted in template", k),
				Template: template,
			}
		}
	}
	return nil
}

var fromNowPattern = regexp.MustCompile(strings.Join([]string{
	`^(?:\s*(-|\+))?`,
	`(?:\s*(\d+)\s*y(?:(?:ears?)|r)?)?`,
	`(?:\s*(\d+)\s*mo(?:nths?)?)?`,
	`(?:\s*(\d+)\s*w(?:(?:eeks?)|k)?)?`,
	`(?:\s*(\d+)\s*d(?:ays?)?)?`,
	`(?:\s*(\d+)\s*h(?:(?:ours?)|r)?)?`,
	`(?:\s*(\d+)\s*m(?:in(?:utes?)?)?)?`,
	`(?:\s*(\d+)\s*s(?:ec(?:onds?)?)?)?`,
	`\s*$`,
}, ""))

const timeFormat = "2006-01-02T15:04:05.000Z"

func fromNow(s string, reference time.Time) (string, error) {
	if reference.IsZero() {
		reference = time.Now()
	}

	m := fromNowPattern.FindStringSubmatch(s)
	if m == nil {
		return "", fmt.Errorf("invalid time expression passed to fromNow('%s')", s)
	}

	neg := 1
	if m[1] == "-" {
		neg = -1
	}
	years, _ := strconv.Atoi(m[2])
	months, _ := strconv.Atoi(m[3])
	weeks, _ := strconv.Atoi(m[4])
	days, _ := strconv.Atoi(m[5])
	hours, _ := strconv.Atoi(m[6])
	minutes, _ := strconv.Atoi(m[7])
	seconds, _ := strconv.Atoi(m[8])

	// Sum up to days
	days += 365 * years
	days += 30 * months
	days += 7 * weeks

	// Sum up to hours, minutes, seconds
	hours += 24 * days
	minutes += 60 * hours
	seconds += 60 * minutes

	result := reference.Add(time.Duration(seconds*neg) * time.Second)

	return result.UTC().Format(timeFormat), nil
}

var builtin = map[string]interface{}{
	"min": i.WrapFunction(func(n float64, m ...float64) float64 {
		for _, v := range m {
			if v < n {
				n = v
			}
		}
		return n
	}),
	"max": i.WrapFunction(func(n float64, m ...float64) float64 {
		for _, v := range m {
			if v > n {
				n = v
			}
		}
		return n
	}),
	"sqrt":      i.WrapFunction(math.Sqrt),
	"ceil":      i.WrapFunction(math.Ceil),
	"floor":     i.WrapFunction(math.Floor),
	"abs":       i.WrapFunction(math.Abs),
	"lowercase": i.WrapFunction(strings.ToLower),
	"uppercase": i.WrapFunction(strings.ToUpper),
	"strip":     i.WrapFunction(strings.TrimSpace),
	"lstrip": i.WrapFunction(func(s string) string {
		return strings.TrimLeftFunc(s, unicode.IsSpace)
	}),
	"rstrip": i.WrapFunction(func(s string) string {
		return strings.TrimRightFunc(s, unicode.IsSpace)
	}),
	"str": i.WrapFunction(func(v interface{}) (string, error) {
		switch val := v.(type) {
		case string:
			return val, nil
		case float64:
			return strconv.FormatFloat(val, 'f', -1, 64), nil
		case bool:
			return strconv.FormatBool(val), nil
		case nil:
			return "null", nil
		default:
			return "", fmt.Errorf("str(value) only works on strings, numbers, booleans and null")
		}
	}),
	"number": i.WrapFunction(func(s string) (float64, error) {
		return strconv.ParseFloat(s, 64)
	}),
	"typeof": i.WrapFunction(func(v interface{}) interface{} {
		switch v.(type) {
		case string:
			return "string"
		case float64:
			return "number"
		case bool:
			return "boolean"
		case nil:
			return "null"
		case []interface{}:
			return "array"
		case map[string]interface{}:
			return "object"
		default:
			if i.IsWrappedFunction(v) {
				return "function"
			}
			panic(fmt.Errorf("illegal data-type injected: %T", v))
		}
	}),
	"len": i.WrapFunction(func(v interface{}) (float64, error) {
		switch val := v.(type) {
		case string:
			return float64(utf8.RuneCountInString(val)), nil
		case []interface{}:
			return float64(len(val)), nil
		}
		return 0, fmt.Errorf("len(value) only works on arrays and strings")
	}),
	"fromNow": i.WrapFunctionWithContext(func(context map[string]interface{}, offset string, from ...string) (string, error) {
		// We use variadic because golang doesn't support optional parameters
		if len(from) > 1 {
			return "", fmt.Errorf("fromNow(offset, reference) takes at-most two arguments, but was given %d", len(from))
		}
		// Get 'now' from context
		reference, ok := context["now"].(string)
		if !ok {
			return "", fmt.Errorf("fromNow(offset, reference) expected 'now' from context to be a string")
		}
		if len(from) == 1 {
			reference = from[0]
		}
		ref, err := time.Parse(timeFormat, reference)
		if err != nil {
			return "", fmt.Errorf(
				"fromNow(offset, reference) could not parse time reference '%s' error: %s",
				reference, err.Error(),
			)
		}
		return fromNow(offset, ref)
	}),
}

var eachKeyPattern = regexp.MustCompile(`^each\(([a-zA-Z_][a-zA-Z0-9_]*)(,\s*([a-zA-Z_][a-zA-Z0-9_]*))?\)$`)
var byKeyPattern = regexp.MustCompile(`^by\(([a-zA-Z_][a-zA-Z0-9_]*)\)$`)

var operators = map[string]operator{
	"$eval": func(template, context map[string]interface{}) (interface{}, error) {
		if err := restrictProperties(template, "$eval"); err != nil {
			return nil, err
		}
		s, ok := template["$eval"].(string)
		if !ok {
			return nil, TemplateError{
				Message:  "$eval expects a string expression",
				Template: template,
			}
		}
		value, err := i.Execute(s, 0, context)
		if err != nil {
			return nil, TemplateError{
				Message:  err.Error(),
				Template: template,
			}
		}
		return value, nil
	},
	"$flatten": func(template, context map[string]interface{}) (interface{}, error) {
		if err := restrictProperties(template, "$flatten"); err != nil {
			return nil, err
		}
		value, err := render(template["$flatten"], context)
		if err != nil {
			return nil, err
		}
		a, ok := value.([]interface{})
		if !ok {
			return nil, TemplateError{
				Message:  "$flatten expects an array",
				Template: template,
			}
		}
		result := make([]interface{}, 0, len(a))
		for _, entry := range a {
			if a2, ok := entry.([]interface{}); ok {
				result = append(result, a2...)
			} else {
				result = append(result, entry)
			}
		}
		return result, nil
	},
	"$flattenDeep": func(template, context map[string]interface{}) (interface{}, error) {
		if err := restrictProperties(template, "$flattenDeep"); err != nil {
			return nil, err
		}
		value, err := render(template["$flattenDeep"], context)
		if err != nil {
			return nil, err
		}
		a, ok := value.([]interface{})
		if !ok {
			return nil, TemplateError{
				Message:  "$flattenDeep expects an array",
				Template: template,
			}
		}
		result := make([]interface{}, 0, len(a))
		var flatten func(list []interface{})
		flatten = func(list []interface{}) {
			for _, entry := range list {
				if subentry, ok := entry.([]interface{}); ok {
					flatten(subentry)
				} else {
					result = append(result, entry)
				}
			}
		}
		flatten(a)
		return result, nil
	},
	"$fromNow": func(template, context map[string]interface{}) (interface{}, error) {
		if err := restrictProperties(template, "$fromNow", "from"); err != nil {
			return nil, err
		}

		// find the fromNow offset
		value, err := render(template["$fromNow"], context)
		if err != nil {
			return nil, err
		}
		offset, ok := value.(string)
		if !ok {
			return nil, TemplateError{
				Message:  "$fromNow expects a string value",
				Template: template,
			}
		}

		reference, ok := context["now"].(string)
		if !ok {
			return nil, TemplateError{
				Message:  "$fromNow expected the 'now' from context to be a string",
				Template: template,
			}
		}
		if from, ok := template["from"]; ok {
			r, rerr := render(from, context)
			if rerr != nil {
				return nil, rerr
			}
			reference, ok = r.(string)
			if !ok {
				return nil, TemplateError{
					Message:  "$fromNow expected the 'from' property to be a string",
					Template: template,
				}
			}
		}
		ref, err := time.Parse(timeFormat, reference)
		if err != nil {
			return nil, TemplateError{
				Message:  fmt.Sprintf("could not parse time reference '%s' error: %s", reference, err.Error()),
				Template: template,
			}
		}

		// parse fromNow format, and wrap error
		result, err := fromNow(offset, ref)
		if err != nil {
			return nil, TemplateError{
				Message:  err.Error(),
				Template: template,
			}
		}
		return result, nil
	},
	"$if": func(template, context map[string]interface{}) (interface{}, error) {
		if err := restrictProperties(template, "$if", "then", "else"); err != nil {
			return nil, err
		}
		s, ok := template["$if"].(string)
		if !ok {
			return nil, TemplateError{
				Message:  "$if expects a string expression",
				Template: template,
			}
		}
		val, err := i.Execute(s, 0, context)
		if err != nil {
			return nil, TemplateError{
				Message:  err.Error(),
				Template: template,
			}
		}
		var result interface{}
		if i.IsTruthy(val) {
			result, ok = template["then"]
		} else {
			result, ok = template["else"]
		}
		if !ok {
			return deleteMarker, nil
		}
		return render(result, context)
	},
	"$json": func(template, context map[string]interface{}) (interface{}, error) {
		if err := restrictProperties(template, "$json"); err != nil {
			return nil, err
		}
		val, err := render(template["$json"], context)
		if err != nil {
			return nil, err
		}
		if !i.IsJSON(val) {
			return nil, TemplateError{
				Message:  "$json can only stringify JSON types",
				Template: template,
			}
		}
		data, _ := json.Marshal(val)
		return string(data), nil
	},
	"$let": func(template, context map[string]interface{}) (interface{}, error) {
		if err := restrictProperties(template, "$let", "in"); err != nil {
			return nil, err
		}
		o, ok := template["$let"].(map[string]interface{})
		if !ok {
			return nil, TemplateError{
				Message:  "$let expects an object",
				Template: template,
			}
		}
		c := make(map[string]interface{}, len(context))
		for k, v := range context {
			c[k] = v
		}
		var err error
		for k, v := range o {
			c[k], err = render(v, context)
			if err != nil {
				return nil, err
			}
		}
		in, ok := template["in"]
		if !ok {
			return nil, TemplateError{
				Message:  "$let requires an 'in' clause",
				Template: template,
			}
		}
		if err = i.IsValidContext(c); err != nil {
			return nil, TemplateError{
				Message:  err.Error(),
				Template: template,
			}
		}
		return render(in, c)
	},
	"$map": func(template, context map[string]interface{}) (interface{}, error) {
		value, err := render(template["$map"], context)
		if err != nil {
			return nil, err
		}
		if len(template) != 2 {
			return nil, TemplateError{
				Message:  "$map must have exactly two properties",
				Template: template,
			}
		}
		// Find the each(...) key
		var eachKey string
		for k := range template {
			if k == "$map" {
				continue
			}
			eachKey = k
		}
		// Validate against each(...) key pattern
		m := eachKeyPattern.FindStringSubmatch(eachKey)
		if m == nil {
			return nil, TemplateError{
				Message:  "$map requires a property on the form 'each(identifier)'",
				Template: template,
			}
		}
		eachIdentifier := m[1]
		eachIndex := m[3]
		additionalContextVars := 1
		if len(eachIndex) > 0 {
			additionalContextVars = 2
		}
		eachTemplate := template[eachKey]
		switch val := value.(type) {
		case []interface{}:
			var result []interface{}
			for idx, entry := range val {
				c := make(map[string]interface{}, len(context)+additionalContextVars)
				for k, v := range context {
					c[k] = v
				}
				c[eachIdentifier] = entry
				if len(eachIndex) > 0 {
					c[eachIndex] = float64(idx)
				}
				r, err := render(eachTemplate, c)
				if err != nil {
					return nil, err
				}
				if r == deleteMarker {
					continue
				}
				result = append(result, r)
			}
			return result, nil
		case map[string]interface{}:
			result := make(map[string]interface{})
			for K, V := range val {
				c := make(map[string]interface{}, len(context)+additionalContextVars)
				for k, v := range context {
					c[k] = v
				}
				if len(eachIndex) > 0 {
					c[eachIdentifier] = V
					c[eachIndex] = K
				} else {
					c[eachIdentifier] = map[string]interface{}{
						"key": K,
						"val": V,
					}
				}

				r, err := render(eachTemplate, c)
				if err != nil {
					return nil, err
				}
				R, ok := r.(map[string]interface{})
				if !ok {
					return nil, TemplateError{
						Message:  fmt.Sprintf("$map on objects expects 'each(%s)' to evaluate to an object", eachIdentifier),
						Template: eachTemplate,
					}
				}
				for k, v := range R {
					if v == deleteMarker {
						continue
					}
					result[k] = v
				}
			}
			return result, nil
		default:
			return nil, TemplateError{
				Message:  "$map requires a value that evaluates to either an object or an array",
				Template: template,
			}
		}
	},
	"$match": func(template, context map[string]interface{}) (interface{}, error) {
		if err := restrictProperties(template, "$match"); err != nil {
			return nil, err
		}

		match, ok := template["$match"].(map[string]interface{})
		if !ok {
			return nil, TemplateError{
				Message:  "$match can evaluate objects only",
				Template: template,
			}
		}

		// get the sorted list of conditions
		conditions := make([]string, 0, len(match))
		for condition := range match {
			conditions = append(conditions, condition)
		}
		sort.Strings(conditions)

		result := make([]interface{}, 0, len(match))

		for _, key := range conditions {
			check, err := i.Execute(key, 0, context)
			if err != nil {
				return nil, TemplateError{
					Message:  err.Error(),
					Template: template,
				}
			}

			if i.IsTruthy(check) {
				value := match[key]
				r, err := render(value, context)
				if err != nil {
					return nil, TemplateError{
						Message:  err.Error(),
						Template: template,
					}
				}
				result = append(result, r)
			}
		}

		return result, nil
	},
	"$merge": func(template, context map[string]interface{}) (interface{}, error) {
		if err := restrictProperties(template, "$merge"); err != nil {
			return nil, err
		}
		value, err := render(template["$merge"], context)
		if err != nil {
			return nil, err
		}
		a, ok := value.([]interface{})
		if !ok {
			return nil, TemplateError{
				Message:  "$merge expected an array",
				Template: template,
			}
		}
		result := make(map[string]interface{})
		for _, entry := range a {
			obj, ok := entry.(map[string]interface{})
			if !ok {
				return nil, TemplateError{
					Message:  "$merge expected an array of objects",
					Template: template,
				}
			}
			for k, v := range obj {
				result[k] = v
			}
		}
		return result, nil
	},
	"$mergeDeep": func(template, context map[string]interface{}) (interface{}, error) {
		if err := restrictProperties(template, "$mergeDeep"); err != nil {
			return nil, err
		}
		value, err := render(template["$mergeDeep"], context)
		if err != nil {
			return nil, err
		}
		a, ok := value.([]interface{})
		if !ok {
			return nil, TemplateError{
				Message:  "$mergeDeep expected an array",
				Template: template,
			}
		}
		var merge func(L, R interface{}) interface{}
		merge = func(L, R interface{}) interface{} {
			if l, ok := L.([]interface{}); ok {
				if r, ok := R.([]interface{}); ok {
					return append(l, r...)
				}
			}
			if l, ok := L.(map[string]interface{}); ok {
				if r, ok := R.(map[string]interface{}); ok {
					result := make(map[string]interface{}, len(l))
					for k, v := range l {
						result[k] = v
					}
					for k, v := range r {
						if lv, ok := l[k]; ok {
							result[k] = merge(lv, v)
						} else {
							result[k] = v
						}
					}
					return result
				}
			}
			return R
		}
		result := interface{}(make(map[string]interface{}))
		for _, entry := range a {
			obj, ok := entry.(map[string]interface{})
			if !ok {
				return nil, TemplateError{
					Message:  "$mergeDeep expected an array of objects",
					Template: template,
				}
			}
			result = merge(result, obj)
		}
		return result, nil
	},
	"$reverse": func(template, context map[string]interface{}) (interface{}, error) {
		if err := restrictProperties(template, "$reverse"); err != nil {
			return nil, err
		}
		value, err := render(template["$reverse"], context)
		if err != nil {
			return nil, err
		}
		a, ok := value.([]interface{})
		if !ok {
			return nil, TemplateError{
				Message:  "$reverse expected a value that evaluated to an array",
				Template: template,
			}
		}
		result := make([]interface{}, len(a))
		for i, val := range a {
			result[len(a)-i-1] = val
		}
		return result, nil
	},
	"$sort": func(template, context map[string]interface{}) (interface{}, error) {
		value, err := render(template["$sort"], context)
		if err != nil {
			return nil, err
		}
		items, ok := value.([]interface{})
		if !ok {
			return nil, TemplateError{
				Message:  "$sort expects a value that evaluates to an array",
				Template: template,
			}
		}
		if len(template) > 2 {
			return nil, TemplateError{
				Message:  "$sort can have at-most two properties",
				Template: template,
			}
		}

		// Find values to sort by
		byValues := make([]interface{}, len(items))
		if len(template) == 1 {
			// If we have no by(...) key, we just take the items themselves
			copy(byValues, items)
		} else {
			// Find the by(...) key
			var byKey string
			for k := range template {
				if k == "$sort" {
					continue
				}
				byKey = k
			}
			// Validate against by(...) key pattern
			m := byKeyPattern.FindStringSubmatch(byKey)
			if m == nil {
				return nil, TemplateError{
					Message:  "$sort may only have on other property on the form 'by(identifier)'",
					Template: template,
				}
			}
			byIdentifier := m[1]
			byExpr, ok := template[byKey].(string)
			if !ok {
				return nil, TemplateError{
					Message:  "$sort requires that a string expression be passed to the 'by(identifier)' property",
					Template: template,
				}
			}
			// Find the byValues
			for j, item := range items {
				c := make(map[string]interface{}, len(context)+1)
				for k, v := range context {
					c[k] = v
				}
				c[byIdentifier] = item
				val, err := i.Execute(byExpr, 0, c)
				if err != nil {
					return nil, TemplateError{
						Message:  err.Error(),
						Template: template,
					}
				}
				byValues[j] = val
			}
		}

		// Check that byValues are all integers or strings
		if len(byValues) == 0 {
			return []interface{}{}, nil
		}
		mixedTypes := false
		switch byValues[0].(type) {
		case float64:
			for _, val := range byValues {
				if _, ok := val.(float64); !ok {
					mixedTypes = true
					break
				}
			}
		case string:
			for _, val := range byValues {
				if _, ok := val.(string); !ok {
					mixedTypes = true
					break
				}
			}
		default:
			return nil, TemplateError{
				Message:  "$sort can only operate on strings and numbers, add a 'by(identifier)' to sort by a key",
				Template: template,
			}
		}
		if mixedTypes {
			return nil, TemplateError{
				Message:  "$sort cannot handle mixed types, tweak the 'by(identifier)' property to conform values",
				Template: template,
			}
		}

		// Sort items
		items = append([]interface{}(nil), items...)
		sort.Sort(sortable{items, byValues})
		return items, nil
	},
}

type sortable struct {
	Items    []interface{} // items to sort
	ByValues []interface{} // values to sort items by
}

func (s sortable) Len() int {
	return len(s.Items)
}

func (s sortable) Swap(i, j int) {
	s.Items[i], s.Items[j] = s.Items[j], s.Items[i]
	s.ByValues[i], s.ByValues[j] = s.ByValues[j], s.ByValues[i]
}

func (s sortable) Less(i, j int) bool {
	if I, ok := s.ByValues[i].(string); ok {
		if J, ok := s.ByValues[j].(string); ok {
			return strings.Compare(I, J) == -1
		}
	}
	if I, ok := s.ByValues[i].(float64); ok {
		if J, ok := s.ByValues[j].(float64); ok {
			return I < J
		}
	}
	panic(fmt.Sprintf("sortable expected strings or float64 by found: %T and %T", s.ByValues[i], s.ByValues[j]))
}

var interpolationPattern = regexp.MustCompile(`\$?\${`)

func interpolate(template string, context map[string]interface{}) (string, error) {
	result := ""
	remaining := template
	for {
		loc := interpolationPattern.FindStringIndex(remaining)
		if loc == nil {
			break
		}
		offset := loc[0]

		result += remaining[:offset]
		if remaining[offset+1] != '$' {
			value, end, err := i.ExecuteUntil(remaining, offset+2, "}", context)
			if err != nil {
				return "", err
			}
			remaining = remaining[end:]
			switch v := value.(type) {
			case string:
				result += v
			case float64:
				result += strconv.FormatFloat(v, 'f', -1, 64)
			case bool:
				result += strconv.FormatBool(v)
			case nil:
				// null, interpolates as empty string
			default:
				return "", fmt.Errorf("cannot interpolate array/object in '%s'", template)
			}
		} else {
			result += "${"
			remaining = remaining[offset+3:]
		}
	}

	return result + remaining, nil
}

// Hack to work around golang limitation that render() can be referenced in the
// definition of "operators" if "operators" references render().
// Whether this is a compiler bug, or just done this way to keep golang simple
// is hard to tell, regardless this work around is easy to follow.
var operatorsDefined map[string]operator

func init() {
	operatorsDefined = operators
}

var reservedIdentifiers = regexp.MustCompile(`^\$[a-zA-Z][a-zA-Z0-9]*$`)

func render(template interface{}, context map[string]interface{}) (interface{}, error) {
	if template == nil {
		return nil, nil
	}
	switch v := template.(type) {
	case float64, bool:
		return v, nil
	case string:
		return interpolate(v, context)
	case []interface{}:
		result := make([]interface{}, 0, len(v))
		for _, val := range v {
			r, err := render(val, context)
			if err != nil {
				return nil, err
			}
			if r != deleteMarker {
				result = append(result, r)
			}
		}
		return result, nil
	case map[string]interface{}:
		// Search for operator
		var op operator
		for k := range v {
			if o, ok := operatorsDefined[k]; ok {
				if op != nil {
					return nil, TemplateError{
						Message:  "at-most one $<keyword> operator is allowed",
						Template: v,
					}
				}
				op = o
			}
		}
		// Apply operator
		if op != nil {
			return op(v, context)
		}

		// Clone object
		result := make(map[string]interface{}, len(v))
		for k, v := range v {

			r, err := render(v, context)
			if err != nil {
				return nil, err
			}
			if r != deleteMarker {
				if strings.HasPrefix(k, "$$") {
					k = k[1:]
				} else if reservedIdentifiers.MatchString(k) {
					return nil, TemplateError{
						Message:  fmt.Sprintf("'$%s' is reserved used '$$%s' instead", k, k),
						Template: v,
					}
				}
				k, err = interpolate(k, context)
				if err != nil {
					return nil, err
				}
				result[k] = r
			}
		}
		return result, nil
	default:
		return nil, TemplateError{
			Message:  "illegal type",
			Template: v,
		}
	}
}
