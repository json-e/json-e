package interpreter

// Execute expression with given context starting from offset.
//
// Values of context must be valid, see IsValidContext()
func Execute(expression string, offset int, context map[string]interface{}) (interface{}, error) {
	if err := IsValidContext(context); err != nil {
		panic(err)
	}
	return Interpreter.Parse(expression, offset, context)
}

// ExecuteUntil will execute expression from offset with given context, expecting
// to find terminator after the expression, returns value and end-offset or error.
//
// Values of context must be valid, see IsValidContext()
func ExecuteUntil(expression string, offset int, terminator string, context map[string]interface{}) (interface{}, int, error) {
	if err := IsValidContext(context); err != nil {
		panic(err)
	}
	return Interpreter.ParseUntil(expression, offset, terminator, context)
}
