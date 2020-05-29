Introduces $switch operator, which behaves like a combination of the $if and $match operator for
more complex boolean logic. It gets an object, in which every key is a string expression(s), where
at most one must evaluate to true and the remaining to false based on the context. The result will be
the value corresponding to the key that were evaluated to true.
